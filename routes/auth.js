const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { dbQuery, dbGet, dbRun } = require('../database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'vc-secret-key-change-in-production';

function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

router.post('/register', (req, res) => {
  const { email, name, password, firm } = req.body;
  if (!email || !name || !password) return res.status(400).json({ error: 'All fields required' });
  const existing = dbGet('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) return res.status(409).json({ error: 'Email already registered' });
  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  dbRun('INSERT INTO users (id, email, name, password, firm) VALUES (?,?,?,?,?)', [id, email, name, hash, firm || '']);
  const token = jwt.sign({ id, email, name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id, email, name, firm } });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = dbGet('SELECT * FROM users WHERE email = ?', [email]);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, firm: user.firm } });
});

router.get('/me', auth, (req, res) => {
  const user = dbGet('SELECT id, email, name, firm, role, created_at FROM users WHERE id = ?', [req.user.id]);
  res.json(user);
});

module.exports = router;
module.exports.auth = auth;
