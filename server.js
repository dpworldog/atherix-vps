require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const flash = require('connect-flash');
const methodOverride = require('method-override');

console.log('--- Environment Check ---');
console.log('ADMIN_EMAIL:', process.env.ADMIN_EMAIL ? 'Set' : 'MISSING');
console.log('ADMIN_PASSWORD:', process.env.ADMIN_PASSWORD ? 'Set' : 'MISSING');
console.log('SESSION_SECRET:', process.env.SESSION_SECRET ? 'Set' : 'MISSING');
console.log('-------------------------');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// Initialize SQLite database
require('./db/database');

// LXC/LXD Manager
const lxc = require('./config/lxc');
lxc.checkReady();

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

// Socket.io for real-time VPS status and Terminal
const { spawn } = require('child_process');

io.on('connection', (socket) => {
  socket.on('subscribe-vps', (vpsId) => {
    socket.join(`vps-${vpsId}`);
  });

  // Terminal handling
  let termProcess = null;

  socket.on('terminal-join', ({ vpsId, containerId }) => {
    if (termProcess) {
      termProcess.kill();
    }

    console.log(`[Terminal] User joined console for ${containerId}`);

    // Spawn lxc exec
    // Note: We use --force if we want to ensure it works, but lxc exec is better
    // We use "bash" but if it fails we might try "sh"
    termProcess = spawn('lxc', ['exec', containerId, '--', 'bash']);

    termProcess.stdout.on('data', (data) => {
      socket.emit('terminal-output', data.toString());
    });

    termProcess.stderr.on('data', (data) => {
      socket.emit('terminal-output', data.toString());
    });

    termProcess.on('exit', (code) => {
      console.log(`[Terminal] Process exited for ${containerId} with code ${code}`);
      socket.emit('terminal-output', '\r\n\x1b[33m[Session Terminated]\x1b[0m\r\n');
      termProcess = null;
    });

    socket.on('terminal-input', (data) => {
      if (termProcess) {
        termProcess.stdin.write(data);
      }
    });

    socket.on('disconnect', () => {
      if (termProcess) {
        termProcess.kill();
        termProcess = null;
      }
    });
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
} else {
  console.warn('⚠️  ADMIN_EMAIL or ADMIN_PASSWORD not set in environment. Skipping admin seeding.');
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 AtherixCloud running on http://localhost:${PORT}`);
});

module.exports = { app, io };
