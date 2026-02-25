const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');

module.exports = function(passport) {
  passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) return done(null, false, { message: 'No account found with that email address.' });
      if (user.isBanned) return done(null, false, { message: `Account suspended: ${user.banReason || 'Contact support.'}` });
      if (!user.isActive) return done(null, false, { message: 'Account is inactive. Please contact support.' });
      
      const match = await user.comparePassword(password);
      if (!match) return done(null, false, { message: 'Incorrect password. Please try again.' });

      user.lastLogin = new Date();
      await user.save();
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }));

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
};
