const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'atherixcloud.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
    avatar TEXT DEFAULT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_banned INTEGER NOT NULL DEFAULT 0,
    ban_reason TEXT DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_login TEXT DEFAULT NULL
  );

  CREATE TABLE IF NOT EXISTS vps_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    container_id TEXT UNIQUE,
    hostname TEXT NOT NULL,
    os TEXT NOT NULL DEFAULT 'ubuntu',
    os_version TEXT DEFAULT '22.04',
    cpu INTEGER DEFAULT 1,
    ram INTEGER DEFAULT 512,
    disk INTEGER DEFAULT 10,
    ip_address TEXT,
    status TEXT NOT NULL DEFAULT 'creating' CHECK(status IN ('running', 'stopped', 'suspended', 'creating', 'error')),
    feat_nesting INTEGER DEFAULT 1,
    feat_kvm INTEGER DEFAULT 0,
    feat_fuse INTEGER DEFAULT 1,
    feat_docker INTEGER DEFAULT 1,
    root_password TEXT,
    ssh_port INTEGER DEFAULT 22,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_action TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'in-progress', 'resolved', 'closed')),
    category TEXT NOT NULL DEFAULT 'general' CHECK(category IN ('billing', 'technical', 'general', 'abuse')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS ticket_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_vps_owner ON vps_instances(owner_id);
  CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
  CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`);

console.log('✅ SQLite database initialized at', dbPath);

module.exports = db;
