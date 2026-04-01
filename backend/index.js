require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const connectPgSimple = require('connect-pg-simple');

const db = require('./db');
const authRouter = require('./routes/auth');
const redesignRouter = require('./routes/redesign');
const snapshotRouter = require('./routes/snapshot');
const jobsRouter = require('./routes/jobs');
const publishRouter = require('./routes/publish');
const contactRouter = require('./routes/contact');
const waitlistRouter = require('./routes/waitlist');
const { findJobIdBySubdomain, getDistDir, registerSubdomain } = require('./services/publisher');
const path = require('path');
const fs = require('fs');
const expressStatic = require('express').static;

const app = express();
app.set("trust proxy", 1); // Trust Cloudflare + Nginx proxy
const PORT = process.env.PORT || 3001;

// ── Subdomain serving (must run before session/auth middleware) ──────────────
// Serves published projects on [slug].localhost:PORT or [slug].APP_DOMAIN
app.use((req, res, next) => {
  const host = req.hostname; // e.g. "stripe.localhost"
  const parts = host.split('.');
  // Only intercept if there's a subdomain prefix (2+ parts, first part isn't www/api/localhost)
  if (parts.length >= 2 && !['www', 'api'].includes(parts[0]) && parts[0] !== 'localhost') {
    const subdomain = parts[0];
    const jobId = findJobIdBySubdomain(subdomain);
    if (jobId) {
      const distDir = getDistDir(jobId);
      // Serve static assets
      expressStatic(distDir)(req, res, () => {
        // SPA fallback — serve index.html for unknown paths
        const indexFile = path.join(distDir, 'index.html');
        if (fs.existsSync(indexFile)) {
          res.sendFile(indexFile);
        } else {
          res.status(503).send('Site is still building. Please wait a moment and refresh.');
        }
      });
      return;
    }
  }
  next();
});


// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'img-src': ["'self'", 'data:', 'https://lh3.googleusercontent.com', 'https://*.googleusercontent.com', 'https://*.google.com'],
    }
  }
}));

// Session store (postgres or memory fallback)
const PgSession = connectPgSimple(session);
const sessionStore = db.pool ? new PgSession({ pool: db.pool, tableName: 'sessions' }) : undefined;

// Session middleware
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Passport authentication middleware
app.use(passport.initialize());
app.use(passport.session());

// CORS with credentials
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'DELETE', 'PUT'],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// Rate limiting on redesign endpoint (20 requests per hour per IP)
const redesignLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: 'Too many redesign requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
app.use('/auth', authRouter);
app.use('/api/redesign', redesignLimiter, redesignRouter);
app.use('/api/snapshot', snapshotRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/jobs', publishRouter);
app.use('/api/contact', contactRouter);
app.use('/api/waitlist', waitlistRouter);

// Health check endpoint
app.get('/api/health', (_, res) => res.json({ status: 'ok', version: '1.0.0' }));

// Delete job (soft delete – sets status to 'deleted')
const jobStore = require('./services/jobStore');
const requireAuth = require('./middleware/requireAuth');

app.delete('/api/jobs/:id', requireAuth, async (req, res) => {
  try {
    const jobId = req.params.id;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify the job belongs to this user
    if (db.pool) {
      const result = await db.query(
        'SELECT user_id FROM jobs WHERE id = $1',
        [jobId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (result.rows[0].user_id !== userId) {
        return res.status(403).json({ error: 'Not authorized to delete this job' });
      }

      // Soft delete
      await db.query(
        'UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2',
        ['deleted', jobId]
      );

      res.json({ message: 'Job deleted' });
    } else {
      res.status(500).json({ error: 'Database not configured' });
    }
  } catch (err) {
    console.error('[jobs] Delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

// Static file serving for Frontend (Production)
if (process.env.NODE_ENV === 'production' || fs.existsSync(path.join(__dirname, '../frontend/dist'))) {
  const frontendDist = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendDist));
  
  // Catch-all route for SPA — only for GET requests not hitting /api or /auth
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/auth')) return next();
    const indexPath = path.join(frontendDist, 'index.html');
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    next();
  });
}

app.listen(PORT, () => {
  const dbStatus = db.pool ? '[db: connected]' : '[db: offline]';
  console.log(`\x1b[36m✦ WebSight backend\x1b[0m  ${dbStatus}  http://localhost:${PORT}`);
});
