const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');

module.exports = function (passport) {
  passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      console.log('--- Login Attempt ---');
      console.log('Email:', email);
      const user = User.findByEmail(email.toLowerCase());

      if (!user) {
        console.log('Status: User not found in database');
        return done(null, false, { message: 'No account found with that email.' });
      }

      console.log('Status: User found. ID:', user.id, 'Role:', user.role);

      if (user.is_banned) {
        console.log('Status: User is banned');
        return done(null, false, { message: `Account suspended: ${user.ban_reason || 'Contact support.'}` });
      }

      if (!user.is_active) {
        console.log('Status: User is inactive');
        return done(null, false, { message: 'Account is inactive. Contact support.' });
      }

      const isMatch = await User.comparePassword(password, user.password);
      console.log('Status: Password match result:', isMatch);

      if (!isMatch) {
        return done(null, false, { message: 'Incorrect password.' });
      }

      console.log('Status: Login successful');
      User.updateLastLogin(user.id);
      return done(null, User.serialize(user));
    } catch (err) {
      console.error('Login Error:', err);
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
