const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const VPS = require('../models/VPS');
const Ticket = require('../models/Ticket');

router.get('/', ensureAuthenticated, (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const vpsCount = VPS.countByOwner(userId);
    const vpsRunning = VPS.countByOwnerAndStatus(userId, 'running');
    const openTickets = Ticket.countByUser(userId, ['open', 'in-progress']);
    const recentVPS = VPS.findRecent(userId, 5);
    const recentTickets = Ticket.findRecent(userId, 3);

    res.render('dashboard', {
      title: 'Dashboard - AtherixCloud',
      user: req.user,
      stats: { vpsCount, vpsRunning, openTickets },
      recentVPS,
      recentTickets,
      messages: { error: req.flash('error'), success: req.flash('success') }
    });
  } catch (err) {
    console.error(err);
    res.render('dashboard', { title: 'Dashboard', user: req.user, stats: {}, recentVPS: [], recentTickets: [], messages: {} });
  }
});

module.exports = router;
