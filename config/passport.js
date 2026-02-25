const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');

module.exports = function (passport) {
  passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      const user = User.findByEmail(email.toLowerCase());
      if (!user) return done(null, false, { message: 'No account found with that email.' });
      if (user.is_banned) return done(null, false, { message: `Account suspended: ${user.ban_reason || 'Contact support.'}` });
      if (!user.is_active) return done(null, false, { message: 'Account is inactive. Contact support.' });

      const isMatch = await User.comparePassword(password, user.password);
      if (!isMatch) return done(null, false, { message: 'Incorrect password.' });

      User.updateLastLogin(user.id);
      return done(null, User.serialize(user));
    } catch (err) {
      return done(err);
    }
  }));

  passport.serializeUser((user, done) => done(null, user.id || user._id));
  passport.deserializeUser((id, done) => {
    try {
      const user = User.findById(id);
      done(null, user ? User.serialize(user) : null);
    } catch (err) {
      done(err);
    }
  });
};
