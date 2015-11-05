'use strict';
var _ = require('lodash');

var Configuration = require('./configuration');
var ConfigurationError = require('./configuration_error');

function ConfigurableTaskFactory(stuff, runnerFactory, gulpTaskRegistry) {
	this.stuff = stuff;
	this.runnerFactory = runnerFactory;
	this.gulpTaskRegistry = gulpTaskRegistry;
}

ConfigurableTaskFactory.prototype.one = function(prefix, name, rawConfig, parentConfig) {
	var stuff, schema, consumes, configs, taskInfo, runner, task;

	stuff = this.stuff;

	taskInfo = Configuration.getTaskRuntimeInfo(name);

	if (rawConfig.debug) {
		debugger;
	}

	schema = getTaskSchema(taskInfo.name);
	consumes = getTaskConsumes(taskInfo.name);

	if (schema) {
		configs = Configuration.sort(taskInfo, rawConfig, parentConfig, schema);
	} else {
		configs = Configuration.sort_deprecated(rawConfig, parentConfig, consumes);
	}

	if (Configuration.isDisabled(configs.taskInfo)) {
		return null;
	}

	runner = this.runnerFactory.create(prefix, configs, this.multiple.bind(this));
	task = this.create(prefix, taskInfo, configs.taskConfig, runner);
	if (Configuration.isVisible(task)) {
		// TODO: call parallel for depends and then remove it from taskConfig.
		if (this.gulpTaskRegistry) {
			this.gulpTaskRegistry.register(task, configs.taskInfo.depends);
		}
	}

	function getTaskSchema(name) {
		var configurableTask = stuff.streams.lookup(name) || stuff.recipes.lookup(name);
		return configurableTask && configurableTask.schema;
	}

	function getTaskConsumes(name) {
		var configurableTask = stuff.streams.lookup(name) || stuff.recipes.lookup(name);
		return configurableTask && configurableTask.consumes;
	}
};

ConfigurableTaskFactory.prototype.multiple = function(prefix, subTaskConfigs, parentConfig) {
	var self, tasks = [];

	self = this;

	Object.keys(subTaskConfigs).forEach(function (name) {
		var task = self.one(prefix, name, subTaskConfigs[name], parentConfig);
		if (task) {
			tasks.push(task);
		}
	});
	return tasks;
};

// TODO: make sure config is inherited at config time and injectable at runtime.
ConfigurableTaskFactory.prototype.create = function(prefix, taskInfo, taskConfig, configurableRunner) {
	// invoked from stream processor
	var run = function(gulp, injectConfig, stream, done) {
		// inject and realize runtime configuration.
		// TODO: let json-normalizer add defaults.
		var config = Configuration.realize(taskConfig, injectConfig, configurableRunner.defaults);
		return configurableRunner(gulp, config, stream, done);
	};
	// invoked from gulp
	var configurableTask = function(done) {
		return run(this, taskConfig, null, done);
	};
	configurableTask.displayName = prefix + taskInfo.name;
	configurableTask.description = taskInfo.description || configurableRunner.description;
	configurableTask.visibility = taskInfo.visibility;
	configurableTask.runtime = taskInfo.runtime;
	configurableTask.run = run;
	configurableTask.config = taskConfig;
	return configurableTask;
};

module.exports = ConfigurableTaskFactory;
