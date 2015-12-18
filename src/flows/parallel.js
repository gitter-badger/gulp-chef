/* eslint consistent-this: 0 */
'use strict';

/**
 * Recipe:
 * parallel
 *
 * Ingredients:
 * async, asnyc-done
 *
 * Note:
 *  Some kind of non-stream version of merge() stream recipe.
 *
 * @param done
 */
function parallel(done) {
	var context;

	var async = require('async');
	var asyncDone = require('async-done');

	context = this;
	async.map(this.tasks, function (task, itemDone) {
		asyncDone(function (taskDone) {
			return task.run.call(context, taskDone);
		}, itemDone);
	}, done);
}

parallel.schema = {
	title: 'parallel',
	description: 'Run the tasks array of functions in parallel, without waiting until the previous function has completed.',
	type: 'object',
	properties: {}
};

parallel.type = 'flow';

module.exports = parallel;
