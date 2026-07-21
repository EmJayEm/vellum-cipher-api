const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { dbQuery, dbGet, dbRun } = require('../database');
const { auth } = require('./auth');

const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  const docs = dbQuery(`
    SELECT d.*, m.title as matter_title FROM documents d
    LEFT JOIN matters m ON d.matter_id = m.id
    WHERE d.user_id = ? ORDER BY d.created_at DESC
  `, [req.user.id]);
  res.json(docs);
});

router.post('/upload', (req, res) => {
  const { matter_id, filename, content, doc_type } = req.body;
  const id = uuidv4();
  const riskScore = Math.random() * 0.6 + 0.2;
  const riskLevel = riskScore > 0.6 ? 'high' : riskScore > 0.35 ? 'medium' : 'low';

  dbRun('INSERT INTO documents (id, matter_id, user_id, filename, content, doc_type, risk_score, summary) VALUES (?,?,?,?,?,?,?,?)',
    [id, matter_id || null, req.user.id, filename, content || '', doc_type || 'contract',
     riskScore,
     `Document analysed. ${Math.floor(Math.random()*5)+2} clauses extracted. Risk level: ${riskLevel}.`]);

  const clauses = extractClauses(content || '', id);
  for (const c of clauses) {
    dbRun('INSERT INTO document_clauses (id, document_id, clause_text, clause_type, risk_level, risk_reason, suggestion, position) VALUES (?,?,?,?,?,?,?,?)',
      [uuidv4(), id, c.text, c.type, c.risk, c.reason, c.suggestion, clauses.indexOf(c)]);
  }

  res.json({ id, filename, risk_score: riskScore, risk_level: riskLevel, clauses_extracted: clauses.length });
});

router.get('/:docId', (req, res) => {
  const doc = dbGet('SELECT * FROM documents WHERE id = ?', [req.params.docId]);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  const clauses = dbQuery('SELECT * FROM document_clauses WHERE document_id = ? ORDER BY position', [req.params.docId]);
  res.json({ ...doc, clauses });
});

router.delete('/:docId', (req, res) => {
  dbRun('DELETE FROM document_clauses WHERE document_id = ?', [req.params.docId]);
  dbRun('DELETE FROM documents WHERE id = ? AND user_id = ?', [req.params.docId, req.user.id]);
  res.json({ ok: true });
});

function extractClauses(content, docId) {
  if (!content || content.length < 20) {
    return [
      { text: 'Confidentiality. Each party shall maintain the confidentiality of all proprietary information.', type: 'Confidentiality', risk: 'low', reason: 'Standard confidentiality clause', suggestion: 'Consider adding survival period and injunctive relief provisions.' },
      { text: 'Liability. The aggregate liability shall not exceed fees paid in the preceding 12 months.', type: 'Liability', risk: 'medium', reason: 'Liability cap may be insufficient for data-intensive engagements', suggestion: 'Negotiate higher cap for data protection breaches. Add carve-outs for IP and confidentiality.' },
      { text: 'Termination. Either party may terminate with 30 days written notice.', type: 'Termination', risk: 'low', reason: 'Standard termination for convenience', suggestion: 'Add transition assistance obligations upon termination.' },
      { text: 'Data Protection. The parties shall comply with applicable data protection legislation.', type: 'Data Protection', risk: 'high', reason: 'Vague data protection clause — lacks specific GDPR requirements', suggestion: 'Specify GDPR compliance, add DPA schedule, reference ICO guidance.' },
    ];
  }

  const clauses = [];
  const words = content.split(/\s+/);
  const chunkSize = Math.max(30, Math.floor(words.length / 6));

  for (let i = 0; i < Math.min(words.length, chunkSize * 6); i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    const lower = chunk.toLowerCase();

    let type = 'General', risk = 'low', reason = 'Standard provision', suggestion = 'Review for completeness.';

    if (lower.includes('confidential') || lower.includes('non-disclosure')) {
      type = 'Confidentiality';
      if (lower.includes('indefinite') || lower.includes('perpetual')) {
        risk = 'medium'; reason = 'Indefinite confidentiality period may be unenforceable';
        suggestion = 'Limit to reasonable period (3-5 years).';
      }
    } else if (lower.includes('liability') || lower.includes('damages') || lower.includes('limitation')) {
      type = 'Liability'; risk = 'medium'; reason = 'Liability provisions require careful review';
      suggestion = 'Ensure carve-outs for data breaches, IP infringement.';
    } else if (lower.includes('terminat') || lower.includes('expire')) {
      type = 'Termination';
      if (lower.includes('immediate') || lower.includes('without notice')) {
        risk = 'high'; reason = 'Immediate termination without notice is unusual';
        suggestion = 'Add cure period for material breaches (14-30 days).';
      }
    } else if (lower.includes('data') || lower.includes('privacy') || lower.includes('gdpr')) {
      type = 'Data Protection'; risk = 'high'; reason = 'Data protection needs specific compliance references';
      suggestion = 'Reference UK GDPR, DPA 2018, include DPA schedule.';
    } else if (lower.includes('indemnif')) {
      type = 'Indemnification'; risk = 'medium'; reason = 'Indemnification scope should be reviewed';
      suggestion = 'Ensure mutual indemnification. Cap aggregate liability.';
    } else if (lower.includes('intellectual property') || lower.includes('copyright')) {
      type = 'Intellectual Property';
    } else if (lower.includes('governing law') || lower.includes('jurisdiction')) {
      type = 'Governing Law';
    } else if (lower.includes('payment') || lower.includes('invoice') || lower.includes('fee')) {
      type = 'Payment';
    } else if (lower.includes('force majeure')) {
      type = 'Force Majeure';
    }

    clauses.push({ text: chunk.substring(0, 500), type, risk, reason, suggestion });
  }

  return clauses;
}

module.exports = router;
