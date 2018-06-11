var async = require('async');
var _ = require('underscore');
var noop = function(){};
var logPrefix = '[nodebb-plugin-import-rpa]';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var UserSchema = require('./models/user');
var ForumSchema = require('./models/forum');

var User;
var Forum;

(function(Exporter) {

    Exporter.setup = function(config, callback) {
        Exporter.log('setup');

        var _config = {
            host: ( config.dbhost || config.host || 'localhost' ),
            user: config.dbuser || config.user || '',
            pass: config.dbpass || config.pass || config.password || '',
            port: config.dbport || config.port || 27017,
            dbName: config.dbname || config.name || config.database || '',
            bufferCommands: false
        };

        if ( _config.user === "" && _config.pass === "" && _config.port === "27017" && _config.dbName === "" ) {
            _config = {
                host: _config.host,
                bufferCommands: _config.bufferCommands
            };
        }

        Exporter.config( _config );

        //Connect to MongoDB
        Exporter.log('connecting...');
        mongoose.connect( "mongodb://" + _config.host + ":" + _config.port, _config,
            function( err ) {
                if( err ) {
                    err.error = 'No database connection';
                    Exporter.error( err.error );
                    return callback( err );
                } else {
                    Exporter.connection = mongoose.connection;
                    Exporter.log( "Creating models..." );
                    User = Exporter.connection.model('User', UserSchema, 'User');
                    Forum = Exporter.connection.model('Forum', ForumSchema, 'forum');
                    callback( null, Exporter.config() );
                }
            }
        );
    };

    Exporter.getUsers = function(callback) {
        return Exporter.getPaginatedUsers(0, null, callback);
    };

    Exporter.getPaginatedUsers = function(start, limit, callback) {
        callback = !_.isFunction(callback) ? noop : callback;

        var err, map = {};

        if (!Exporter.connection) {
            err = {error: 'Connection not setup!'};
            Exporter.error(err.error);
            return callback(err);
        }
        var query = User.find( {}, function( err, users ) {
            Exporter.log( "Exporting " + users.length + " users." );
            async.each( users, function( user, callback ) {
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
                            adr = user.organization.formatted_address.split( ", " );
                            if ( adr.length === 4 && adr[3] === "USA" ) {
                                location += ', ' + adr[1] + ', ' + adr[2].split( " " )[0] + ', ' + adr[3];
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
                    "_username": user.first_name + " " + user.last_name, // REQUIRED
                    "_fullname": user.first_name + " " + user.last_name, // OPTIONAL, defaults to ''
                    "_location": location, // OPTIONAL, defaults to ''
                    "_showemail": 0 // OPTIONAL, defaults to 0
                };
                callback();
            }, function() {
                callback(null, map);
            } );

        } ).skip( start );
        if( limit ) query.limit( limit );
    };

    var cid;
    Exporter.getCategories = function(callback) {
    //     return Exporter.getPaginatedCategories(0, null, callback);
    // };
    //
    //
    // Exporter.getPaginatedCategories = function(start, limit, callback) {
        callback = !_.isFunction(callback) ? noop : callback;

        var err, map;

		if (!Exporter.connection) {
			err = {error: 'MySQL connection is not setup. Run setup(config) first'};
			Exporter.error(err.error);
			return callback(err);
		}

        cid = new mongoose.Types.ObjectId;

        map = {};
        map[ cid ] = {
            "_cid": cid, // REQUIRED
            "_name": "General Discussion 2", // REQUIRED
            "_description": "A place to talk about whatever you want" // OPTIONAL
        };

        console.log( map );
        callback( null, map );
    };

    Exporter.getTopics = function(callback) {
        return Exporter.getPaginatedTopics(0, null, callback);
    };
    Exporter.getPaginatedTopics = function(start, limit, callback) {
        callback = !_.isFunction(callback) ? noop : callback;

        var err, map = {};

        if (!Exporter.connection) {
            err = {error: 'Connection not setup!'};
            Exporter.error(err.error);
            return callback(err);
        }
        var query = Forum.find( {}, function( err, forums ) {
            Exporter.log( "Exporting " + forums.length + " topics." );
            async.each( forums, function( forum, callback ) {
                var comment = forum.comments.length > 0 ? forum.comments[0].comment : "";
                map[ forum._id ] = {
                    "_tid": forum._id, // REQUIRED, THE OLD TOPIC ID
                    "_uid": forum.author, // OPTIONAL, THE OLD USER ID, Nodebb will create the topics for user 'Guest' if not provided
                    "_cid": cid, // REQUIRED, THE OLD CATEGORY ID
                    "_title": forum.title, // OPTIONAL, defaults to "Untitled :id"
                    "_content": comment, // REQUIRED
                    "_timestamp": forum.date.getTime() // OPTIONAL, [UNIT: Milliseconds], defaults to current, but what's the point of migrating if you dont preserve dates
                };
                callback();
            }, function () {
                callback(null, map);
            } );
        } ).skip( start );
        if( limit ) query.limit( limit );
    };

    Exporter.getPosts = function(callback) {
        return Exporter.getPaginatedPosts(0, null, callback);
    };
    Exporter.getPaginatedPosts = function(start, limit, callback) {
        callback = !_.isFunction(callback) ? noop : callback;

        var err, map = {}, id = 0, comment;

        if ( !Exporter.connection ) {
            err = {error: 'Connection not setup!'};
            Exporter.error(err.error);
            return callback(err);
        }

        var query = Forum.find( {}, function( err, forums ) {
            async.each( forums, function( forum, callback ) {
                for( var i = 1; i < forum.comments.length; i ++ ) {
                    comment = forum.comments[i];
                    map[ id ] = {
                        "_pid": id, // REQUIRED, OLD POST ID
                        "_tid": forum._id, // REQUIRED, OLD TOPIC ID
                        "_content": comment.comment, // REQUIRED
                        "_uid": comment.user, // OPTIONAL, OLD USER ID, if not provided NodeBB will create under the "Guest" username, unless _guest is passed.
                        "_timestamp": comment.date.getTime() // OPTIONAL, [UNIT: Milliseconds], defaults to current, but what's the point of migrating if you dont preserve dates
                    };
                    id ++;
                }
                callback();
            }, function () {
                callback(null, map);
            } );
        } ).skip( start );
        if( limit ) query.limit( limit );
    };

    Exporter.teardown = function(callback) {
        Exporter.log('Teardown!');
        mongoose.disconnect().then( function () {
            Exporter.log('Done');
            callback();
        } );
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

	Exporter.getMessages = function(callback) {
		return Exporter.getPaginatedMessages(0, -1, callback);
	};
	Exporter.getPaginatedMessages = function(start, limit, callback) {
	    callback( null, {} );
    };
	Exporter.getGroups = function(callback) {
		return Exporter.getPaginatedGroups(0, -1, callback);
	};
	Exporter.getPaginatedGroups = function(start, limit, callback) {
	    callback( null, {} );
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
        if (typeof str !== 'string') return str;
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


//    TESTING
//     var testConfig = { testing: true };
//
//     Exporter.testrun( testConfig, function ( err ) {
//         if ( err )
//             Exporter.warn( err.error );
//         else
//             Exporter.log( "Completed with no reported errors." );
//     } );



})(module.exports);

