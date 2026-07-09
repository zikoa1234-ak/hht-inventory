require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3001;

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// CORS — restrict in production
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '5mb' }));

// Rate limiting on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per window
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiter to auth routes
app.use('/api/auth/login', authLimiter);

// Auth routes (public: login; protected: register, me, change-password)
app.use('/api/auth', require('./routes/auth'));

// Admin routes (all protected by admin role)
app.use('/api/admin', require('./routes/admin'));

// API Routes — some are public, some protected by auth middleware
const { requireAuth, requireRole } = require('./middleware/auth');

// Public routes (read-only access for viewing data)
app.use('/api/sites', require('./routes/sites'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/positions', require('./routes/positions'));
app.use('/api/models', require('./routes/models'));
app.use('/api/export', require('./routes/export'));
app.use('/api/assets', require('./routes/assets'));

// Sessions require auth
app.use('/api/sessions', requireAuth, require('./routes/sessions'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve static frontend in production
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));
app.get('/', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));

// Catch-all for SPA routing — serve index.html for unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.listen(PORT, () => {
  console.log(`HHT Inventory API running on http://localhost:${PORT}`);
});