require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// Initialize SQLite database
require('./db/database');

// Init app
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Passport config
require('./config/passport')(passport);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'atherixcloud_secret_2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// Global locals
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.currentUser = req.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/vps', require('./routes/vps'));
app.use('/tickets', require('./routes/tickets'));
app.use('/admin', require('./routes/admin'));
app.use('/api', require('./routes/api'));

// Home redirect
app.get('/', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/dashboard');
  res.redirect('/auth/login');
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { title: '404 - Not Found', message: '404 - Page Not Found', user: req.user });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { title: '500 - Server Error', message: '500 - Internal Server Error', user: req.user });
});

// Socket.io for real-time VPS status
io.on('connection', (socket) => {
  socket.on('subscribe-vps', (vpsId) => {
    socket.join(`vps-${vpsId}`);
  });
});

// Seed admin account on startup — always sync password from .env
const User = require('./models/User');
const bcrypt = require('bcryptjs');
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
if (adminEmail && adminPassword) {
  const existing = User.findByEmail(adminEmail);
  if (!existing) {
    User.create({ username: 'AtherixAdmin', email: adminEmail, password: adminPassword, role: 'admin' });
    console.log('✅ Admin account created:', adminEmail);
  } else {
    // Always ensure admin role + re-sync password from .env
    const hashedPassword = bcrypt.hashSync(adminPassword, 12);
    const db = require('./db/database');
    db.prepare('UPDATE users SET password = ?, role = ?, is_active = 1, is_banned = 0 WHERE id = ?')
      .run(hashedPassword, 'admin', existing.id);
    console.log('✅ Admin account synced:', adminEmail);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 AtherixCloud running on http://localhost:${PORT}`);
});

module.exports = { app, io };
