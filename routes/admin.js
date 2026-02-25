const express = require('express');
const router = express.Router();
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');
const User = require('../models/User');
const VPS = require('../models/VPS');
const Ticket = require('../models/Ticket');
const lxc = require('../config/lxc');
const { v4: uuidv4 } = require('uuid');

// Admin Dashboard
router.get('/', ensureAuthenticated, ensureAdmin, (req, res) => {
  try {
    const totalUsers = User.countByRole('user');
    const totalVPS = VPS.countAll();
    const runningVPS = VPS.countByStatus('running');
    const openTickets = Ticket.countByStatus(['open', 'in-progress']);
    const recentUsers = User.findRecent('user', 5);
    const recentTickets = Ticket.findRecentAll(5);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard - AtherixCloud',
      user: req.user,
      stats: { totalUsers, totalVPS, runningVPS, openTickets },
      recentUsers: recentUsers.map(u => User.serialize(u)),
      recentTickets,
      messages: { error: req.flash('error'), success: req.flash('success') }
    });
  } catch (err) {
    console.error(err);
    res.render('admin/dashboard', { title: 'Admin', user: req.user, stats: {}, recentUsers: [], recentTickets: [], messages: {} });
  }
});

// ===== USER MANAGEMENT =====
router.get('/users', ensureAuthenticated, ensureAdmin, (req, res) => {
  try {
    const users = User.findAll('user').map(u => User.serialize(u));
    const userVPSCounts = {};
    for (const u of users) {
      userVPSCounts[u.id] = VPS.countByOwner(u.id);
    }
    res.render('admin/users', {
      title: 'Users - Admin',
      user: req.user,
      users,
      userVPSCounts,
      messages: { error: req.flash('error'), success: req.flash('success') }
    });
  } catch (err) {
    req.flash('error', 'Failed to load users.');
    res.redirect('/admin');
  }
});

router.post('/users/:id/suspend', ensureAuthenticated, ensureAdmin, (req, res) => {
  try {
    const targetUser = User.findById(parseInt(req.params.id));
    if (!targetUser || targetUser.role === 'admin') {
      return res.json({ success: false, message: 'Invalid user' });
    }
    const newStatus = targetUser.is_active ? 0 : 1;
    User.update(targetUser.id, { is_active: newStatus });
    res.json({ success: true, message: `User ${newStatus ? 'activated' : 'suspended'}`, isActive: !!newStatus });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.delete('/users/:id', ensureAuthenticated, ensureAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    User.delete(userId); // Cascade deletes VPS and tickets via FK
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ===== VPS MANAGEMENT =====
router.get('/vps', ensureAuthenticated, ensureAdmin, (req, res) => {
  try {
    const vpsList = VPS.findAll();
    const users = User.findAll('user').map(u => ({ id: u.id, username: u.username, email: u.email }));
    res.render('admin/vps', {
      title: 'VPS Management - Admin',
      user: req.user,
      vpsList,
      users,
      messages: { error: req.flash('error'), success: req.flash('success') }
    });
  } catch (err) {
    req.flash('error', 'Failed to load VPS.');
    res.redirect('/admin');
  }
});

// Create VPS
router.post('/vps/create', ensureAuthenticated, ensureAdmin, async (req, res) => {
  const { ownerId, name, hostname, os, osVersion, cpu, ram, disk, rootPassword, nesting, kvm, fuse, docker, notes } = req.body;

  try {
    const owner = User.findById(parseInt(ownerId));
    if (!owner) return res.json({ success: false, message: 'User not found' });

    const containerId = `atherix-${uuidv4().split('-')[0]}-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

    const features = {
      nesting: nesting === 'on' || nesting === true,
      kvm: kvm === 'on' || kvm === true,
      fuse: fuse === 'on' || fuse === true,
      docker: docker === 'on' || docker === true
    };

    const vps = VPS.create({
      name,
      ownerId: parseInt(ownerId),
      containerId,
      hostname,
      os: os || 'ubuntu',
      osVersion: osVersion || '22.04',
      cpu: parseInt(cpu) || 1,
      ram: parseInt(ram) || 512,
      disk: parseInt(disk) || 10,
      rootPassword,
      features,
      notes,
      status: 'creating'
    });

    // Async LXC creation
    lxc.createContainer(containerId, os, osVersion, parseInt(cpu), parseInt(ram), parseInt(disk), features)
      .then(async (result) => {
        if (result.success) {
          await lxc.startContainer(containerId);
          const ip = await lxc.getContainerIP(containerId);
          if (rootPassword) await lxc.setRootPassword(containerId, rootPassword);
          VPS.update(vps.id, {
            status: 'running',
            ip_address: ip || 'Pending',
            last_action: new Date().toISOString()
          });
        } else {
          VPS.update(vps.id, { status: 'error' });
        }
      })
      .catch((err) => {
        console.error('LXC creation error:', err);
        VPS.update(vps.id, { status: 'error' });
      });

    res.json({ success: true, message: 'VPS creation started! It will be ready shortly.', vpsId: vps.id });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: err.message });
  }
});

// Admin VPS actions
router.post('/vps/:id/start', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const vps = VPS.findById(parseInt(req.params.id));
    if (!vps) return res.json({ success: false, message: 'VPS not found' });
    const result = await lxc.startContainer(vps.containerId);
    if (result.success) {
      VPS.update(vps.id, { status: 'running', last_action: new Date().toISOString() });
      return res.json({ success: true, message: 'VPS started' });
    }
    res.json({ success: false, message: result.error });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/vps/:id/stop', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const vps = VPS.findById(parseInt(req.params.id));
    if (!vps) return res.json({ success: false, message: 'VPS not found' });
    const result = await lxc.stopContainer(vps.containerId);
    if (result.success) {
      VPS.update(vps.id, { status: 'stopped', last_action: new Date().toISOString() });
      return res.json({ success: true, message: 'VPS stopped' });
    }
    res.json({ success: false, message: result.error });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.delete('/vps/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const vps = VPS.findById(parseInt(req.params.id));
    if (!vps) return res.json({ success: false, message: 'VPS not found' });
    await lxc.destroyContainer(vps.containerId);
    VPS.delete(vps.id);
    res.json({ success: true, message: 'VPS deleted successfully' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ===== TICKET MANAGEMENT =====
router.get('/tickets', ensureAuthenticated, ensureAdmin, (req, res) => {
  try {
    const tickets = Ticket.findAll();
    res.render('admin/tickets', {
      title: 'Tickets - Admin',
      user: req.user,
      tickets,
      messages: { error: req.flash('error'), success: req.flash('success') }
    });
  } catch (err) {
    req.flash('error', 'Failed to load tickets.');
    res.redirect('/admin');
  }
});

router.get('/tickets/:id', ensureAuthenticated, ensureAdmin, (req, res) => {
  try {
    const ticket = Ticket.findByIdWithUser(parseInt(req.params.id));
    if (!ticket) {
      req.flash('error', 'Ticket not found.');
      return res.redirect('/admin/tickets');
    }
    res.render('admin/ticket-detail', {
      title: `Ticket #${ticket._id} - Admin`,
      user: req.user,
      ticket,
      messages: { error: req.flash('error'), success: req.flash('success') }
    });
  } catch (err) {
    req.flash('error', 'Failed to load ticket.');
    res.redirect('/admin/tickets');
  }
});

router.post('/tickets/:id/reply', ensureAuthenticated, ensureAdmin, (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const ticket = Ticket.findById(ticketId);
    if (!ticket) return res.json({ success: false, message: 'Ticket not found' });
    const userId = req.user.id || req.user._id;
    Ticket.addMessage(ticketId, userId, req.body.message, true);
    Ticket.updateStatus(ticketId, 'in-progress');
    req.flash('success', 'Reply sent!');
    res.redirect(`/admin/tickets/${ticketId}`);
  } catch (err) {
    req.flash('error', 'Failed to send reply.');
    res.redirect(`/admin/tickets/${req.params.id}`);
  }
});

router.post('/tickets/:id/status', ensureAuthenticated, ensureAdmin, (req, res) => {
  try {
    Ticket.updateStatus(parseInt(req.params.id), req.body.status);
    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

module.exports = router;
