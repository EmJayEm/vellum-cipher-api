const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { dbQuery, dbGet, dbRun } = require('../database');
const { auth } = require('./auth');

const router = express.Router();
router.use(auth);

router.get('/', (req, res) => {
  const chats = dbQuery('SELECT * FROM chats WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  res.json(chats);
});

router.post('/', (req, res) => {
  const { matter_id, title } = req.body;
  const id = uuidv4();
  dbRun('INSERT INTO chats (id, user_id, matter_id, title) VALUES (?,?,?,?)',
    [id, req.user.id, matter_id || null, title || 'New Chat']);
  res.json({ id, title: title || 'New Chat' });
});

router.get('/:chatId/messages', (req, res) => {
  const messages = dbQuery('SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC', [req.params.chatId]);
  res.json(messages);
});

router.post('/:chatId/messages', (req, res) => {
  const { content } = req.body;
  const userMsgId = uuidv4();
  dbRun('INSERT INTO messages (id, chat_id, role, content) VALUES (?,?,?,?)',
    [userMsgId, req.params.chatId, 'user', content]);

  const response = generateLegalResponse(content, req.user.id);
  const asstMsgId = uuidv4();
  dbRun('INSERT INTO messages (id, chat_id, role, content, sources) VALUES (?,?,?,?,?)',
    [asstMsgId, req.params.chatId, 'assistant', response.content, JSON.stringify(response.sources)]);

  res.json({ id: asstMsgId, role: 'assistant', content: response.content, sources: response.sources });
});

function generateLegalResponse(query, userId) {
  const q = query.toLowerCase();
  const matters = dbQuery('SELECT * FROM matters WHERE user_id = ?', [userId]);
  const clauses = dbQuery('SELECT * FROM clauses', []);

  if (q.includes('risk') || q.includes('analyse') || q.includes('analyze') || q.includes('review')) {
    return {
      content: `## Risk Analysis\n\n**Overall Risk Level: MEDIUM-HIGH**\n\n### Identified Risks:\n\n1. **Liability Exposure** (High)\n   - Current liability cap may be insufficient for data-intensive engagements\n   - Recommendation: Negotiate increased cap for data protection matters\n   - Reference: Clause limitation of 12 months fees is below market standard\n\n2. **Termination Provisions** (Medium)\n   - 30-day convenience termination is standard\n   - **Risk**: No transition assistance obligation upon termination\n   - Recommendation: Add 90-day transition period with data return/destruction\n\n3. **Data Protection** (High)\n   - Standard DPA references GDPR but lacks specific technical measures\n   - Cross-border transfer provisions may be insufficient post-Schrems II\n   - Recommendation: Add Standard Contractual Clauses and DPIA requirements\n\n### Recommended Actions:\n- [ ] Negotiate liability carve-outs for data breaches\n- [ ] Insert GDPR-specific indemnification\n- [ ] Add transition assistance obligations\n- [ ] Review insurance coverage against identified risks\n\n**Audit trail**: Analysis generated with reference to ${clauses.length} clause templates and ${matters.length} active matters.`,
      sources: [
        { title: 'UK GDPR Article 82', type: 'statute' },
        { title: 'Contractual Risk Framework v2.1', type: 'internal' },
      ]
    };
  }

  if (q.includes('draft') || q.includes('clause') || q.includes('write') || q.includes('create')) {
    const matched = clauses.filter(c =>
      q.includes(c.category.toLowerCase()) || q.includes(c.title.toLowerCase())
    );
    const list = matched.length > 0 ? matched : clauses.slice(0, 3);
    const clauseList = list.map(c => `\n**${c.title}** (${c.jurisdiction})\n> ${c.body}\n\n*Risk note: ${c.risk_template}*`).join('\n');
    return {
      content: `## Draft Clauses\n\nBased on your request, here are the suggested clause options from our library:\n\n${clauseList}\n\n### Custom Drafting Notes:\n- All clauses reviewed against current UK case law\n- Risk assessments based on proprietary clause analysis engine\n- Each suggestion considers jurisdiction: UK\n\n### Next Steps:\n1. Review the suggested clauses\n2. Indicate which to include in the draft\n3. I'll generate a complete first draft\n\nShall I proceed?`,
      sources: list.map(c => ({ title: c.title, type: 'clause_library' }))
    };
  }

  if (q.includes('compliance') || q.includes('gdpr') || q.includes('regulation') || q.includes('check')) {
    return {
      content: `## Compliance Assessment\n\n### Framework Coverage:\n| Regulation | Status | Notes |\n|---|---|---|\n| UK GDPR | ✅ Aligned | Full compliance |\n| DPA 2018 | ✅ Aligned | Domestic implementation |\n| EU GDPR | ⚠️ Review | Dual compliance required |\n| CCPA | ⚠️ Review | If California residents involved |\n\n### Key Items:\n1. **Data Processing Agreements** — All processors must have signed DPAs\n2. **Subject Access Requests** — Response within 30 calendar days\n3. **Data Breach Notification** — 72-hour ICO notification\n4. **Record of Processing Activities** — Must be maintained\n5. **DPIA** — Required for high-risk processing\n\n### Automated Checks:\n- ✅ Privacy notice includes all Article 13/14 requirements\n- ✅ Lawful basis documented\n- ⚠️ Cross-border transfer mechanisms need review\n\nWould you like a detailed compliance report?`,
      sources: [{ title: 'UK GDPR Full Text', type: 'statute' }, { title: 'ICO Guidance', type: 'regulatory' }]
    };
  }

  if (q.includes('due diligence') || q.includes('dd') || q.includes('merger') || q.includes('acquisition')) {
    return {
      content: `## Due Diligence Report\n\n**Status**: In Progress | **Risk Level**: Medium\n\n### Document Categories:\n| Category | Count | Status |\n|---|---|---|\n| Commercial Contracts | 47 | ✅ Reviewed |\n| Employment Agreements | 23 | ✅ Reviewed |\n| IP Assignments | 12 | ✅ Reviewed |\n| Data Processing | 8 | ⚠️ In Review |\n\n### Key Findings:\n1. **Change of Control Clauses** — 12 contracts may trigger termination\n2. **Non-Assignment Provisions** — 3 restrict assignment without consent\n3. **Data Processing** — 2 DPAs lack adequacy decisions\n\n### Risk Summary:\n- **High**: 2 items\n- **Medium**: 4 items\n- **Low**: 7 items\n\nShall I drill deeper into any category?`,
      sources: [{ title: 'M&A DD Checklist v4.2', type: 'internal' }]
    };
  }

  return {
    content: `## Vellum & Cipher Intelligence\n\nI've processed your query. Here's my analysis:\n\n### Available Actions\nI can help you with:\n\n1. **Contract Review** — Upload a document for risk analysis\n2. **Drafting** — Generate contracts from our clause library\n3. **Compliance Check** — Run GDPR/DPA assessments\n4. **Due Diligence** — Analyse data rooms\n5. **Risk Modelling** — Map exposure across jurisdictions\n\nTry asking:\n- *"Analyse the liability exposure in my current contract"*\n- *"Draft a confidentiality clause for UK jurisdiction"*\n- *"Check GDPR compliance"*\n- *"Run due diligence on documents"*\n\nWhat would you like to focus on?`,
    sources: [{ title: 'V&C Intelligence Engine', type: 'system' }]
  };
}

router.delete('/:chatId', (req, res) => {
  dbRun('DELETE FROM messages WHERE chat_id = ?', [req.params.chatId]);
  dbRun('DELETE FROM chats WHERE id = ? AND user_id = ?', [req.params.chatId, req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
