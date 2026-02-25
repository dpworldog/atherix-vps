const db = require('../db/database');
const bcrypt = require('bcryptjs');

class User {
  static findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  static findByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email?.toLowerCase());
  }

  static findByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  }

  static findByEmailOrUsername(email, username) {
    return db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(email?.toLowerCase(), username);
  }

  static findAll(role = null) {
    if (role) {
      return db.prepare('SELECT * FROM users WHERE role = ? ORDER BY created_at DESC').all(role);
    }
    return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  }

  static findRecent(role = 'user', limit = 5) {
    return db.prepare('SELECT * FROM users WHERE role = ? ORDER BY created_at DESC LIMIT ?').all(role, limit);
  }

  static create({ username, email, password, role = 'user', isActive = true }) {
    const hashedPassword = bcrypt.hashSync(password, 12);
    const stmt = db.prepare(`
      INSERT INTO users (username, email, password, role, is_active)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(username, email.toLowerCase(), hashedPassword, role, isActive ? 1 : 0);
    return this.findById(result.lastInsertRowid);
  }

  static update(id, fields) {
    const allowed = ['username', 'email', 'password', 'role', 'avatar', 'is_active', 'is_banned', 'ban_reason', 'last_login'];
    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(fields)) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowed.includes(dbKey)) {
        if (dbKey === 'password') {
          updates.push(`${dbKey} = ?`);
          values.push(bcrypt.hashSync(value, 12));
        } else {
          updates.push(`${dbKey} = ?`);
          values.push(value);
        }
      }
    }

    if (updates.length === 0) return this.findById(id);
    values.push(id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  static updateLastLogin(id) {
    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(id);
  }

  static delete(id) {
    return db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }

  static countByRole(role) {
    const row = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get(role);
    return row.count;
  }

  static async comparePassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  // Compatibility helpers — map SQLite snake_case to camelCase
  static serialize(user) {
    if (!user) return null;
    return {
      ...user,
      _id: user.id,
      isActive: !!user.is_active,
      isBanned: !!user.is_banned,
      banReason: user.ban_reason,
      createdAt: user.created_at,
      lastLogin: user.last_login
    };
  }
}

module.exports = User;
