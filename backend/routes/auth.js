const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const db = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { encrypt, decrypt, getHint } = require('../services/keyEncryption');

const router = express.Router();

// Configure Passport Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const googleId = profile.id;
    const email = profile.emails?.[0]?.value;
    const name = profile.displayName;
    const avatarUrl = profile.photos?.[0]?.value;

    if (!email) {
      return done(new Error('No email in Google profile'));
    }

    // Try to upsert user in database
    if (db.pool) {
      try {
        // First check if user with this email exists (maybe they signed up via local auth)
        const emailCheck = await db.query('SELECT * FROM users WHERE email = $1', [email]);
        if (emailCheck.rows.length > 0) {
          const user = emailCheck.rows[0];
          // If the user hasn't linked a google_id, link it now
          if (!user.google_id) {
            await db.query('UPDATE users SET google_id = $1, avatar_url = $2 WHERE id = $3', [googleId, avatarUrl, user.id]);
            user.google_id = googleId;
            user.avatar_url = avatarUrl;
          }
          return done(null, user);
        }

        const result = await db.query(
          `INSERT INTO users (google_id, email, name, avatar_url, plan)
           VALUES ($1, $2, $3, $4, 'free')
           ON CONFLICT (google_id) DO UPDATE SET
             email = EXCLUDED.email,
             name = EXCLUDED.name,
             avatar_url = EXCLUDED.avatar_url
           RETURNING id, google_id, email, name, avatar_url, plan`,
          [googleId, email, name, avatarUrl]
        );
        const user = result.rows[0];
        return done(null, user);
      } catch (err) {
        console.error('[auth] Database error upserting user:', err.message);
        // Fall back to session-only storage
        const user = { id: googleId, google_id: googleId, email, name, avatar_url: avatarUrl, plan: 'free' };
        return done(null, user);
      }
    } else {
      // No database – store in session only
      const user = { id: googleId, google_id: googleId, email, name, avatar_url: avatarUrl, plan: 'free' };
      return done(null, user);
    }
  } catch (err) {
    return done(err);
  }
}));

// Configure Passport Local Strategy
passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password'
}, async (email, password, done) => {
  try {
    if (!db.pool) return done(null, false, { message: 'Database not initialized' });

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return done(null, false, { message: 'Incorrect email or password.' });
    }

    const user = result.rows[0];

    // If no password hash, they likely signed up via Google only
    if (!user.password_hash) {
      return done(null, false, { message: 'Please sign in with Google.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return done(null, false, { message: 'Incorrect email or password.' });
    }

    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

// Serialize user into session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    // Try to fetch from database
    if (db.pool) {
      try {
        const result = await db.query(
          'SELECT id, google_id, email, name, avatar_url, plan FROM users WHERE id = $1',
          [id]
        );
        if (result.rows.length > 0) {
          return done(null, result.rows[0]);
        }
      } catch (err) {
        console.error('[auth] Database error deserializing user:', err.message);
      }
    }
    // If no DB or user not found, return minimal user
    done(null, { id });
  } catch (err) {
    done(err);
  }
});

// GET /auth/google – Initiate OAuth flow
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

// GET /auth/google/callback – OAuth callback
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Successful authentication
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/dashboard`);
  }
);

// POST /auth/signup — Create a new local user
router.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  if (!db.pool) return res.status(503).json({ error: 'Database not initialized' });

  try {
    // Check if user exists
    const check = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (check.rows.length > 0) {
      const user = check.rows[0];
      if (user.password_hash) {
        return res.status(400).json({ error: 'Email already registered' });
      } else if (user.google_id) {
        // User already has a Google account — tell them to link a password or just login via Google
        // For simplicity, we'll let them add a password here
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        await db.query('UPDATE users SET password_hash = $1, name = COALESCE($2, name) WHERE id = $3', [hash, name, user.id]);
        return res.json({ message: 'Password added to your existence. Please log in.' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const result = await db.query(
      'INSERT INTO users (email, password_hash, name, plan) VALUES ($1, $2, $3, $4) RETURNING id, email, name, plan',
      [email, hash, name || email.split('@')[0], 'free']
    );

    res.json({ message: 'Signup successful! Please log in.' });
  } catch (err) {
    console.error('[auth] Signup error:', err.message);
    res.status(500).json({ error: 'Unexpected error during signup' });
  }
});

// POST /auth/login — Local login
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return res.status(500).json({ error: 'Internal server error' });
    if (!user) return res.status(401).json({ error: info.message || 'Invalid credentials' });

    req.logIn(user, (err) => {
      if (err) return res.status(500).json({ error: 'Login failed' });
      return res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url,
        plan: user.plan
      });
    });
  })(req, res, next);
});

// GET /auth/me – Return current user
router.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const user = req.user;
    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar_url,
      plan: user.plan
    });
  }
  res.status(401).json({ error: 'Not authenticated' });
});

// POST /auth/logout – Destroy session
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out' });
  });
});

// ── API Key Management ────────────────────────────────────────────────────────

// GET /auth/keys — Return masked hints for configured providers
router.get('/keys', requireAuth, async (req, res) => {
  if (!db.pool) return res.json({});
  try {
    const result = await db.query(
      'SELECT provider, key_hint FROM api_keys WHERE user_id = $1',
      [req.user.id]
    );
    const keys = {};
    for (const row of result.rows) {
      keys[row.provider] = { configured: true, hint: row.key_hint };
    }
    return res.json(keys);
  } catch (err) {
    console.error('[auth] Error fetching keys:', err.message);
    res.status(500).json({ error: 'Failed to fetch keys' });
  }
});

// PUT /auth/keys — Save (upsert) encrypted API keys
// Body: { anthropic?: string, gemini?: string }
// Only providers included in the body are updated; omit a key to leave it unchanged.
router.put('/keys', requireAuth, async (req, res) => {
  if (!db.pool) return res.status(503).json({ error: 'Database not configured' });
  const { anthropic, gemini } = req.body;
  const userId = req.user.id;

  const updates = [];
  if (anthropic && anthropic.trim()) updates.push({ provider: 'anthropic', key: anthropic.trim() });
  if (gemini   && gemini.trim())    updates.push({ provider: 'gemini',     key: gemini.trim()   });

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No keys provided' });
  }

  try {
    for (const { provider, key } of updates) {
      const encryptedKey = encrypt(key);
      const hint = getHint(key);
      await db.query(
        `INSERT INTO api_keys (user_id, provider, encrypted_key, key_hint, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id, provider) DO UPDATE SET
           encrypted_key = EXCLUDED.encrypted_key,
           key_hint      = EXCLUDED.key_hint,
           updated_at    = NOW()`,
        [userId, provider, encryptedKey, hint]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[auth] Error saving keys:', err.message);
    res.status(500).json({ error: 'Failed to save keys' });
  }
});

// DELETE /auth/keys/:provider — Remove a single provider's key
router.delete('/keys/:provider', requireAuth, async (req, res) => {
  if (!db.pool) return res.status(503).json({ error: 'Database not configured' });
  const { provider } = req.params;
  if (!['anthropic', 'gemini'].includes(provider)) {
    return res.status(400).json({ error: 'Invalid provider' });
  }
  try {
    await db.query(
      'DELETE FROM api_keys WHERE user_id = $1 AND provider = $2',
      [req.user.id, provider]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[auth] Error deleting key:', err.message);
    res.status(500).json({ error: 'Failed to delete key' });
  }
});

module.exports = router;
