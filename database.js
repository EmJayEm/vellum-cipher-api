const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'vc.db');
let db;

function getDB() {
  return db;
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      firm TEXT DEFAULT '',
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS matters (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      jurisdiction TEXT DEFAULT 'UK',
      status TEXT DEFAULT 'active',
      risk_level TEXT DEFAULT 'low',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      matter_id TEXT,
      user_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      content TEXT DEFAULT '',
      doc_type TEXT DEFAULT 'contract',
      status TEXT DEFAULT 'uploaded',
      risk_score REAL DEFAULT 0,
      summary TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (matter_id) REFERENCES matters(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS document_clauses (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      clause_text TEXT NOT NULL,
      clause_type TEXT DEFAULT '',
      risk_level TEXT DEFAULT 'low',
      risk_reason TEXT DEFAULT '',
      suggestion TEXT DEFAULT '',
      position INTEGER DEFAULT 0,
      FOREIGN KEY (document_id) REFERENCES documents(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      matter_id TEXT,
      title TEXT DEFAULT 'New Chat',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      sources TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chats(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS clauses (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      jurisdiction TEXT DEFAULT 'UK',
      risk_template TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed data
  const existing = dbQuery('SELECT id FROM users WHERE email = ?', ['demo@vellumcipher.com']);
  if (existing.length === 0) {
    const userId = uuidv4();
    const hash = bcrypt.hashSync('demo123', 10);
    db.run('INSERT INTO users (id, email, name, password, firm, role) VALUES (?,?,?,?,?,?)',
      [userId, 'demo@vellumcipher.com', 'Demo User', hash, 'Vellum & Cipher Demo', 'admin']);

    const m1 = uuidv4(), m2 = uuidv4(), m3 = uuidv4();
    db.run('INSERT INTO matters (id, user_id, title, description, jurisdiction, status, risk_level) VALUES (?,?,?,?,?,?,?)',
      [m1, userId, 'Acme Corp MSA Review', 'Master Services Agreement review for Acme Corporation', 'UK', 'active', 'medium']);
    db.run('INSERT INTO matters (id, user_id, title, description, jurisdiction, status, risk_level) VALUES (?,?,?,?,?,?,?)',
      [m2, userId, 'Globex Data Processing Agreement', 'DPA compliance review for GDPR alignment', 'EU', 'active', 'high']);
    db.run('INSERT INTO matters (id, user_id, title, description, jurisdiction, status, risk_level) VALUES (?,?,?,?,?,?,?)',
      [m3, userId, 'Initech Merger Due Diligence', 'Cross-border M&A due diligence for Initech acquisition', 'UK', 'review', 'low']);

    const clausesData = [
      ['Confidentiality', 'Standard Confidentiality', 'Each party agrees to maintain the confidentiality of all Confidential Information disclosed by the other party. This obligation shall survive termination of this Agreement for a period of five (5) years.', 'UK', 'Standard — 5 year survival period'],
      ['Confidentiality', 'Enhanced Confidentiality with NDAs', 'No Confidential Information shall be disclosed to any third party without prior written consent. Breach of this clause shall entitle the non-breaching party to immediate injunctive relief and damages.', 'UK', 'Strong — includes injunctive relief provision'],
      ['Liability', 'Liability Cap — Consequential Damages', 'In no event shall either party be liable for any indirect, incidental, special, consequential, or punitive damages, regardless of the cause of action or theory of liability.', 'UK', 'Review — may limit recovery for data breaches'],
      ['Liability', 'Unlimited Liability Carve-out', 'The limitations in this clause shall not apply to: (a) breaches of confidentiality; (b) infringement of intellectual property rights; (c) gross negligence or willful misconduct.', 'UK', 'Favourable — includes important carve-outs'],
      ['Termination', 'Termination for Convenience — 30 Days', 'Either party may terminate this Agreement by providing thirty (30) days prior written notice to the other party.', 'UK', 'Standard — 30 day notice period'],
      ['Termination', 'Termination for Cause — Material Breach', 'Either party may terminate this Agreement immediately upon written notice if the other party commits a material breach that remains uncured for fourteen (14) days after written notice.', 'UK', 'Standard — 14 day cure period'],
      ['Indemnification', 'Mutual Indemnification', 'Each party shall indemnify, defend, and hold harmless the other party from and against any claims, damages, losses, and expenses arising out of breach of this Agreement.', 'UK', 'Standard mutual indemnification'],
      ['Indemnification', 'One-Side Indemnification (High Risk)', 'The Provider shall indemnify the Client against all claims arising from the Provider performance under this Agreement.', 'UK', 'High Risk — one-sided, negotiate for mutual coverage'],
      ['Data Protection', 'GDPR Standard DPA', 'The parties shall process personal data in accordance with the UK GDPR and Data Protection Act 2018. The Provider shall implement appropriate technical and organisational measures.', 'UK', 'Standard GDPR alignment'],
      ['Data Protection', 'Cross-Border Transfer (SCCs)', 'Personal data may be transferred outside the UK only with appropriate safeguards including Standard Contractual Clauses approved by the ICO.', 'UK', 'Review — requires SCCs for non-adequate countries'],
      ['Intellectual Property', 'IP Retention', 'Each party retains ownership of all intellectual property rights in materials developed independently. Nothing in this Agreement transfers IP ownership.', 'UK', 'Standard — IP stays with originator'],
      ['Intellectual Property', 'Work Product Assignment', 'All work product created under this Agreement shall be the sole property of the Client. The Provider hereby assigns all rights, title, and interest.', 'UK', 'Client favourable — full assignment to client'],
      ['Governing Law', 'English Law Jurisdiction', 'This Agreement shall be governed by and construed in accordance with the laws of England and Wales. The parties submit to the exclusive jurisdiction of the English courts.', 'UK', 'Standard English law'],
      ['Governing Law', 'Arbitration Clause', 'Any dispute arising under this Agreement shall be finally resolved by arbitration under the LCIA Rules. The seat of arbitration shall be London.', 'UK', 'Alternative — arbitration instead of courts'],
      ['Force Majeure', 'Standard Force Majeure', 'Neither party shall be liable for any failure or delay in performing its obligations where such failure or delay results from circumstances beyond its reasonable control.', 'UK', 'Standard — review scope of qualifying events'],
      ['Payment', 'Net 30 Payment Terms', 'The Client shall pay all invoices within thirty (30) days of the date of invoice. Late payments shall accrue interest at 1.5% per month.', 'UK', 'Standard — 30 day terms with late interest'],
      ['Payment', 'Net 60 Payment Terms', 'The Client shall pay all invoices within sixty (60) days of the date of invoice.', 'UK', 'Extended — negotiate for shorter terms'],
      ['Limitation', 'Limitation of Liability — 12 Months', 'The aggregate liability of either party under this Agreement shall not exceed the total fees paid in the twelve (12) months preceding the claim.', 'UK', 'Standard cap — 12 months of fees'],
    ];
    for (const c of clausesData) {
      db.run('INSERT INTO clauses (id, category, title, body, jurisdiction, risk_template) VALUES (?,?,?,?,?,?)',
        [uuidv4(), ...c]);
    }

    const chatId = uuidv4();
    db.run('INSERT INTO chats (id, user_id, matter_id, title) VALUES (?,?,?,?)',
      [chatId, userId, m1, 'MSA Risk Analysis']);
    db.run('INSERT INTO messages (id, chat_id, role, content) VALUES (?,?,?,?)',
      [uuidv4(), chatId, 'user', 'Analyse the liability exposure in the Acme MSA.']);
    db.run('INSERT INTO messages (id, chat_id, role, content) VALUES (?,?,?,?)',
      [uuidv4(), chatId, 'assistant', '## Liability Analysis — Acme Corp MSA\n\n**Risk Level: MEDIUM**\n\n### Key Findings:\n\n1. **Clause 7.2 — Liability Cap**: Set at 12 months of fees. Standard for UK MSAs, but may be insufficient for data-intensive engagements.\n\n2. **Clause 8.1 — Consequential Damages**: Mutual exclusion of consequential damages. **Risk**: This may limit recovery in the event of a data breach under UK GDPR.\n\n3. **Clause 9.3 — Indemnification**: One-sided indemnification favouring the Client. Provider should negotiate for mutual coverage.\n\n### Recommendations:\n- Negotiate a higher liability cap for data protection breaches\n- Add a carve-out to the consequential damages exclusion for GDPR claims\n- Push for mutual indemnification\n\n**Audit trail**: SHA-256 hash generated. Analysis based on UK GDPR, DPA 2018, and current case law.']);

    saveDB();
  }

  console.log('Database initialized.');
}

// Helper: run a query and return all rows as array of objects
function dbQuery(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper: run a single row query
function dbGet(sql, params = []) {
  const rows = dbQuery(sql, params);
  return rows.length > 0 ? rows[0] : undefined;
}

// Helper: run an INSERT/UPDATE/DELETE
function dbRun(sql, params = []) {
  db.run(sql, params);
}

// Auto-save periodically
setInterval(() => { if (db) saveDB(); }, 5000);

module.exports = { getDB, initDB, dbQuery, dbGet, dbRun, saveDB };
