const db = require('../db/database');

class VPS {
  static findById(id) {
    const vps = db.prepare('SELECT * FROM vps_instances WHERE id = ?').get(id);
    return this.serialize(vps);
  }

  static findByIdWithOwner(id) {
    const row = db.prepare(`
      SELECT v.*, u.username as owner_username, u.email as owner_email
      FROM vps_instances v
      LEFT JOIN users u ON v.owner_id = u.id
      WHERE v.id = ?
    `).get(id);
    return this.serializeWithOwner(row);
  }

  static findByOwner(ownerId, sort = 'DESC') {
    const rows = db.prepare(`SELECT * FROM vps_instances WHERE owner_id = ? ORDER BY created_at ${sort}`).all(ownerId);
    return rows.map(r => this.serialize(r));
  }

  static findOne(filters) {
    let sql = 'SELECT * FROM vps_instances WHERE 1=1';
    const params = [];
    if (filters.id) { sql += ' AND id = ?'; params.push(filters.id); }
    if (filters.owner_id) { sql += ' AND owner_id = ?'; params.push(filters.owner_id); }
    if (filters.containerId) { sql += ' AND container_id = ?'; params.push(filters.containerId); }
    const row = db.prepare(sql).get(...params);
    return this.serialize(row);
  }

  static findAll(sort = 'DESC') {
    const rows = db.prepare(`
      SELECT v.*, u.username as owner_username, u.email as owner_email
      FROM vps_instances v
      LEFT JOIN users u ON v.owner_id = u.id
      ORDER BY v.created_at ${sort}
    `).all();
    return rows.map(r => this.serializeWithOwner(r));
  }

  static findRecent(ownerId, limit = 5) {
    const rows = db.prepare('SELECT * FROM vps_instances WHERE owner_id = ? ORDER BY created_at DESC LIMIT ?').all(ownerId, limit);
    return rows.map(r => this.serialize(r));
  }

  static create({ name, ownerId, containerId, hostname, os, osVersion, cpu, ram, disk, rootPassword, features, notes, status = 'creating' }) {
    const stmt = db.prepare(`
      INSERT INTO vps_instances (name, owner_id, container_id, hostname, os, os_version, cpu, ram, disk,
        root_password, feat_nesting, feat_kvm, feat_fuse, feat_docker, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      name, ownerId, containerId, hostname, os || 'ubuntu', osVersion || '22.04',
      cpu || 1, ram || 512, disk || 10, rootPassword || null,
      features?.nesting ? 1 : 0, features?.kvm ? 1 : 0,
      features?.fuse ? 1 : 0, features?.docker ? 1 : 0,
      notes || null, status
    );
    return this.findById(result.lastInsertRowid);
  }

  static update(id, fields) {
    const mapping = {
      name: 'name', status: 'status', ipAddress: 'ip_address', ip_address: 'ip_address',
      lastAction: 'last_action', last_action: 'last_action',
      notes: 'notes', rootPassword: 'root_password'
    };
    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(fields)) {
      const dbKey = mapping[key] || key;
      updates.push(`${dbKey} = ?`);
      values.push(value);
    }

    if (updates.length === 0) return this.findById(id);
    values.push(id);
    db.prepare(`UPDATE vps_instances SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  }

  static delete(id) {
    return db.prepare('DELETE FROM vps_instances WHERE id = ?').run(id);
  }

  static countByOwner(ownerId) {
    return db.prepare('SELECT COUNT(*) as count FROM vps_instances WHERE owner_id = ?').get(ownerId).count;
  }

  static countByOwnerAndStatus(ownerId, status) {
    return db.prepare('SELECT COUNT(*) as count FROM vps_instances WHERE owner_id = ? AND status = ?').get(ownerId, status).count;
  }

  static countAll() {
    return db.prepare('SELECT COUNT(*) as count FROM vps_instances').get().count;
  }

  static countByStatus(status) {
    return db.prepare('SELECT COUNT(*) as count FROM vps_instances WHERE status = ?').get(status).count;
  }

  static serialize(row) {
    if (!row) return null;
    return {
      ...row,
      _id: row.id,
      owner: row.owner_id,
      containerId: row.container_id,
      osVersion: row.os_version,
      ipAddress: row.ip_address,
      features: {
        nesting: !!row.feat_nesting,
        kvm: !!row.feat_kvm,
        fuse: !!row.feat_fuse,
        docker: !!row.feat_docker
      },
      rootPassword: row.root_password,
      sshPort: row.ssh_port,
      createdAt: row.created_at,
      lastAction: row.last_action
    };
  }

  static serializeWithOwner(row) {
    if (!row) return null;
    const vps = this.serialize(row);
    vps.owner = row.owner_username ? {
      _id: row.owner_id,
      id: row.owner_id,
      username: row.owner_username,
      email: row.owner_email
    } : null;
    return vps;
  }
}

module.exports = VPS;
