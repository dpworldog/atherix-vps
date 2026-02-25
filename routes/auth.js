const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/User');
const { ensureGuest } = require('../middleware/auth');

// Login page
router.get('/login', ensureGuest, (req, res) => {
  res.render('auth/login', {
    title: 'Login - AtherixCloud',
    messages: { error: req.flash('error'), success: req.flash('success') }
  });
});

// Register page
router.get('/register', ensureGuest, (req, res) => {
  res.render('auth/register', {
    title: 'Register - AtherixCloud',
    messages: { error: req.flash('error'), success: req.flash('success') }
  });
});

// Login POST
router.post('/login', ensureGuest, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      req.flash('error', info.message);
      return res.redirect('/auth/login');
    }
    req.logIn(user, (err) => {
      if (err) return next(err);
      return res.redirect('/dashboard');
    });
  })(req, res, next);
});

// Register POST
router.post('/register', ensureGuest, async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    req.flash('error', 'Passwords do not match.');
    return res.redirect('/auth/register');
  }
  if (password.length < 8) {
    req.flash('error', 'Password must be at least 8 characters.');
    return res.redirect('/auth/register');
  }

  if (email.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase()) {
    req.flash('error', 'This email is not available.');
    return res.redirect('/auth/register');
  }

  try {
    const existing = User.findByEmailOrUsername(email, username);
    if (existing) {
      req.flash('error', 'Email or username already in use.');
      return res.redirect('/auth/register');
    }

    User.create({ username, email, password, role: 'user' });
    req.flash('success', 'Account created! Please log in.');
    res.redirect('/auth/login');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Registration failed. Please try again.');
    res.redirect('/auth/register');
  }
});

// Logout
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash('success', 'Logged out successfully.');
    res.redirect('/auth/login');
  });
});

module.exports = router;
