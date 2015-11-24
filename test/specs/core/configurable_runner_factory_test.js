'use strict';

var Sinon = require('sinon'),
	Chai = require('chai'),
	expect = Chai.expect;

var _ = require('lodash');

var base = process.cwd();

var ConfigurableTaskRunnerFactory = require(base + '/src/core/configurable_runner_factory'),
	ConfigurationError = require(base + '/src/core/configuration_error');

var FakeGulp = require(base + '/test/fake/gulp');

function createSpyGulpTask(name, gulpTask) {
	var task = Sinon.spy(gulpTask);
	task.displayName = name;
	return task;
}

function createSpyConfigurableTask(name, configurableRunner, taskConfig) {
	var run, task;
	configurableRunner = configurableRunner || Sinon.spy();
	taskConfig = taskConfig || {};
	run = Sinon.spy(function (gulp, config, stream, done) {
		config = _.defaultsDeep([], taskConfig, config);
		configurableRunner(gulp, config, stream, done);
	});
	task = createSpyGulpTask(name, function (done) {
		run(this, taskConfig, null, done);
	});
	task.run = run;
	return task;
}

var createFakeStuff = require(base + '/test/fake/stuff');

describe('Core', function () {
	describe('ConfigurableTaskRunnerFactory', function () {
		var gulp, factory, stuff, gulpTask, subTasks,
			configurableTask, configurableTaskConfig, configurableTaskRefConfig,
			createConfigurableTasks;

		function done(err) {
		}

		beforeEach(function () {
			stuff = createFakeStuff();
			createConfigurableTasks = Sinon.spy(function (prefix, subTaskConfigs) {
				return subTasks = _.map(subTaskConfigs, function (config, name) {
					return createSpyConfigurableTask(name);
				});
			});
			factory = new ConfigurableTaskRunnerFactory(stuff);
			gulp = new FakeGulp();
			gulpTask = createSpyGulpTask('gulp-task');
			configurableTaskConfig = { keyword: 'configurable-task' };
			configurableTask = createSpyConfigurableTask('configurable-task', Sinon.spy(), configurableTaskConfig);
			gulp.task(gulpTask);
			gulp.task(configurableTask);
			gulp.task(createSpyGulpTask('gulp-task-by-ref'));
			configurableTaskRefConfig = { keyword: 'configurable-task-by-ref' };
			gulp.task(createSpyConfigurableTask('configurable-task-by-ref', Sinon.spy(), configurableTaskRefConfig));
		});

		describe('#recipe()', function () {
			var name = 'recipe-task',
				configs = {
					taskInfo: {
						name: name
					},
					taskConfig: {
						id: 'recipe-config'
					}
				};
			it('should create a recipe runner', function () {
				var actual = factory.recipe(name, configs);
				expect(actual).to.be.a('function');
			});
			it('should refer to correct recipe', function () {
				var actual = factory.recipe(name, configs);
				actual(gulp, configs.taskConfig, null, done);
				expect(stuff.recipes.lookup(name).called).to.be.true;
				expect(stuff.recipes.lookup(name).calledWithExactly(gulp, configs.taskConfig, null, done)).to.be.true;
			});
		});
		describe('#flow()', function () {
			describe('flexible sub-task types', function () {
				var prefix = '';

				function configs(name, subTaskConfigs, task) {
					var result = {
						taskInfo: {
							name: name
						},
						taskConfig: {
						}
					};
					if (subTaskConfigs) {
						result.subTaskConfigs = subTaskConfigs;
					} else {
						result.taskInfo.task = task;
					}
					return result;
				}

				function test(testCase) {
					it(testCase.name, function () {
						['series', 'parallel'].forEach(function (name) {
							var actual = factory.flow(prefix, configs(name, testCase.subTaskConfigs, testCase.task), createConfigurableTasks);
							expect(actual).to.be.a('function');
						});
					});
				}

				var objects = { task1: {}, task2: {} };
				var arrays = [{ name: 'task1' }, { name: 'task2' }];

				[{
					name: 'should be able to take sub-tasks as an object',
					subTaskConfigs: objects
				}, {
					name: 'should be able to take sub-tasks as an array',
					subTaskConfigs: arrays
				}, {
					name: 'should be able to take sub-tasks as an object in "task" property',
					task: objects
				}, {
					name: 'should be able to take sub-tasks as an array in "task" property',
					task: arrays
				}].forEach(test);
			});
		});
		describe('#stream()', function () {
			var prefix = '',
				configs = {
					taskInfo: {
						name: 'stream-task'
					},
					taskConfig: {
					},
					subTaskConfigs: {
						task1: {},
						task2: {}
					}
				};

			it('should create a stream runner', function () {
				var actual = factory.stream(prefix, configs, createConfigurableTasks);
				expect(actual).to.be.a('function');
			});
		});
		describe('#reference()', function () {
			it('should throw at runtime if the referring task not found', function () {
				var actual = factory.reference('non-existent');
				expect(function () { actual.call(gulp, gulp, {}, null, done); }).to.throw(ConfigurationError);
			});

			it('should wrap a normal gulp task', function () {
				var actual = factory.reference(gulpTask.displayName);
				expect(actual).to.be.a('function');
				actual(gulp, {}, null, done);
				expect(gulpTask.calledOn(gulp)).to.be.true;
				expect(gulpTask.calledWithExactly(done)).to.be.true;
			});

			it("should call target's run() at runtime if already a ConfigurableTask", function () {
				var actual = factory.reference(configurableTask.displayName);
				expect(actual).to.be.a('function');
				actual(gulp, {}, null, done);
				expect(configurableTask.run.calledOn(configurableTask)).to.be.true;
				expect(configurableTask.run.calledWithExactly(gulp, {}, null, done)).to.be.true;
			});
		});
		describe('#parallel()', function () {
			var tasks;

			beforeEach(function () {
				tasks = [
					'gulp-task-by-ref',			// reference to registered gulp task
					'configurable-task-by-ref',	// reference to registered configurable task runner
					gulpTask,					// registered gulp task
					configurableTask,			// registered configurable task runner
					Sinon.spy()					// stand-alone gulp task (not registered to gulp)
				];
			});

			it('should create a function', function () {
				var actual = factory.parallel(tasks);
				expect(actual).to.be.a('function');
			});

			it('should each tasks eventually be called when call the generated function', function () {
				var actual = factory.parallel(tasks);
				actual(gulp, {}, null, done);
				expect(gulp.task('gulp-task-by-ref').called).to.be.true;
				expect(gulp.task('configurable-task-by-ref').run.called).to.be.true;
				expect(gulpTask.called).to.be.true;
				expect(configurableTask.run.called).to.be.true;
				expect(configurableTask.run.calledWith(gulp, {}, null)).to.be.true;
			});
		});
	});
});
