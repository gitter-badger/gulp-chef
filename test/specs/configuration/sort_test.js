'use strict';

var Sinon = require('sinon');
var expect = require('chai').expect;
var test = require('mocha-cases');

var _ = require('lodash');

var base = process.cwd();

var sort = require(base + '/lib/configuration/sort');

describe('Core', function () {
	describe('Configuration', function () {
		describe('.sort()', function () {
			it('should accept empty config', function () {
				var actual;

				actual = sort({}, {}, {}, {});
				expect(actual).to.deep.equal({
					taskInfo: {},
					taskConfig: {},
					subTaskConfigs: {}
				});
			});
			it('should always accept src and dest property even schema not defined', function () {
				var config = {
					src: 'src',
					dest: 'dist'
				};
				var actual, original;

				original = _.cloneDeep(config);
				actual = sort({}, config, {}, {});
				expect(actual).to.deep.equal({
					taskInfo: {},
					taskConfig: {
						src: {
							globs: ['src']
						},
						dest: {
							path: 'dist'
						}
					},
					subTaskConfigs: {}
				});
				expect(config).to.deep.equal(original);
			});
			it('should only include reservied properties if schema not defined', function () {
				var config = {
					src: 'src',
					dest: 'dist',
					blabla: ['bla', 'bla'],
					foo: false,
					bar: { name: 'bar' }
				};
				var actual, original;

				original = _.cloneDeep(config);
				actual = sort({}, config, {}, null);
				expect(actual).to.deep.equal({
					taskInfo: {},
					taskConfig: {
						src: {
							globs: ['src']
						},
						dest: {
							path: 'dist'
						}
					},
					subTaskConfigs: {
						blabla: ['bla', 'bla'],
						foo: false,
						bar: {
							name: 'bar'
						}
					}
				});
				expect(config).to.deep.equal(original);
			});
			it('should inherit parent config', function () {
				var config = {
					src: {
						globs: ['src']
					},
					dest: {
						path: 'dist'
					}
				};
				var actual, original;

				original = _.cloneDeep(config);
				actual = sort({}, {}, config, {});
				expect(actual).to.deep.equal({
					taskInfo: {},
					taskConfig: {
						src: {
							globs: ['src']
						},
						dest: {
							path: 'dist'
						}
					},
					subTaskConfigs: {}
				});
				expect(config).to.deep.equal(original);
			});
			it('should join parent path config', function () {
				var config = {
					src: ['services/**/*.js', 'views/**/*.js'],
					dest: 'lib'
				};
				var parent = {
					src: {
						globs: ['src']
					},
					dest: {
						path: 'dist'
					}
				};
				var actual, original, originalParent;

				original = _.cloneDeep(config);
				originalParent = _.cloneDeep(parent);
				actual = sort({}, config, parent, {});
				expect(actual).to.deep.equal({
					taskInfo: {},
					taskConfig: {
						src: {
							globs: ['src/services/**/*.js', 'src/views/**/*.js']
						},
						dest: {
							path: 'dist/lib'
						}
					},
					subTaskConfigs: {}
				});
				expect(config).to.deep.equal(original);
				expect(parent).to.deep.equal(originalParent);
			});
			it('should not join parent path config if said so', function () {
				var config = {
					src: {
						globs: ['services/**/*.js', 'views/**/*.js'],
						options: {
							join: false
						}
					},
					dest: {
						path: 'lib',
						options: {
							join: false
						}
					}
				};
				var parent = {
					src: {
						globs: ['src']
					},
					dest: {
						path: 'dist'
					}
				};
				var actual, original, originalParent;

				original = _.cloneDeep(config);
				originalParent = _.cloneDeep(parent);
				actual = sort({}, config, parent, {});
				expect(actual).to.deep.equal({
					taskInfo: {},
					taskConfig: {
						src: {
							globs: ['services/**/*.js', 'views/**/*.js']
						},
						dest: {
							path: 'lib'
						}
					},
					subTaskConfigs: {}
				});
				expect(config).to.deep.equal(original);
				expect(parent).to.deep.equal(originalParent);
			});
			it('should put unknown properties to subTaskConfigs', function () {
				var config = {
					src: ['services/**/*.js', 'views/**/*.js'],
					dest: 'lib',
					bundles: {
						entries: ['a', 'b', 'c']
					},
					options: {
						extensions: ['.js', '.ts', '.coffee']
					},
					unknownProperty: 'what?'
				};
				var parent = {
					src: {
						globs: ['src']
					},
					dest: {
						path: 'dist'
					}
				};
				var schema = {
					properties: {
						bundles: {
							properties: {
								entries: {}
							}
						},
						options: {
						}
					}
				};
				var actual, original, originalParent;

				original = _.cloneDeep(config);
				originalParent = _.cloneDeep(parent);
				actual = sort({}, config, parent, schema);

				original = _.cloneDeep(config);
				expect(actual).to.deep.equal({
					taskInfo: {},
					taskConfig: {
						src: {
							globs: ['src/services/**/*.js', 'src/views/**/*.js']
						},
						dest: {
							path: 'dist/lib'
						},
						bundles: {
							entries: ['a', 'b', 'c']
						},
						options: {
							extensions: ['.js', '.ts', '.coffee']
						}
					},
					subTaskConfigs: {
						unknownProperty: 'what?'
					}
				});
				expect(config).to.deep.equal(original);
				expect(parent).to.deep.equal(originalParent);
			});
			it('should extract title and description from schema if available', function () {
				var schema = {
					title: 'schema-extractor',
					description: 'extract title and description from schema if available'
				};

				expect(sort({}, {}, {}, schema)).to.deep.equal({
					taskInfo: {
						name: 'schema-extractor',
						description: 'extract title and description from schema if available'
					},
					taskConfig: {},
					subTaskConfigs: {}
				});
			});
			it('should normalize config using the given schema', function () {
				var schema = {
					definitions: {
						options: {
							properties: {
								extensions: {
									description: '',
									alias: ['extension'],
									type: 'array',
									items: {
										type: 'string'
									}
								},
								require: {
									description: '',
									alias: ['requires'],
									type: 'array',
									items: {
										type: 'string'
									}
								},
								external: {
									description: '',
									alias: ['externals'],
									type: 'array',
									items: {
										type: 'string'
									}
								},
								plugin: {
									description: '',
									alias: ['plugins'],
									type: 'array',
									items: {
										type: 'string'
									}
								},
								transform: {
									description: '',
									alias: ['transforms'],
									type: 'array',
									items: {
										type: 'string'
									}
								},
								exclude: {
									description: '',
									alias: ['excludes'],
									type: 'array',
									items: {
										type: 'string'
									}
								},
								ignore: {
									description: '',
									alias: ['ignores'],
									type: 'array',
									items: {
										type: 'string'
									}
								},
								shim: {
									description: 'which library to shim?',
									alias: ['shims', 'browserify-shim', 'browserify-shims'],
									type: 'array',
									items: {
										type: 'string'
									}
								},
								sourcemap: {
									description: 'generate sourcemap file or not?',
									alias: ['sourcemaps'],
									enum: [
										'inline', 'external', false
									],
									default: false
								}
							}
						}
					},
					properties: {
						options: {
							description: 'common options for all bundles',
							type: 'object',
							extends: { $ref: '#/definitions/options' }
						},
						bundles: {
							description: '',
							alias: ['bundle'],
							type: 'array',
							items: {
								type: 'object',
								extends: { $ref: '#/definitions/options' },
								properties: {
									file: {
										description: '',
										type: 'string'
									},
									entries: {
										description: '',
										alias: ['entry'],
										type: 'array',
										items: {
											type: 'string'
										}
									},
									options: {
										description: 'options for this bundle',
										type: 'object',
										extends: { $ref: '#/definitions/options' }
									}
								},
								required: ['file', 'entries']
							}
						}
					},
					required: ['bundles']
				};
				var options = {
					extensions: ['.js', '.json', '.jsx', '.es6', '.ts'],
					plugin: ['tsify'],
					transform: ['brfs']
				};
				var config = {
					bundles: [{
						file: 'deps.js',
						entries: [{
							file: 'traceur/bin/traceur-runtime'
						}, {
							file: 'rtts_assert/rtts_assert'
						}, {
							file: 'reflect-propertydata'
						}, {
							file: 'zone.js'
						}],
						require: ['angular2/angular2', 'angular2/router']
					}, {
						file: 'services.js',
						entry: 'services/*/index.js',
						external: ['angular2/angular2', 'angular2/router'],
						options: options
					}, {
						file: 'index.js',
						entry: 'index.js',
						external: './services',
						options: options
					}, {
						file: 'auth.js',
						entry: 'auth/index.js',
						external: './services',
						options: options
					}, {
						file: 'dashboard.js',
						entry: 'dashboard/index.js',
						external: './services',
						options: options
					}]
				};
				var expected = {
					bundles: [{
						file: 'deps.js',
						entries: [{
							file: 'traceur/bin/traceur-runtime'
						}, {
							file: 'rtts_assert/rtts_assert'
						}, {
							file: 'reflect-propertydata'
						}, {
							file: 'zone.js'
						}],
						require: ['angular2/angular2', 'angular2/router']
					}, {
						file: 'services.js',
						entries: ['services/*/index.js'],
						external: ['angular2/angular2', 'angular2/router'],
						options: options
					}, {
						file: 'index.js',
						entries: ['index.js'],
						external: ['./services'],
						options: options
					}, {
						file: 'auth.js',
						entries: ['auth/index.js'],
						external: ['./services'],
						options: options
					}, {
						file: 'dashboard.js',
						entries: ['dashboard/index.js'],
						external: ['./services'],
						options: options
					}]
				};
				var actual, original;

				original = _.cloneDeep(config);
				actual = sort({}, config, {}, schema);
				expect(actual).to.deep.equal({
					taskInfo: {},
					taskConfig: expected,
					subTaskConfigs: {
					}
				});
				expect(config).to.deep.equal(original);
			});
		});
	});
});
