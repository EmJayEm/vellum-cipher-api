const API = '';
let token = localStorage.getItem('vc_token');
let user = null;
let currentPage = 'dashboard';
let chats = [], currentChatId = null, matters = [], documents = [], clauses = [], categories = [];

// Init
(async () => {
  if (token) {
    try {
      const res = await api('/api/auth/me');
      user = res;
      showApp();
    } catch { token = null; localStorage.removeItem('vc_token'); }
  }
})();

// Auth
let isRegister = false;
function toggleAuthMode() {
  isRegister = !isRegister;
  document.getElementById('authSubtitle').textContent = isRegister ? 'Create your workspace' : 'Sign in to your intelligence workspace';
  document.getElementById('authBtn').textContent = isRegister ? 'Create Account' : 'Sign In';
  document.getElementById('nameGroup').style.display = isRegister ? 'block' : 'none';
  document.getElementById('firmGroup').style.display = isRegister ? 'block' : 'none';
  document.getElementById('authToggle').innerHTML = isRegister
    ? 'Already have an account? <a href="#" onclick="toggleAuthMode()">Sign in</a>'
    : 'Don\'t have an account? <a href="#" onclick="toggleAuthMode()">Register</a>';
}

async function handleAuth(e) {
  e.preventDefault();
  const errEl = document.getElementById('authError');
  errEl.classList.remove('show');
  const email = document.getElementById('authEmail').value;
  const password = document.getElementById('authPass').value;

  try {
    let res;
    if (isRegister) {
      const name = document.getElementById('regName').value;
      const firm = document.getElementById('regFirm').value;
      if (!name) { errEl.textContent = 'Name is required'; errEl.classList.add('show'); return false; }
      res = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name, firm }) });
    } else {
      res = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    }
    token = res.token;
    user = res.user;
    localStorage.setItem('vc_token', token);
    showApp();
  } catch (err) {
    errEl.textContent = err.message || 'Authentication failed';
    errEl.classList.add('show');
  }
  return false;
}

function logout() {
  token = null; user = null; currentChatId = null;
  localStorage.removeItem('vc_token');
  document.getElementById('appView').classList.remove('active');
  document.getElementById('authView').style.display = 'flex';
}

function showApp() {
  document.getElementById('authView').style.display = 'none';
  document.getElementById('appView').classList.add('active');
  document.getElementById('userAvatar').textContent = (user?.name || 'U')[0].toUpperCase();
  document.getElementById('userName').textContent = user?.name || 'User';
  loadMatters();
  navigateTo('dashboard');
}

async function api(url, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API + url, { ...opts, headers: { ...headers, ...opts.headers } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// Navigation
function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.toggle('active', a.dataset.page === page));
  document.getElementById('topActions').innerHTML = '';
  switch (page) {
    case 'dashboard': renderDashboard(); break;
    case 'chat': renderChat(); break;
    case 'documents': renderDocuments(); break;
    case 'clauses': renderClauses(); break;
    case 'matter': renderMatterDetail(currentMatterId); break;
  }
}

// Dashboard
async function renderDashboard() {
  document.getElementById('pageTitle').textContent = 'Dashboard';
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-sec)">Loading...</div>';

  try {
    [matters, documents] = await Promise.all([
      api('/api/matters'),
      api('/api/documents')
    ]);
  } catch { matters = []; documents = []; }

  const activeMatters = matters.filter(m => m.status === 'active').length;
  const reviewMatters = matters.filter(m => m.status === 'review').length;
  const highRisk = documents.filter(d => d.risk_score > 0.6).length;

  main.innerHTML = `
    <div class="stats">
      <div class="stat-card primary"><div class="label">Active Matters</div><div class="value">${activeMatters}</div><div class="sub">${reviewMatters} under review</div></div>
      <div class="stat-card green"><div class="label">Documents Analysed</div><div class="value">${documents.length}</div><div class="sub">This workspace</div></div>
      <div class="stat-card red"><div class="label">High Risk Items</div><div class="value">${highRisk}</div><div class="sub">Require attention</div></div>
      <div class="stat-card amber"><div class="label">Clause Templates</div><div class="value">18</div><div class="sub">In library</div></div>
    </div>
    <div class="section-header">
      <h3>Recent Documents</h3>
      <button class="btn btn-primary btn-sm" onclick="openModal()" style="width:auto">+ Analyse Document</button>
    </div>
    <div class="doc-grid">
      ${documents.slice(0, 5).map(d => renderDocCard(d)).join('')}
      ${documents.length === 0 ? '<div style="padding:40px;text-align:center;color:var(--text-sec);background:var(--surface);border:1px solid var(--border);border-radius:var(--radius)">No documents yet. Click "Analyse Document" to get started.</div>' : ''}
    </div>
  `;
}

function renderDocCard(d) {
  const pct = Math.round(d.risk_score * 100);
  const level = d.risk_score > 0.6 ? 'high' : d.risk_score > 0.35 ? 'medium' : 'low';
  const date = new Date(d.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return `<div class="doc-card" onclick="viewDocument('${d.id}')">
    <div>
      <div class="name">${esc(d.filename)}</div>
      <div class="meta">${d.doc_type} · ${d.matter_title || 'Unassigned'} · ${date}</div>
    </div>
    <div class="risk risk-${level}">
      ${pct}%
      <div class="risk-bar"><div class="fill" style="width:${pct}%"></div></div>
    </div>
  </div>`;
}

// Documents
async function renderDocuments() {
  document.getElementById('pageTitle').textContent = 'Documents';
  document.getElementById('topActions').innerHTML = '<button class="btn btn-primary btn-sm" onclick="openModal()" style="width:auto">+ Analyse Document</button>';
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-sec)">Loading...</div>';
  try { documents = await api('/api/documents'); } catch { documents = []; }
  main.innerHTML = `<div class="doc-grid">
    ${documents.map(d => renderDocCard(d)).join('')}
    ${documents.length === 0 ? '<div style="padding:60px;text-align:center;color:var(--text-sec);background:var(--surface);border:1px solid var(--border);border-radius:var(--radius)">No documents analysed yet.</div>' : ''}
  </div>`;
}

async function viewDocument(id) {
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-sec)">Loading...</div>';
  try {
    const doc = await api(`/api/documents/${id}`);
    document.getElementById('pageTitle').textContent = doc.filename;
    document.getElementById('topActions').innerHTML = `<button class="btn btn-ghost btn-sm" onclick="navigateTo('documents')">← Back</button>`;
    const pct = Math.round(doc.risk_score * 100);
    const level = doc.risk_score > 0.6 ? 'high' : doc.risk_score > 0.35 ? 'medium' : 'low';
    main.innerHTML = `
      <div style="display:flex;gap:16px;align-items:center;margin-bottom:20px;flex-wrap:wrap">
        <div class="risk risk-${level}" style="font-size:24px;font-weight:700">${pct}% risk</div>
        <div style="font-size:13px;color:var(--text-sec)">${doc.doc_type} · ${doc.matter_id || 'Unassigned'}</div>
      </div>
      <div class="section-header"><h3>Extracted Clauses (${doc.clauses?.length || 0})</h3></div>
      <div class="clause-grid">
        ${doc.clauses?.map(c => `
          <div class="clause-card">
            <div class="top">
              <span class="title">${esc(c.clause_type)}</span>
              <span class="badge badge-${c.risk_level}">${c.risk_level}</span>
            </div>
            <div class="text">${esc(c.clause_text)}</div>
            <div style="font-size:12px;margin:8px 0;color:var(--red)"><strong>Risk:</strong> ${esc(c.risk_reason)}</div>
            <div style="font-size:12px;color:var(--green)"><strong>Suggestion:</strong> ${esc(c.suggestion)}</div>
          </div>
        `).join('') || '<div style="padding:20px;color:var(--text-sec)">No clauses extracted.</div>'}
      </div>
    `;
  } catch { main.innerHTML = '<div style="padding:40px;color:var(--red)">Failed to load document.</div>'; }
}

// Clauses
async function renderClauses() {
  document.getElementById('pageTitle').textContent = 'Clause Library';
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-sec)">Loading...</div>';
  try {
    [clauses, categories] = await Promise.all([api('/api/clauses'), api('/api/clauses/categories')]);
  } catch { clauses = []; categories = []; }
  main.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">
      <button class="btn btn-ghost btn-sm clause-filter active" onclick="filterClauses(null,this)">All (${clauses.length})</button>
      ${categories.map(c => `<button class="btn btn-ghost btn-sm clause-filter" onclick="filterClauses('${c.category}',this)">${c.category} (${c.count})</button>`).join('')}
    </div>
    <div class="clause-grid" id="clauseGrid">
      ${clauses.map(c => renderClauseCard(c)).join('')}
    </div>
  `;
}

function renderClauseCard(c) {
  return `<div class="clause-card" data-category="${c.category}">
    <div class="top">
      <span class="title">${esc(c.title)}</span>
      <span class="badge badge-${c.risk_level}">${c.risk_level}</span>
    </div>
    <div class="text">${esc(c.body)}</div>
    <div class="footer">
      <span>${esc(c.category)}</span>
      <span>·</span>
      <span>${esc(c.jurisdiction)}</span>
    </div>
    ${c.risk_template ? `<div style="margin-top:8px;padding:8px;background:var(--bg);border-radius:6px;font-size:12px;color:var(--text-sec)"><strong>Risk Note:</strong> ${esc(c.risk_template)}</div>` : ''}
  </div>`;
}

function filterClauses(cat, el) {
  document.querySelectorAll('.clause-filter').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.querySelectorAll('#clauseGrid .clause-card').forEach(c => {
    c.style.display = (!cat || c.dataset.category === cat) ? '' : 'none';
  });
}

// Chat
async function renderChat() {
  document.getElementById('pageTitle').textContent = 'AI Legal Assistant';
  const main = document.getElementById('mainContent');
  try { chats = await api('/api/chat'); } catch { chats = []; }
  if (!currentChatId && chats.length > 0) currentChatId = chats[0].id;
  main.innerHTML = `
    <div class="chat-layout">
      <div class="chat-sidebar">
        <div class="chat-sidebar-header">
          <button class="btn btn-primary btn-sm" style="width:100%" onclick="newChat()">+ New Chat</button>
        </div>
        <div class="chat-list">
          ${chats.map(c => `
            <div class="chat-item ${c.id === currentChatId ? 'active' : ''}" onclick="selectChat('${c.id}')">
              <div class="title">${esc(c.title)}</div>
              <div class="time">${new Date(c.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}</div>
            </div>
          `).join('')}
          ${chats.length === 0 ? '<div style="padding:20px;text-align:center;color:var(--text-sec);font-size:13px">No chats yet</div>' : ''}
        </div>
      </div>
      <div class="chat-main">
        <div class="chat-messages" id="chatMessages">
          <div style="text-align:center;padding:80px 20px;color:var(--text-sec)">
            <div style="font-size:32px;margin-bottom:12px">⚖️</div>
            <div style="font-size:18px;font-weight:600;color:var(--text);margin-bottom:8px">Vellum & Cipher AI</div>
            <div style="font-size:14px;margin-bottom:24px">Ask me anything about contracts, compliance, due diligence, or legal risk analysis.</div>
            <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
              <button class="btn btn-ghost btn-sm" onclick="sendQuick('Analyse the liability exposure in my current contract')">Risk Analysis</button>
              <button class="btn btn-ghost btn-sm" onclick="sendQuick('Draft a confidentiality clause for UK jurisdiction')">Draft Clause</button>
              <button class="btn btn-ghost btn-sm" onclick="sendQuick('Check GDPR compliance for this data processing agreement')">Compliance Check</button>
              <button class="btn btn-ghost btn-sm" onclick="sendQuick('Run due diligence on the uploaded documents')">Due Diligence</button>
            </div>
          </div>
        </div>
        <div class="chat-input-area">
          <div class="chat-input-wrap">
            <textarea id="chatInput" placeholder="Ask about contracts, compliance, risk..." rows="1" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage()}"></textarea>
            <button class="btn btn-primary" onclick="sendMessage()">Send</button>
          </div>
        </div>
      </div>
    </div>
  `;
  if (currentChatId) loadMessages(currentChatId);
}

async function newChat() {
  try {
    const chat = await api('/api/chats', { method: 'POST', body: JSON.stringify({ title: 'New Legal Query' }) });
    chats.unshift(chat);
    currentChatId = chat.id;
    renderChat();
  } catch {}
}

async function selectChat(id) {
  currentChatId = id;
  document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.chat-item[onclick*="${id}"]`)?.classList.add('active');
  await loadMessages(id);
}

async function loadMessages(chatId) {
  const el = document.getElementById('chatMessages');
  if (!el) return;
  try {
    const msgs = await api(`/api/chat/${chatId}/messages`);
    el.innerHTML = msgs.length === 0
      ? '<div style="text-align:center;padding:60px;color:var(--text-sec)">Start the conversation below</div>'
      : msgs.map(renderMessage).join('');
    el.scrollTop = el.scrollHeight;
  } catch {}
}

function renderMessage(m) {
  const parsed = parseMarkdown(m.content);
  const sources = m.sources ? (typeof m.sources === 'string' ? JSON.parse(m.sources) : m.sources) : [];
  return `<div class="message ${m.role}">
    <div class="avatar">${m.role === 'user' ? (user?.name?.[0] || 'U') : 'V'}</div>
    <div>
      <div class="bubble">${parsed}</div>
      ${sources.length > 0 ? `<div class="sources">${sources.map(s => `<span class="source-tag">${esc(s.title)}</span>`).join('')}</div>` : ''}
    </div>
  </div>`;
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';

  if (!currentChatId) {
    const chat = await api('/api/chats', { method: 'POST', body: JSON.stringify({ title: content.substring(0, 60) }) });
    currentChatId = chat.id;
    chats.unshift(chat);
  }

  const el = document.getElementById('chatMessages');
  el.innerHTML += renderMessage({ role: 'user', content });
  el.innerHTML += `<div class="message assistant" id="typingIndicator"><div class="avatar">V</div><div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div></div></div>`;
  el.scrollTop = el.scrollHeight;

  try {
    const res = await api(`/api/chats/${currentChatId}/messages`, { method: 'POST', body: JSON.stringify({ content }) });
    document.getElementById('typingIndicator')?.remove();
    el.innerHTML += renderMessage(res);
    el.scrollTop = el.scrollHeight;
  } catch {
    document.getElementById('typingIndicator')?.remove();
    el.innerHTML += `<div class="message assistant"><div class="avatar">V</div><div><div class="bubble" style="color:var(--red)">Failed to get response. Please try again.</div></div></div>`;
  }
}

function sendQuick(text) {
  const input = document.getElementById('chatInput');
  input.value = text;
  sendMessage();
}

// Matters
let currentMatterId = null;

async function loadMatters() {
  try { matters = await api('/api/matters'); } catch { matters = []; }
  renderSidebarMatters();
}

function renderSidebarMatters() {
  const el = document.getElementById('sidebarMatters');
  el.innerHTML = matters.map(m => `
    <div class="matter-item" onclick="openMatter('${m.id}')">
      <div class="dot ${m.status}"></div>
      <span>${esc(m.title)}</span>
    </div>
  `).join('');
}

async function openMatter(id) {
  currentMatterId = id;
  navigateTo('matter');
}

async function renderMatterDetail(id) {
  const main = document.getElementById('mainContent');
  main.innerHTML = '<div style="text-align:center;padding:60px;color:var(--text-sec)">Loading...</div>';
  try {
    const m = await api(`/api/matters/${id}`);
    document.getElementById('pageTitle').textContent = m.title;
    main.innerHTML = `
      <div class="matter-header">
        <div>
          <h2>${esc(m.title)}</h2>
          <div style="font-size:13px;color:var(--text-sec);margin-top:4px">${esc(m.client || 'No client')} · ${esc(m.status)}</div>
        </div>
      </div>
      <div style="font-size:14px;margin-bottom:20px;color:var(--text-sec)">${esc(m.description || '')}</div>
      <div class="detail-grid">
        <div class="detail-panel">
          <h4>Documents (${m.documents?.length || 0})</h4>
          ${m.documents?.length > 0 ? m.documents.map(d => `
            <div class="item" style="cursor:pointer" onclick="viewDocument('${d.id}')">
              <span class="label">${esc(d.filename)}</span>
              <span class="value risk-${d.risk_score > 0.6 ? 'high' : d.risk_score > 0.35 ? 'medium' : 'low'}">${Math.round(d.risk_score * 100)}% risk</span>
            </div>
          `).join('') : '<div style="padding:12px 0;color:var(--text-sec);font-size:13px">No documents</div>'}
        </div>
        <div class="detail-panel">
          <h4>Details</h4>
          <div class="item"><span class="label">Status</span><span class="value">${esc(m.status)}</span></div>
          <div class="item"><span class="label">Chats</span><span class="value">${m.chats?.length || 0}</span></div>
          <div class="item"><span class="label">Created</span><span class="value">${new Date(m.created_at).toLocaleDateString('en-GB')}</span></div>
        </div>
      </div>
    `;
  } catch { main.innerHTML = '<div style="padding:40px;color:var(--red)">Failed to load matter.</div>'; }
}

// Upload
async function loadMattersForModal() {
  const sel = document.getElementById('uploadMatter');
  sel.innerHTML = '<option value="">Unassigned</option>' + matters.map(m => `<option value="${m.id}">${esc(m.title)}</option>`).join('');
}

function openModal() {
  loadMattersForModal();
  document.getElementById('uploadModal').classList.add('show');
  document.getElementById('uploadFilename').value = '';
  document.getElementById('uploadContent').value = '';
}

function closeModal() {
  document.getElementById('uploadModal').classList.remove('show');
}

async function uploadDocument() {
  const filename = document.getElementById('uploadFilename').value.trim();
  const content = document.getElementById('uploadContent').value.trim();
  const matter_id = document.getElementById('uploadMatter').value || undefined;
  if (!filename || !content) { toast('Please provide a filename and document text'); return; }
  try {
    const res = await api('/api/documents/upload', { method: 'POST', body: JSON.stringify({ filename, content, matter_id, doc_type: 'contract' }) });
    closeModal();
    toast(`Document analysed — ${res.clauses_extracted} clauses extracted, ${res.risk_level} risk`);
    if (currentPage === 'documents') renderDocuments();
    else if (currentPage === 'dashboard') renderDashboard();
  } catch (err) { toast('Upload failed: ' + err.message); }
}

// Helpers
function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }

function parseMarkdown(md) {
  if (!md) return '';
  let html = esc(md);
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/gs, '<ul>$&</ul>');
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
