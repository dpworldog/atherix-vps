const db = require('../db/database');

class Ticket {
  static findById(id) {
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
    if (!ticket) return null;
    ticket.messages = this.getMessages(id);
    return this.serialize(ticket);
  }

  static findByIdWithUser(id) {
    const row = db.prepare(`
      SELECT t.*, u.username as user_username, u.email as user_email
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.id = ?
    `).get(id);
    if (!row) return null;
    row.messages = this.getMessagesWithSenders(id);
    return this.serializeWithUser(row);
  }

  static findByUser(userId, sort = 'DESC') {
    const rows = db.prepare(`SELECT * FROM tickets WHERE user_id = ? ORDER BY updated_at ${sort}`).all(userId);
    return rows.map(r => {
      r.messages = this.getMessages(r.id);
      return this.serialize(r);
    });
  }

  static findAll(sort = 'DESC') {
    const rows = db.prepare(`
      SELECT t.*, u.username as user_username, u.email as user_email
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      ORDER BY t.updated_at ${sort}
    `).all();
    return rows.map(r => {
      r.messages = this.getMessagesWithSenders(r.id);
      return this.serializeWithUser(r);
    });
  }

  static findRecent(userId, limit = 3) {
    const rows = db.prepare('SELECT * FROM tickets WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?').all(userId, limit);
    return rows.map(r => {
      r.messages = this.getMessages(r.id);
      return this.serialize(r);
    });
  }

  static findRecentAll(limit = 5) {
    const rows = db.prepare(`
      SELECT t.*, u.username as user_username, u.email as user_email
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      ORDER BY t.updated_at DESC LIMIT ?
    `).all(limit);
    return rows.map(r => this.serializeWithUser(r));
  }

  static create({ title, userId, priority = 'medium', category = 'general', message, senderId }) {
    const insertTicket = db.prepare(`
      INSERT INTO tickets (title, user_id, priority, category)
      VALUES (?, ?, ?, ?)
    `);
    const insertMessage = db.prepare(`
      INSERT INTO ticket_messages (ticket_id, sender_id, message, is_admin)
      VALUES (?, ?, ?, 0)
    `);

    const result = db.transaction(() => {
      const ticketResult = insertTicket.run(title, userId, priority, category);
      const ticketId = ticketResult.lastInsertRowid;
      insertMessage.run(ticketId, senderId || userId, message);
      return ticketId;
    })();

    return this.findById(result);
  }

  static addMessage(ticketId, senderId, message, isAdmin = false) {
    db.prepare(`
      INSERT INTO ticket_messages (ticket_id, sender_id, message, is_admin)
      VALUES (?, ?, ?, ?)
    `).run(ticketId, senderId, message, isAdmin ? 1 : 0);

    db.prepare("UPDATE tickets SET updated_at = datetime('now') WHERE id = ?").run(ticketId);
    return this.findById(ticketId);
  }

  static updateStatus(id, status) {
    db.prepare("UPDATE tickets SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
    return this.findById(id);
  }

  static getMessages(ticketId) {
    return db.prepare('SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC').all(ticketId);
  }

  static getMessagesWithSenders(ticketId) {
    const rows = db.prepare(`
      SELECT tm.*, u.username as sender_username, u.role as sender_role
      FROM ticket_messages tm
      LEFT JOIN users u ON tm.sender_id = u.id
      WHERE tm.ticket_id = ?
      ORDER BY tm.created_at ASC
    `).all(ticketId);
    return rows.map(m => ({
      ...m,
      _id: m.id,
      sender: {
        _id: m.sender_id,
        id: m.sender_id,
        username: m.sender_username,
        role: m.sender_role
      },
      isAdmin: !!m.is_admin,
      createdAt: m.created_at
    }));
  }

  static countByUser(userId, statuses = null) {
    if (statuses && statuses.length > 0) {
      const placeholders = statuses.map(() => '?').join(',');
      return db.prepare(`SELECT COUNT(*) as count FROM tickets WHERE user_id = ? AND status IN (${placeholders})`).get(userId, ...statuses).count;
    }
    return db.prepare('SELECT COUNT(*) as count FROM tickets WHERE user_id = ?').get(userId).count;
  }

  static countByStatus(statuses) {
    if (Array.isArray(statuses)) {
      const placeholders = statuses.map(() => '?').join(',');
      return db.prepare(`SELECT COUNT(*) as count FROM tickets WHERE status IN (${placeholders})`).get(...statuses).count;
    }
    return db.prepare('SELECT COUNT(*) as count FROM tickets WHERE status = ?').get(statuses).count;
  }

  static deleteByUser(userId) {
    // Messages are cascade-deleted
    return db.prepare('DELETE FROM tickets WHERE user_id = ?').run(userId);
  }

  static serialize(row) {
    if (!row) return null;
    return {
      ...row,
      _id: row.id,
      user: row.user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messages: (row.messages || []).map(m => ({
        ...m,
        _id: m.id,
        sender: m.sender || { _id: m.sender_id, id: m.sender_id },
        isAdmin: !!m.is_admin,
        createdAt: m.created_at
      }))
    };
  }

  static serializeWithUser(row) {
    if (!row) return null;
    const ticket = this.serialize(row);
    ticket.user = row.user_username ? {
      _id: row.user_id,
      id: row.user_id,
      username: row.user_username,
      email: row.user_email
    } : null;
    return ticket;
  }
}

module.exports = Ticket;
