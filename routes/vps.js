const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const VPS = require('../models/VPS');
const lxc = require('../config/lxc');

// List all VPS for logged-in user
router.get('/', ensureAuthenticated, (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const vpsList = VPS.findByOwner(userId);
    res.render('user/vps-list', {
      title: 'My VPS - AtherixCloud',
      user: req.user,
      vpsList,
      messages: { error: req.flash('error'), success: req.flash('success') }
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load VPS list.');
    res.redirect('/dashboard');
  }
});

// VPS Detail
router.get('/:id', ensureAuthenticated, (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const vps = VPS.findOne({ id: parseInt(req.params.id), owner_id: userId });
    if (!vps) {
      req.flash('error', 'VPS not found.');
      return res.redirect('/vps');
    }
    res.render('user/vps-detail', {
      title: `${vps.name} - AtherixCloud`,
      user: req.user,
      vps,
      messages: { error: req.flash('error'), success: req.flash('success') }
    });
  } catch (err) {
    req.flash('error', 'Failed to load VPS details.');
    res.redirect('/vps');
  }
});

// Start VPS
router.post('/:id/start', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const vps = VPS.findOne({ id: parseInt(req.params.id), owner_id: userId });
    if (!vps) return res.json({ success: false, message: 'VPS not found' });
    const result = await lxc.startContainer(vps.containerId);
    if (result.success) {
      VPS.update(vps.id, { status: 'running', last_action: new Date().toISOString() });
      return res.json({ success: true, message: 'VPS started successfully' });
    }
    res.json({ success: false, message: result.error || 'Failed to start VPS' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Stop VPS
router.post('/:id/stop', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const vps = VPS.findOne({ id: parseInt(req.params.id), owner_id: userId });
    if (!vps) return res.json({ success: false, message: 'VPS not found' });
    const result = await lxc.stopContainer(vps.containerId);
    if (result.success) {
      VPS.update(vps.id, { status: 'stopped', last_action: new Date().toISOString() });
      return res.json({ success: true, message: 'VPS stopped successfully' });
    }
    res.json({ success: false, message: result.error || 'Failed to stop VPS' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Restart VPS
router.post('/:id/restart', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const vps = VPS.findOne({ id: parseInt(req.params.id), owner_id: userId });
    if (!vps) return res.json({ success: false, message: 'VPS not found' });
    const result = await lxc.restartContainer(vps.containerId);
    if (result.success) {
      VPS.update(vps.id, { status: 'running', last_action: new Date().toISOString() });
      return res.json({ success: true, message: 'VPS restarted successfully' });
    }
    res.json({ success: false, message: result.error || 'Failed to restart VPS' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

module.exports = router;
