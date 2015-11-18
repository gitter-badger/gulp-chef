'use strict';
var _ = require('lodash'),
	log = require('gulp-util').log;

var Configuration = require('./configuration'),
	ConfigurationError = require('./configuration_error'),
	metadata = require('./metadata');

function ConfigurableTaskFactory(stuff, runnerFactory, registry) {
	this.stuff = stuff;
	this.runnerFactory = runnerFactory;
	this.registry = registry;
}

function buildMetadataTree(task, subTasks) {
	var nodes;

	if (subTasks) {
		nodes = subTasks.map(function(task) {
			var meta = metadata.get(task);
			return meta.tree;
		});
	} else {
		nodes = [];
	}
	metadata.set(task, task.displayName, nodes);
}

ConfigurableTaskFactory.prototype.one = function(prefix, name, rawConfig, parentConfig) {
	var self, stuff, schema, configs, taskInfo, runner, task, subTasks;

	self = this;
	stuff = this.stuff;

	taskInfo = Configuration.getTaskRuntimeInfo(name);

	if (rawConfig.debug) {
		debugger;
	}

	schema = getTaskSchema(taskInfo.name);
	configs = Configuration.sort(taskInfo, rawConfig, parentConfig, schema);

	if (Configuration.isDisabled(configs.taskInfo)) {
		return null;
	}

	runner = this.runnerFactory.create(prefix, configs, createSubTasks);
	if (! runner) {
		log("Warning: can't infer to a proper recipe task: " + taskInfo.name + ': task will do nothing.');
		runner = function(gulp, config, stream, done) { done(); };
	}
	task = this.create(prefix, taskInfo, configs.taskConfig, runner);
	buildMetadataTree(task, subTasks);
	return task;

	function getTaskSchema(name) {
		var configurableTask = stuff.streams.lookup(name) || stuff.recipes.lookup(name);
		return configurableTask && configurableTask.schema || {};
	}

	function createSubTasks(prefix, subTaskConfigs, parentConfig) {
		subTasks = self.multiple(prefix, subTaskConfigs, parentConfig);
		return subTasks;
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

ConfigurableTaskFactory.prototype.create = function(prefix, taskInfo, taskConfig, configurableRunner) {
	var registry = this.registry;
	// make sure config is inherited at config time and injected, realized at runtime.
	// invoked from stream processor
	var run = function(gulp, injectConfig, stream, done) {
		// inject and realize runtime configuration.
		// TODO: let json-normalizer add defaults.
		var config = Configuration.realize(taskConfig, injectConfig, configurableRunner.defaults);
		return configurableRunner(gulp, config, stream, done);
	};
	// invoked from gulp
	var configurableTask = function(done) {
		// NOTE: gulp 4.0 task are called on undefined context. So we need gulp reference from registry here.
		return run(registry.gulp, taskConfig, null, done);
	};
	var name = (taskInfo.name || configurableRunner.displayName || configurableRunner.name || '<anonymous>');
	configurableTask.displayName = prefix + name;
	configurableTask.description = taskInfo.description || configurableRunner.description || '';
	configurableTask.visibility = taskInfo.visibility;
	configurableTask.runtime = taskInfo.runtime;
	configurableTask.run = run;
	configurableTask.config = taskConfig;
	if (Configuration.isVisible(configurableTask)) {
		this.registry.set(configurableTask.displayName, configurableTask);
		metadata.set(configurableTask, configurableTask.displayName);
	} else {
		metadata.set(configurableTask, '<' + name + '>');
	}
	return configurableTask;
};

module.exports = ConfigurableTaskFactory;
