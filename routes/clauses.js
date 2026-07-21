const express = require('express');
const { dbQuery, dbGet } = require('../database');
const { auth } = require('./auth');

const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  const { category, jurisdiction, risk } = req.query;
  let query = 'SELECT * FROM clauses WHERE 1=1';
  const params = [];
  if (category) { query += ' AND category = ?'; params.push(category); }
  if (jurisdiction) { query += ' AND jurisdiction = ?'; params.push(jurisdiction); }
  if (risk) { query += ' AND risk_level = ?'; params.push(risk); }
  query += ' ORDER BY category, title';
  res.json(dbQuery(query, params));
});

router.get('/categories', (req, res) => {
  const cats = dbQuery('SELECT category, COUNT(*) as count FROM clauses GROUP BY category ORDER BY category', []);
  res.json(cats);
});

router.get('/:clauseId', (req, res) => {
  const clause = dbGet('SELECT * FROM clauses WHERE id = ?', [req.params.clauseId]);
  if (!clause) return res.status(404).json({ error: 'Not found' });
  res.json(clause);
});

module.exports = router;
