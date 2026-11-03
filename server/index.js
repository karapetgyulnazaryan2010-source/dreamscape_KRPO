const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { pool, init } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production' || !!process.env.RENDER;

// Render puts a proxy in front of the app; needed for secure cookies.
app.set('trust proxy', 1);

// ---- CORS: only our own websites may call the API ----
const allowedOrigins = (process.env.FRONTEND_URL || 'https://dreamscape-web-five.vercel.app')
    .split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
const devOrigin = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

app.use(cors({
    origin(origin, cb) {
        if (!origin || allowedOrigins.includes(origin) || devOrigin.test(origin)) return cb(null, true);
        cb(null, false);
    },
    credentials: true
}));

app.use(express.json({ limit: '100kb' }));

if (isProd && !process.env.SESSION_SECRET) {
    console.warn('WARNING: SESSION_SECRET is not set. Set it in Render -> Environment.');
}

app.use(session({
    store: new PgSession({ pool, createTableIfMissing: true }), // sessions survive restarts
    secret: process.env.SESSION_SECRET || 'dev-only-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
    }
}));

const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const publicUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Admins only.' });
    }
    next();
}

function startSession(req, user) {
    return new Promise((resolve, reject) => {
        req.session.regenerate(err => {
            if (err) return reject(err);
            req.session.user = publicUser(user);
            req.session.save(err2 => (err2 ? reject(err2) : resolve()));
        });
    });
}

// ---- Routes ----
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/signup', wrap(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required' });
    if (name.length > 100) return res.status(400).json({ error: 'Name is too long' });
    if (!emailOk(email)) return res.status(400).json({ error: 'Please enter a valid email' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    // Role is never taken from the browser. Only ADMIN_EMAIL becomes admin.
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const role = adminEmail && email === adminEmail ? 'admin' : 'user';
    const hash = await bcrypt.hash(password, 10);

    try {
        const { rows } = await pool.query(
            'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
            [name, email, hash, role]
        );
        await startSession(req, rows[0]);
        res.json({ success: true, user: publicUser(rows[0]) });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: 'Email already exists' });
        throw err;
    }
}));

app.post('/api/signin', wrap(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    const match = user && await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    await startSession(req, user);
    res.json({ success: true, user: publicUser(user) });
}));

app.get('/api/me', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
    res.json(req.session.user);
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid', { sameSite: isProd ? 'none' : 'lax', secure: isProd });
        res.json({ success: true });
    });
});

app.get('/api/admin/users', requireAdmin, wrap(async (req, res) => {
    const { rows } = await pool.query('SELECT id, name, email, role FROM users ORDER BY id');
    res.json(rows);
}));

app.delete('/api/admin/user/:id', requireAdmin, wrap(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
    if (id === req.session.user.id) return res.status(400).json({ error: 'You cannot delete yourself' });
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
}));

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
});

init()
    .then(() => app.listen(PORT, () => console.log(`Dreamscape server running on port ${PORT}`)))
    .catch(err => { console.error('Database connection failed:', err.message); process.exit(1); });
