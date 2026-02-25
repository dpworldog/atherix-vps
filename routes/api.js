const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const VPS = require('../models/VPS');

// Get VPS status
router.get('/vps/:id/status', ensureAuthenticated, (req, res) => {
  try {
    const vpsId = parseInt(req.params.id);
    const userId = req.user.id || req.user._id;
    let vps;
    if (req.user.role === 'admin') {
      vps = VPS.findById(vpsId);
    } else {
      vps = VPS.findOne({ id: vpsId, owner_id: userId });
    }
    if (!vps) return res.json({ error: 'Not found' });
    res.json({ _id: vps.id, status: vps.status, ipAddress: vps.ipAddress, lastAction: vps.lastAction });
  } catch {
    res.json({ error: 'Server error' });
  }
});

// Get all VPS statuses for dashboard
router.get('/vps/statuses', ensureAuthenticated, (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    let vpsList;
    if (req.user.role === 'admin') {
      vpsList = VPS.findAll();
    } else {
      vpsList = VPS.findByOwner(userId);
    }
    res.json(vpsList.map(v => ({ _id: v.id, name: v.name, status: v.status, ipAddress: v.ipAddress })));
  } catch {
    res.json([]);
  }
});

module.exports = router;
