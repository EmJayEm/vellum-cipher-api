const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { dbQuery, dbGet, dbRun } = require('../database');
const { auth } = require('./auth');

const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  const matters = dbQuery(`
    SELECT m.*,
      (SELECT COUNT(*) FROM documents WHERE matter_id = m.id) as doc_count,
      (SELECT COUNT(*) FROM chats WHERE matter_id = m.id) as chat_count
    FROM matters m WHERE m.user_id = ? ORDER BY m.updated_at DESC
  `, [req.user.id]);
  res.json(matters);
});

router.post('/', (req, res) => {
  const { title, description, client, status } = req.body;
  const id = uuidv4();
  dbRun('INSERT INTO matters (id, user_id, title, description, status) VALUES (?,?,?,?,?)',
    [id, req.user.id, title, description || '', status || 'active']);
  res.json({ id, title, status: status || 'active' });
});

router.get('/:matterId', (req, res) => {
  const matter = dbGet('SELECT * FROM matters WHERE id = ?', [req.params.matterId]);
  if (!matter) return res.status(404).json({ error: 'Not found' });
  const docs = dbQuery('SELECT * FROM documents WHERE matter_id = ?', [req.params.matterId]);
  const chats = dbQuery('SELECT * FROM chats WHERE matter_id = ?', [req.params.matterId]);
  res.json({ ...matter, documents: docs, chats });
});

router.put('/:matterId', (req, res) => {
  const { title, description, status } = req.body;
  const updates = [];
  const params = [];
  if (title) { updates.push('title = ?'); params.push(title); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (status) { updates.push('status = ?'); params.push(status); }
  if (updates.length > 0) {
    params.push(req.params.matterId);
    dbRun(`UPDATE matters SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params);
  }
  res.json({ ok: true });
});

router.delete('/:matterId', (req, res) => {
  dbRun('DELETE FROM documents WHERE matter_id = ?', [req.params.matterId]);
  dbRun('DELETE FROM chats WHERE matter_id = ?', [req.params.matterId]);
  dbRun('DELETE FROM matters WHERE id = ? AND user_id = ?', [req.params.matterId, req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
