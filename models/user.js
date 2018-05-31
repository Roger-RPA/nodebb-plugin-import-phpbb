var mcapi = require( 'mailchimp-api/mailchimp' );
var mc = new mcapi.Mailchimp( process.env.MAILCHIMP_PRIVATE_KEY );

var mongoose = require('mongoose'),
    sha1 = require('sha1'),
    Schema = mongoose.Schema;

var UserSchema = new Schema({
    first_name: String,
    last_name: String,
    username: {
        type: String,
        trim: true,
        set: function( username ) {                 // save the previous value of the email address
            this.oldUsername = this.username;       // so that we can use it to identify the user with MailChimp
            return username;                        // when updating their email address.
        }
    },
    password: String,
    web_address: String,
    organization: Object,
    hide_organization: Boolean,
    active: Boolean,
    admin: Boolean,
    stripe: {
        customer: Object,
        subscription: Object
    },
    expires: Date,
    expired: Boolean,
    resetPasswordToken: String,
    resetPasswordExpires: Date
});

UserSchema.virtual('fullName').get(function() {
    return this.first_name + ' ' + this.last_name;
});

UserSchema.virtual('email_address').get(function() {
    return this.username
});

UserSchema.methods.authenticate = function(password) {
    return this.password === sha1(password);
};

UserSchema.set('toJSON', { getters: true, virtuals: true });

UserSchema.pre('save', function(next) {
    if(this.isModified('password')) {
        this.password = sha1(this.password);
    }

    next();
});

module.exports = UserSchema;