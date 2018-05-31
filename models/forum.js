var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var ForumSchema = new Schema({
        title: String,
        author: Object,
        comments: Object,
        subscribers: Array,
        date: Date
    });

ForumSchema.statics.getAll = function(callback) {
    this.find({}, callback).sort([['date', -1]]);
};

ForumSchema.statics.getOne = function(id, callback) {
    this.findOne({_id: id}, callback);
};

ForumSchema.statics.addForumReply = function(id, user, comment, callback) {
    this.update({_id: id}, {$push: {comments: {user: user, comment: comment, date: new Date()}}}, callback);
};

ForumSchema.statics.addSubscriber = function(id, user, callback) {
    this.update({_id: id}, {$addToSet:{subscribers: user}}, callback);
};

ForumSchema.statics.removeSubscriber = function(id, user, callback) {
    this.update({_id: id}, {$pull:{subscribers: user}}, callback);
};

module.exports = ForumSchema;