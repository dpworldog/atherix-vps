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
const pty = require('node-pty');
const VPS = require('./models/VPS');

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

// Socket.io logic
io.on('connection', (socket) => {
  console.log('[Socket] New connection:', socket.id);

  socket.on('subscribe-vps', (vpsId) => {
    socket.join(`vps-${vpsId}`);
  });

  // Scope terminal process to this specific socket connection
  let socketTermProcess = null;

  socket.on('terminal-join', async ({ vpsId, containerId }) => {
    try {
      if (socketTermProcess) {
        socketTermProcess.kill();
      }

      // SECURITY: Verify the containerId exists in our system
      // Note: In production, we should also check socket.request.user.id
      const vps = VPS.findOne({ containerId: containerId });
      if (!vps) {
        return socket.emit('terminal-output', '\r\n\x1b[31m[Security Error: Unauthorized Access]\x1b[0m\r\n');
      }

      console.log(`[Terminal] Spawning PTY for ${containerId}`);
      socket.emit('terminal-output', '\x1b[36m[Connecting to terminal...]\x1b[0m\r\n');

      // Spawn real PTY using node-pty
      socketTermProcess = pty.spawn('lxc', ['exec', containerId, '--env', 'TERM=xterm-256color', '--', 'bash'], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: process.env.HOME,
        env: process.env
      });

      // Forward output to frontend
      socketTermProcess.onData((data) => {
        socket.emit('terminal-output', data);
      });

      socketTermProcess.onExit(({ exitCode, signal }) => {
        console.log(`[Terminal] PTY exited for ${containerId} with code ${exitCode}`);
        socket.emit('terminal-output', `\r\n\x1b[33m[Session Terminated (Code ${exitCode})]\x1b[0m\r\n`);
        socketTermProcess = null;
      });

      // Handle terminal resize from frontend
      socket.on('terminal-resize', ({ cols, rows }) => {
        if (socketTermProcess) {
          socketTermProcess.resize(cols, rows);
        }
      });

      // Forward input from frontend to PTY
      socket.on('terminal-input', (data) => {
        if (socketTermProcess) {
          socketTermProcess.write(data);
        }
      });

    } catch (err) {
      console.error('[Terminal Error]:', err);
      socket.emit('terminal-output', `\r\n\x1b[31m[Critical Error: ${err.message}]\x1b[0m\r\n`);
    }
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected:', socket.id);
    if (socketTermProcess) {
      socketTermProcess.kill();
      socketTermProcess = null;
    }
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
