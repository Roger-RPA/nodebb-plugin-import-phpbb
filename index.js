var async = require('async');
var _ = require('underscore');
var noop = function(){};
var logPrefix = '[nodebb-plugin-import-rpa]';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var User = require('models/user');
var Forum = require('models/forum');

(function(Exporter) {

    Exporter.setup = function(config, callback) {
        Exporter.log('setup');

        var _config = {
            host: config.dbhost || config.host || 'localhost',
            user: config.dbuser || config.user || 'root',
            password: config.dbpass || config.pass || config.password || '',
            port: config.dbport || config.port || 3306,
            database: config.dbname || config.name || config.database || 'rpa-community'
        };

        Exporter.config(_config);
        Exporter.config('prefix', config.prefix || config.tablePrefix || '' /* phpbb_ ? */ );

        //Connect to MongoDB
        mongoose.connected( _config.host, function(err){
          if(err){
            var err = {error: 'No database connection'};
            Exporter.error( err.error );
            return callback(err);
          }
        });

        callback(null, Exporter.config());
    };

    Exporter.getUsers = function(callback) {
        return Exporter.getPaginatedUsers(0, -1, callback);
    };

    Exporter.getPaginatedUsers = function(start, limit, callback) {
        callback = !_.isFunction(callback) ? noop : callback;

        var err, map;

        if (!mongoose.connection) {
            err = {error: 'Connection not setup!'};
            Exporter.error(err.error);
            return callback(err);
        }

        User.find( {}, function( err, user ) {
            // Get location if any
            location = "";
            if ( user.organization ) {
                if( user.organization.organization_name ) {
                    location += user.organization.organization_name;
                    if( user.organization.organization_locality ) {
                        location += ", " + user.organization.organization_name;
                    }
                    if( user.organization.organization_country ) {
                        location += ", " + user.organization.organization_country;
                    }
                } else if( user.organization.name ) {
                    location += user.organization.name;
                    if( user.organization.formatted_address ) {
                        adr = String.split( user.organization.formatted_address, ", " );
                        if ( adr.length === 4 && adr[3] === "USA" ) {
                            location += ', ' + adr[1] + ', ' + String.split( adr[2], " " )[0] + ', ' + adr[3];
                        } else {
                            location += adr[ adr.length - 1 ];
                        }
                    }
                }
            }

            // Create the output
            map[ user._id ] = {
                "_uid": user._id, // REQUIRED
                "_email": user.username, // REQUIRED
                "_username": user.username, // REQUIRED
                // "_joindate": 1386475817370, // OPTIONAL, [UNIT: MILLISECONDS], defaults to current, but what's the point of migrating if you don't preserve dates
                "_alternativeUsername": user.first_name + " " + user.last_name, // OPTIONAL, defaults to '', some forums provide UserDisplayName, we could leverage that if the _username validation fails
                // if you would like to generate random passwords, you will need to set the config.passwordGen.enabled = true, note that this will impact performance pretty hard
                // the new passwords with the usernames, emails and some more stuff will be spit out in the logs
                // look for the [user-csv] OR [user-json] tags to grep for a list of them
                // save dem logs
                // "_password": user.password, // OPTIONAL, if you have them, or you want to generate them on your own, great, if not, all passwords will be blank
                // "_signature": "u45 signature", // OPTIONAL, defaults to '', over 150 chars will be truncated with an '...' at the end
                // "_picture": "http://images.com/derp.png", // OPTIONAL, defaults to ''. Note that, if there is an '_piçture' on the 'normalized' object, the 'imported' objected will be augmented with a key imported.keptPicture = true, so you can iterate later and check if the images 200 or 404s
                // "_pictureBlob": "...BINARY BLOB...", // OPTIONAL, defaults to null
                // "_pictureFilename": "123.png", // OPTIONAL, only applicable if using _pictureBlob, defaults to ''
                // "_path": "/myoldforum/user/123", // OPTIONAL, the old path to reach this user's page, defaults to ''
                // "_slug": "old-user-slug", // OPTIONAL
                // obviously this one depends on implementing the optional getPaginatedGroups function
                // "_groups": [123, 456, 789], // OPTIONAL, an array of old group ids that this user belongs to,
                // "_website": "u45.com", // OPTIONAL, defaults to ''
                "_fullname": user.first_name + " " + user.last_name, // OPTIONAL, defaults to ''
                // "_banned": 0, // OPTIONAL, defaults to 0
                // read cids and tids by that user, it's more efficient to use _readCids if you know that a user has read all the topics in a category.
                // "_readCids": [1, 2, 4, 5, 6, 7], // OPTIONAL, defaults to []
                // untested with very large sets. So.
                // "_readTids": [1, 2, 4, 5, 6, 7], // OPTIONAL, defaults to []
                // following other _Uids, untested with very large sets. So.
                // "_followingUids": [1, 2, 4, 5, 6, 7], // OPTIONAL, defaults to []
                // friend other _Uids, untested with very large sets. So.
                // if you have https://github.com/sanbornmedia/nodebb-plugin-friends installed or want to use it
                // "_friendsUids": [1, 2, 4, 5, 6, 7], // OPTIONAL, defaults to []
                "_location": location, // OPTIONAL, defaults to ''
                // (there is a config for multiplying these with a number for moAr karma)
                // Also, if you're implementing getPaginatedVotes, every vote will also impact the user's reputation
                // "_reputation": 123, // OPTIONAL, defaults to 0,
                // "_profileviews": 1, // OPTIONAL, defaults to 0
                // "_birthday": "01/01/1977", // OPTIONAL, [FORMAT: mm/dd/yyyy], defaults to ''
                "_showemail": 0 // OPTIONAL, defaults to 0
                // "_lastposttime": 1386475817370, // OPTIONAL, [UNIT: MILLISECONDS], defaults to current
                // "_level": "" // OPTIONAL, [OPTIONS: 'administrator' or 'moderator'], defaults to '', also note that a moderator will become a NodeBB Moderator on ALL categories at the moment.
                // "_lastonline": 1386475827370 // OPTIONAL, [UNIT: MILLISECONDS], defaults to undefined
            };

        } ).skip( req.page * perPage).limit( perPage ).then( function () {
            callback(null, map);
        });
    };

    Exporter.getCategories = function(callback) {
        return Exporter.getPaginatedCategories(0, -1, callback);
    };
    Exporter.getPaginatedCategories = function(start, limit, callback) {
        callback = !_.isFunction(callback) ? noop : callback;

        var err;
        var prefix = Exporter.config('prefix');
        var startms = +new Date();
        var query = 'SELECT '
            + prefix + 'forums.forum_id as _cid, '
            + prefix + 'forums.forum_name as _name, '
            + prefix + 'forums.forum_desc as _description '
            + 'FROM ' + prefix + 'forums '
            +  (start >= 0 && limit >= 0 ? 'LIMIT ' + start + ',' + limit : '');

        if (!Exporter.connection) {
            err = {error: 'MySQL connection is not setup. Run setup(config) first'};
            Exporter.error(err.error);
            return callback(err);
        }

        Exporter.connection.query(query,
            function(err, rows) {
                if (err) {
                    Exporter.error(err);
                    return callback(err);
                }

                //normalize here
                var map = {};
                rows.forEach(function(row) {
                    row._name = row._name || 'Untitled Category';
                    row._description = row._description || 'No decsciption available';
                    row._timestamp = ((row._timestamp || 0) * 1000) || startms;

                    map[row._cid] = row;
                });

                callback(null, map);
            });
    };

    Exporter.getTopics = function(callback) {
        return Exporter.getPaginatedTopics(0, -1, callback);
    };
    Exporter.getPaginatedTopics = function(start, limit, callback) {
        callback = !_.isFunction(callback) ? noop : callback;

        var err;
        var prefix = Exporter.config('prefix');
        var startms = +new Date();
        var query =
            'SELECT '
            + prefix + 'topics.topic_id as _tid, '
            + prefix + 'topics.forum_id as _cid, '

            // this is the 'parent-post'
            // see https://github.com/akhoury/nodebb-plugin-import#important-note-on-topics-and-posts
            // I don't really need it since I just do a simple join and get its content, but I will include for the reference
            // remember this post EXCLUDED in the exportPosts() function
            + prefix + 'topics.topic_first_post_id as _pid, '

            + prefix + 'topics.topic_views as _viewcount, '
            + prefix + 'topics.topic_title as _title, '
            + prefix + 'topics.topic_time as _timestamp, '

            // maybe use that to skip
            + prefix + 'topics.topic_approved as _approved, '

            + prefix + 'topics.topic_status as _status, '

            //+ prefix + 'TOPICS.TOPIC_IS_STICKY as _pinned, '
            + prefix + 'posts.poster_id as _uid, '
            // this should be == to the _tid on top of this query
            + prefix + 'posts.topic_id as _post_tid, '

            // and there is the content I need !!
            + prefix + 'posts.post_text as _content '

            + 'FROM ' + prefix + 'topics, ' + prefix + 'posts '
            // see
            + 'WHERE ' + prefix + 'topics.topic_first_post_id=' + prefix + 'posts.post_id '
            + (start >= 0 && limit >= 0 ? 'LIMIT ' + start + ',' + limit : '');


        if (!Exporter.connection) {
            err = {error: 'MySQL connection is not setup. Run setup(config) first'};
            Exporter.error(err.error);
            return callback(err);
        }

        Exporter.connection.query(query,
            function(err, rows) {
                if (err) {
                    Exporter.error(err);
                    return callback(err);
                }

                //normalize here
                var map = {};
                rows.forEach(function(row) {
                    row._title = row._title ? row._title[0].toUpperCase() + row._title.substr(1) : 'Untitled';
                    row._timestamp = ((row._timestamp || 0) * 1000) || startms;

                    map[row._tid] = row;
                });

                callback(null, map);
            });
    };

	var getTopicsMainPids = function(callback) {
		if (Exporter._topicsMainPids) {
			return callback(null, Exporter._topicsMainPids);
		}
		Exporter.getPaginatedTopics(0, -1, function(err, topicsMap) {
			if (err) return callback(err);

			Exporter._topicsMainPids = {};
			Object.keys(topicsMap).forEach(function(_tid) {
				var topic = topicsMap[_tid];
				Exporter._topicsMainPids[topic.topic_first_post_id] = topic._tid;
			});
			callback(null, Exporter._topicsMainPids);
		});
	};
    Exporter.getPosts = function(callback) {
        return Exporter.getPaginatedPosts(0, -1, callback);
    };
    Exporter.getPaginatedPosts = function(start, limit, callback) {
        callback = !_.isFunction(callback) ? noop : callback;

        var err;
        var prefix = Exporter.config('prefix');
        var startms = +new Date();
        var query =
            'SELECT ' + prefix + 'posts.post_id as _pid, '
            //+ 'POST_PARENT_ID as _post_replying_to, ' phpbb doesn't have "reply to another post"
            + prefix + 'posts.topic_id as _tid, '
            + prefix + 'posts.post_time as _timestamp, '
            // not being used
            + prefix + 'posts.post_subject as _subject, '

            + prefix + 'posts.post_text as _content, '
            + prefix + 'posts.poster_id as _uid, '

            // maybe use this one to skip
            + prefix + 'posts.post_approved as _approved '

            + 'FROM ' + prefix + 'posts '

		    // the ones that are topics main posts are filtered below
            + 'WHERE ' + prefix + 'posts.topic_id > 0 '
            + (start >= 0 && limit >= 0 ? 'LIMIT ' + start + ',' + limit : '');

        if (!Exporter.connection) {
            err = {error: 'MySQL connection is not setup. Run setup(config) first'};
            Exporter.error(err.error);
            return callback(err);
        }

		Exporter.connection.query(query,
			function (err, rows) {
				if (err) {
					Exporter.error(err);
					return callback(err);
				}
				getTopicsMainPids(function(err, mpids) {
					//normalize here
					var map = {};
					rows.forEach(function (row) {
						// make it's not a topic
						if (! mpids[row._pid]) {
							row._content = row._content || '';
							row._timestamp = ((row._timestamp || 0) * 1000) || startms;
							map[row._pid] = row;
						}
					});

					callback(null, map);
				});
			});

    };

    Exporter.teardown = function(callback) {
        Exporter.log('teardown');
        Exporter.connection.end();

        Exporter.log('Done');
        callback();
    };

    Exporter.testrun = function(config, callback) {
        async.series([
            function(next) {
                Exporter.setup(config, next);
            },
            function(next) {
                Exporter.getUsers(next);
            },
            function(next) {
                Exporter.getCategories(next);
            },
            function(next) {
                Exporter.getTopics(next);
            },
            function(next) {
                Exporter.getPosts(next);
            },
            function(next) {
                Exporter.teardown(next);
            }
        ], callback);
    };
    
    Exporter.paginatedTestrun = function(config, callback) {
        async.series([
            function(next) {
                Exporter.setup(config, next);
            },
            function(next) {
                Exporter.getPaginatedUsers(0, 1000, next);
            },
            function(next) {
                Exporter.getPaginatedCategories(0, 1000, next);
            },
            function(next) {
                Exporter.getPaginatedTopics(0, 1000, next);
            },
            function(next) {
                Exporter.getPaginatedPosts(1001, 2000, next);
            },
            function(next) {
                Exporter.teardown(next);
            }
        ], callback);
    };

    Exporter.warn = function() {
        var args = _.toArray(arguments);
        args.unshift(logPrefix);
        console.warn.apply(console, args);
    };

    Exporter.log = function() {
        var args = _.toArray(arguments);
        args.unshift(logPrefix);
        console.log.apply(console, args);
    };

    Exporter.error = function() {
        var args = _.toArray(arguments);
        args.unshift(logPrefix);
        console.error.apply(console, args);
    };

    Exporter.config = function(config, val) {
        if (config != null) {
            if (typeof config === 'object') {
                Exporter._config = config;
            } else if (typeof config === 'string') {
                if (val != null) {
                    Exporter._config = Exporter._config || {};
                    Exporter._config[config] = val;
                }
                return Exporter._config[config];
            }
        }
        return Exporter._config;
    };

    // from Angular https://github.com/angular/angular.js/blob/master/src/ng/directive/input.js#L11
    Exporter.validateUrl = function(url) {
        var pattern = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/;
        return url && url.length < 2083 && url.match(pattern) ? url : '';
    };

    Exporter.truncateStr = function(str, len) {
        if (typeof str != 'string') return str;
        len = _.isNumber(len) && len > 3 ? len : 20;
        return str.length <= len ? str : str.substr(0, len - 3) + '...';
    };

    Exporter.whichIsFalsy = function(arr) {
        for (var i = 0; i < arr.length; i++) {
            if (!arr[i])
                return i;
        }
        return null;
    };

})(module.exports);
