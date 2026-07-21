const express = require('express');
const path = require('path');
const cors = require('cors');
const { initDB } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(express.static(path.join(__dirname, 'public')));

initDB().then(() => {
  const authRoutes = require('./routes/auth');
  const chatRoutes = require('./routes/chat');
  const documentRoutes = require('./routes/documents');
  const clauseRoutes = require('./routes/clauses');
  const matterRoutes = require('./routes/matters');

  app.use('/api/auth', authRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/clauses', clauseRoutes);
  app.use('/api/matters', matterRoutes);

  // SPA fallback — MUST be after API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vellum & Cipher running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
