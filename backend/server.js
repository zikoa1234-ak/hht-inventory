require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// API Routes
app.use('/api/sites', require('./routes/sites'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/positions', require('./routes/positions'));
app.use('/api/models', require('./routes/models'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/export', require('./routes/export'));
app.use('/api/assets', require('./routes/assets'));

// Serve static frontend in production
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));
app.get('/', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`HHT Inventory API running on http://localhost:${PORT}`);
});
