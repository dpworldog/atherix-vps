const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../middleware/auth');
const Ticket = require('../models/Ticket');

// List tickets
router.get('/', ensureAuthenticated, (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const tickets = Ticket.findByUser(userId);
    res.render('user/tickets', {
      title: 'Support Tickets - AtherixCloud',
      user: req.user,
      tickets,
      messages: { error: req.flash('error'), success: req.flash('success') }
    });
  } catch (err) {
    req.flash('error', 'Failed to load tickets.');
    res.redirect('/dashboard');
  }
});

// Create ticket page
router.get('/new', ensureAuthenticated, (req, res) => {
  res.render('user/ticket-new', {
    title: 'New Ticket - AtherixCloud',
    user: req.user,
    messages: { error: req.flash('error'), success: req.flash('success') }
  });
});

// Create ticket POST
router.post('/new', ensureAuthenticated, (req, res) => {
  const { title, category, priority, message } = req.body;
  try {
    const userId = req.user.id || req.user._id;
    const ticket = Ticket.create({
      title,
      category,
      priority,
      userId,
      message,
      senderId: userId
    });
    req.flash('success', 'Ticket created successfully!');
    res.redirect(`/tickets/${ticket._id}`);
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to create ticket.');
    res.redirect('/tickets/new');
  }
});

// View ticket
router.get('/:id', ensureAuthenticated, (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const ticket = Ticket.findByIdWithUser(parseInt(req.params.id));
    if (!ticket || ticket.user_id !== userId) {
      req.flash('error', 'Ticket not found.');
      return res.redirect('/tickets');
    }
    res.render('user/ticket-detail', {
      title: `Ticket #${ticket._id} - AtherixCloud`,
      user: req.user,
      ticket,
      messages: { error: req.flash('error'), success: req.flash('success') }
    });
  } catch (err) {
    req.flash('error', 'Failed to load ticket.');
    res.redirect('/tickets');
  }
});

// Reply to ticket
router.post('/:id/reply', ensureAuthenticated, (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const ticketId = parseInt(req.params.id);
    const ticket = Ticket.findById(ticketId);
    if (!ticket || ticket.user_id !== userId) {
      req.flash('error', 'Ticket not found.');
      return res.redirect('/tickets');
    }
    if (ticket.status === 'closed') {
      req.flash('error', 'Cannot reply to a closed ticket.');
      return res.redirect(`/tickets/${ticketId}`);
    }
    Ticket.addMessage(ticketId, userId, req.body.message, false);
    Ticket.updateStatus(ticketId, 'open');
    req.flash('success', 'Reply sent!');
    res.redirect(`/tickets/${ticketId}`);
  } catch (err) {
    req.flash('error', 'Failed to send reply.');
    res.redirect(`/tickets/${req.params.id}`);
  }
});

module.exports = router;
