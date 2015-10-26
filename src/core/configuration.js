var log = require('gulp-util').log;
var globsJoin = require('../util/glob_util').join;
var normalize = require('json-normalizer').sync;
var _ = require('lodash');

var interpolate = /{{([\s\S]+?)}}/g;

// TODO: remove temp hack for _.defaultsDeep() until bug fix public available:
// defaultsDeep() try to mix string characters into array
// https://github.com/lodash/lodash/issues/1560
_.defaultsDeep = defaultsDeep;

function defaultsDeep(object) {
	var sources = Array.prototype.splice.call(arguments, 1);
	sources.forEach(function(source) {
		_defaults(object, source);
	});
	return object;

	function _defaults(target, source) {
		_.forIn(source, function(value, key) {
			if (_.isPlainObject(value) && _.isPlainObject(target[key])) {
				_defaults(target[key], value);
			} else if (! key in target) {
				target[key] = value;
			}
		})
	}
}

function realize(original, additional, defaults) {

	var values = _.defaultsDeep({}, original, additional, defaults);

	return realizeAll({}, values);

	function realizeAll(target, source) {
		_.each(source, function(value, name) {
			target[name] = realize(value);
		});
		return target;
	}

	function realize(source) {
		if (typeof source === 'string') {
			return source.replace(interpolate, function(match, p1) {
				return values[p1] || p1;
			});
		}
		if (typeof source === 'function') {
			debugger;
			console.log('realize by fn');
			return source.call(values);
		}
		if (_.isArray(source)) {
			return realizeAll([], source);
		}
		if (_.isObject(source)) {
			return realizeAll({}, source);
		}
		return source;
	}
}

var src = normalize.bind(null, {
	"properties": {
		"globs": {
			"description": "",
			"type": "array",
			"items": {
				"type": "string"
			},
			"alias": ["glob"]
		},
		"options": {
			"description": "",
			"properties": {
				"base": {
					"description": ""
				},
				"buffer": {
					"description": ""
				},
				"read": {
					"description": ""
				}
			}
		},
		"required": ["globs"]
	},
	"primary": "globs",
	"gathering": "options"
});

var dest = normalize.bind(null, {
	"properties": {
		"path": {
			"description": ""
		},
		"options": {
			"description": "",
			"properties": {
				"cwd": {
					"description": ""
				},
				"mode": {
					"description": ""
				}
			}
		},
		"required": ["path"]
	},
	"primary": 'path',
	"gathering": 'options'
});


function sort(taskConfig, parentConfig, schema) {
	var inheritedConfig, subTaskConfigs, value;

	inheritedConfig = {};

	if (taskConfig.src) {
		value = src(taskConfig.src);
		if (parentConfig.src) {
			if (!Array.isArray(parentConfig.src.globs)) {
				throw TypeError('parentConfig.src not normalized');
			}
			value.globs = globsJoin(parentConfig.src.globs, value.globs);
		}
		inheritedConfig.src = value;
	}
	if (taskConfig.dest) {
		value = dest(taskConfig.dest);
		if (parentConfig.dest) {
			if (typeof parentConfig.dest.path !== 'string') {
				throw TypeError('parentConfig.dest not normalized');
			}
			// force dest since it may not already exists (dest must be a folder).
			value.path = globsJoin(parentConfig.dest.path, value.path, true);
		}
		inheritedConfig.dest = value;
	}

	inheritedConfig = _.defaultsDeep(inheritedConfig, taskConfig, parentConfig);
	inheritedConfig = normalize(schema, inheritedConfig);
	subTaskConfigs = inheritedConfig.others || {};
	delete inheritedConfig.others;

	return {
		taskConfig: inheritedConfig,
		subTaskConfigs: subTaskConfigs
	};
}

/**
 * If both parentConfig and taskConfig specified src property
 * then try to join paths.
 */
function sort_deprecated(taskConfig, parentConfig, consumes) {
	var inheritedConfig, subTaskConfigs, value;

	inheritedConfig = {};

	if (taskConfig.src) {
		value = src(taskConfig.src);
		if (parentConfig.src) {
			value.globs = globsJoin(parentConfig.src.globs, value.globs);
		}
		inheritedConfig.src = value;
	}
	if (parentConfig.dest && taskConfig.dest) {
		// force dest since it may not already exists (asumes dest always be a folder).
		value = dest(taskConfig.dest);
		if (parentConfig.dest) {
			value.path = globsJoin(parentConfig.dest.path, value.path);
		}
		inheritedConfig.dest = value;
	}

	inheritedConfig = _.defaultsDeep(inheritedConfig, taskConfig, parentConfig);
	inheritedConfig = _.pick(inheritedConfig, consumes);
	subTaskConfigs = _.omit(taskConfig, consumes);

	return {
		taskConfig: inheritedConfig,
		subTaskConfigs: subTaskConfigs
	};
}

module.exports = {
	dest: dest,
	normalize: normalize,
	realize: realize,
	sort_deprecated: sort_deprecated,
	sort: sort,
	src: src
};