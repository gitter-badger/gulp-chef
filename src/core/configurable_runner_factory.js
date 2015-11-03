/**
 *
 * Normal GulpTask:
 *
 * function gulpTask(done) {
 * }
 *
 *
 * ConfigurableTask:
 * (signature same as normal gulp task and can be used just as normal gulp task)
 *
 * function configurableTask(done) {
 * }
 *
 *
 * ConfigurableTask Runner:
 * ConfigurableTask Runner is called with config, and be wrapped in ConfigurableTask.run().
 *
 * configurableTask.run = function(gulp, config, stream, done) {
 * }
 *
 * configurableTask.displayName
 * configurableTask.description
 * configurableTask.schema
 *
 */
'use strict';

var _ = require('lodash');

var parallel = require('../flows/parallel');

var ConfigurableTask = require('./configurable_task');
var ConfigurationError = require('./configuration_error');


function hasSubTasks(subTaskConfigs) {
	return _.size(subTaskConfigs) > 0;
}


/**
 * A ConfigurableTaskRunnerFactory creates runner function of the following signature:
 * ```
 * function (gulp, config, stream, done)
 * ```
 * @param stuff
 * @constructor
 */
function ConfigurableTaskRunnerFactory(stuff) {
	this.stuff = stuff;
}

/**
 * if there is a matching recipe, use it and ignore any sub-configs.
 */
ConfigurableTaskRunnerFactory.prototype.recipe = function (name, configs) {
	var self = this;

	if (isRecipeTask(name)) {
		if (hasSubTasks(configs.subTaskConfigs)) {
			// TODO: warn about ignoring sub-configs.
		}
		return this.stuff.recipes.lookup(name);
	}

	function isRecipeTask(name) {
		return !!self.stuff.recipes.lookup(name);
	}
}


ConfigurableTaskRunnerFactory.prototype.stream = function (prefix, configs, createConfigurableTasks) {
	var stuff = this.stuff;

	// TODO: remove stream runner form parent's config.
	var tasks = _createSubTasks();
	return _createStreamTaskRunner(tasks);

	function _createSubTasks() {
		var hidden;

		if (stuff.streams.lookup(configs.taskInfo.name)) {
			hidden = true;
		} else {
			hidden = !!configs.taskInfo.visibility;
		}
		if (!hidden) {
			prefix = prefix + configs.taskInfo.name + ':';
		}

		return createConfigurableTasks(prefix, configs.subTaskConfigs, configs.taskConfig);
	}

	function _createStreamTaskRunner(tasks) {
		var runner = explicitRunner() || implicitRunner();
		// NOTE: important! watch the difference of signature between recipe runner and stream runner.
		return function(gulp, config, stream /*, done*/ ) {
			return runner(gulp, config, stream, tasks);
		};
	}

	function explicitRunner() {
		var runner = stuff.streams.lookup(configs.taskInfo.name);
		if (runner) {
			configs.taskInfo.visibility = ConfigurableTask.CONSTANT.VISIBILITY.HIDDEN;
			return runner;
		}
	}

	function implicitRunner() {
		return stuff.streams.lookup('merge');
	}
};

ConfigurableTaskRunnerFactory.prototype.reference = function (taskName) {
	if (typeof taskName === 'string') {
		return function (gulp, config, stream, done) {
			var task = gulp.task(taskName);
			if (!task) {
				throw new ConfigurationError(__filename, 'referring task not found: ' + taskName);
			}
			if (typeof task.run === 'function') {
				return task.run(gulp, config, stream, done);
			}
			// support for tasks registered directly via gulp.task().
			return task.call(gulp, done);
		};
	}
};

ConfigurableTaskRunnerFactory.prototype.parallel = function (tasks) {
	var self = this;

	if (Array.isArray(tasks)) {

		tasks = tasks.map(function(task) {
			if (typeof task === 'string') {
				return self.reference(task);
			} else if (typeof task === 'function') {
				if (typeof task.run === 'function') {
					return task.run;
				}
				return self.wrapper(task);
			}
			return function () {};
		});

		return function(gulp, config, stream/*, done*/) {
			// TODO: replace fake implementation
			for (var i = 0; i < tasks.length; ++i) {
				tasks[i](gulp, config, stream, done);
			}

			function done() {
			}
		};
	}
}

ConfigurableTaskRunnerFactory.prototype.wrapper = function (task) {
	if (typeof task === 'function') {
		return function(gulp, config, stream, done) {
			return task.call(gulp, done);
		};
	}
};

module.exports = ConfigurableTaskRunnerFactory;