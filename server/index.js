const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const cors = require('cors');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
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

// Never let a browser or proxy keep an old answer (login state must always be fresh)
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

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


// ---- AI dream guide ----
const DREAM_GUIDE_PROMPT = `You are Dream Guide, the friendly dream-interpretation companion inside the Dreamscape dream journal website. You help the user explore what their dream might mean.

Rules:
- Always reply in the same language the user writes in (Armenian, Russian, English, or any other).
- When the user shares a new dream: give a warm, clear interpretation. Name the 2 to 4 main symbols or feelings, explain what they commonly stand for (from cultural and psychological perspectives), connect them into a short story of what the dream might be saying, then ask ONE gentle follow-up question about what is happening in the person's real life or how they felt.
- In later messages, answer what they ask, build on what they told you, and keep the conversation natural.
- Make it clear, in a light way, that interpretations are symbolic ideas for self-reflection and not facts or predictions. Never predict the future and never diagnose anything.
- If the user seems to be in distress, or mentions self-harm or wanting to die, respond with warmth, take it seriously, encourage them to talk to a trusted person or local emergency or crisis services, and do not interpret the dream in that message.
- Many users are students, so keep everything age-appropriate. Stay on dreams and gentle self-reflection; if asked about unrelated things, kindly steer back.
- Keep replies under about 250 words. Use plain text and short paragraphs, no markdown headings. You may use a few emojis such as ☾ or ✦ sparingly.`;

const dailyChat = { day: '', count: 0 };

function httpError(status, message) {
    const e = new Error(message);
    e.status = status;
    e.userMessage = message;
    return e;
}

// Free option: Google Gemini (key from aistudio.google.com)
async function askGemini(messages, signal) {
    const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
    const base = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta';
    const r = await fetch(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: DREAM_GUIDE_PROMPT }] },
            contents: messages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            })),
            generationConfig: { maxOutputTokens: 2048, temperature: 0.8 }
        }),
        signal
    });
    const data = await r.json().catch(() => null);
    if (r.status === 429) {
        console.error('Gemini quota reached:', JSON.stringify(data).slice(0, 300));
        throw httpError(429, 'The Dream Guide is very busy right now. Please try again in a minute.');
    }
    if (!r.ok || !data) {
        console.error('Gemini error:', r.status, JSON.stringify(data).slice(0, 400));
        throw httpError(500, 'The Dream Guide is resting for a moment. Please try again.');
    }
    const cand = (data.candidates || [])[0];
    const text = ((cand && cand.content && cand.content.parts) || []).map(p => p.text || '').join('').trim();
    if (!text) {
        console.error('Gemini gave no text:', JSON.stringify(data.promptFeedback || {}), cand && cand.finishReason);
        throw httpError(500, 'The Dream Guide could not answer that. Try describing your dream in other words.');
    }
    return text;
}

// Optional: Claude (needs paid credit at console.anthropic.com)
async function askClaude(messages, signal) {
    const r = await fetch(process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
            max_tokens: 700,
            system: DREAM_GUIDE_PROMPT,
            messages
        }),
        signal
    });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data) {
        console.error('Claude error:', r.status, JSON.stringify(data).slice(0, 300));
        throw httpError(500, 'The Dream Guide is resting for a moment. Please try again.');
    }
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (!text) throw httpError(500, 'The Dream Guide had no answer. Please try again.');
    return text;
}

app.post('/api/chat', requireLogin, wrap(async (req, res) => {
    const provider = process.env.GEMINI_API_KEY ? 'gemini' : (process.env.ANTHROPIC_API_KEY ? 'claude' : null);
    if (!provider) return res.status(500).json({ error: 'The Dream Guide is not set up yet.' });

    // Clean the conversation sent by the browser
    let msgs = Array.isArray(req.body.messages) ? req.body.messages : [];
    msgs = msgs
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
        .map(m => ({ role: m.role, content: m.content.trim().slice(0, 2000) }))
        .slice(-20);
    while (msgs.length && msgs[0].role !== 'user') msgs.shift();
    const clean = [];
    for (const m of msgs) {
        const last = clean[clean.length - 1];
        if (last && last.role === m.role) last.content += '\n' + m.content;
        else clean.push({ role: m.role, content: m.content });
    }
    if (!clean.length || clean[clean.length - 1].role !== 'user') {
        return res.status(400).json({ error: 'Please write a message first.' });
    }

    // Limits, so nobody can use up the free quota (or run up a bill)
    if (limited('chat:' + req.session.user.id, 20, 10 * 60 * 1000)) {
        return res.status(429).json({ error: 'You are sending messages very fast. Please wait a few minutes.' });
    }
    const today = new Date().toISOString().slice(0, 10);
    if (dailyChat.day !== today) { dailyChat.day = today; dailyChat.count = 0; }
    const dailyMax = parseInt(process.env.CHAT_DAILY_LIMIT || '300', 10);
    if (dailyChat.count >= dailyMax) {
        return res.status(429).json({ error: 'The Dream Guide has reached its limit for today. Please come back tomorrow.' });
    }
    dailyChat.count++;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
        const reply = provider === 'gemini'
            ? await askGemini(clean, controller.signal)
            : await askClaude(clean, controller.signal);
        res.json({ reply });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.userMessage });
        console.error('AI request failed:', err.message);
        res.status(500).json({ error: 'The Dream Guide is resting for a moment. Please try again.' });
    } finally {
        clearTimeout(timer);
    }
}));

// ---- Likes ----
function requireLogin(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'Please log in first.' });
    next();
}
const postIdOk = id => /^[a-z0-9-]{1,50}$/.test(id);

// Public: how many likes each post has, plus which ones the logged-in person liked
app.get('/api/likes', wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const counts = {};
    const all = await pool.query('SELECT post_id, COUNT(*)::int AS n FROM likes GROUP BY post_id');
    all.rows.forEach(r => { counts[r.post_id] = r.n; });
    let liked = [];
    if (req.session.user) {
        const mine = await pool.query('SELECT post_id FROM likes WHERE user_id = $1', [req.session.user.id]);
        liked = mine.rows.map(r => r.post_id);
    }
    res.json({ counts, liked });
}));

app.post('/api/likes/:postId', requireLogin, wrap(async (req, res) => {
    const postId = req.params.postId;
    if (!postIdOk(postId)) return res.status(400).json({ error: 'Bad post id' });
    await pool.query(
        'INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.session.user.id, postId]
    );
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM likes WHERE post_id = $1', [postId]);
    res.json({ success: true, liked: true, count: rows[0].n });
}));

app.delete('/api/likes/:postId', requireLogin, wrap(async (req, res) => {
    const postId = req.params.postId;
    if (!postIdOk(postId)) return res.status(400).json({ error: 'Bad post id' });
    await pool.query('DELETE FROM likes WHERE user_id = $1 AND post_id = $2', [req.session.user.id, postId]);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM likes WHERE post_id = $1', [postId]);
    res.json({ success: true, liked: false, count: rows[0].n });
}));

// ---- Password reset ----
const siteUrl = allowedOrigins[0];
const sha256 = v => crypto.createHash('sha256').update(v).digest('hex');

const hits = new Map(); // tiny in-memory rate limiter
function limited(key, max, windowMs) {
    const now = Date.now();
    const list = (hits.get(key) || []).filter(t => now - t < windowMs);
    list.push(now);
    hits.set(key, list);
    return list.length > max;
}

async function sendResetEmail(to, link) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
        // No email service set up: the owner can copy the link from the Render Logs.
        console.log(`[password reset] No RESEND_API_KEY set. Reset link for ${to}: ${link}`);
        return;
    }
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'Dreamscape <onboarding@resend.dev>',
            to: [to],
            subject: 'Reset your Dreamscape password',
            html: `<p>Someone asked to reset your Dreamscape password.</p>
                   <p><a href="${link}">Click here to choose a new password</a> (valid for 30 minutes).</p>
                   <p>If this was not you, ignore this email.</p>`
        })
    });
    if (!res.ok) {
        console.error('Email service error:', res.status, await res.text());
        console.log(`[password reset] Email could not be sent. Reset link for ${to}: ${link}`);
    }
}

app.post('/api/forgot-password', wrap(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!emailOk(email)) return res.status(400).json({ error: 'Please enter a valid email' });
    if (limited('fp:' + email, 3, 15 * 60 * 1000) || limited('fp:all', 100, 15 * 60 * 1000)) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    const { rows } = await pool.query('SELECT id, email FROM users WHERE email = $1', [email]);
    if (rows[0]) {
        const token = crypto.randomBytes(32).toString('hex');
        await pool.query('DELETE FROM password_resets WHERE user_id = $1', [rows[0].id]);
        await pool.query(
            "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 minutes')",
            [rows[0].id, sha256(token)]
        );
        try {
            await sendResetEmail(rows[0].email, `${siteUrl}/reset.html?token=${token}`);
        } catch (err) {
            console.error('Could not send reset email:', err.message);
        }
    }
    // Same answer whether or not the account exists
    res.json({ success: true });
}));

app.post('/api/reset-password', wrap(async (req, res) => {
    const token = String(req.body.token || '');
    const password = String(req.body.password || '');
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const { rows } = await pool.query(
        'SELECT user_id FROM password_resets WHERE token_hash = $1 AND expires_at > NOW()',
        [sha256(token)]
    );
    if (!rows[0]) return res.status(400).json({ error: 'This link is invalid or has expired. Ask for a new one.' });

    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, rows[0].user_id]);
    await pool.query('DELETE FROM password_resets WHERE user_id = $1', [rows[0].user_id]);
    await pool.query("DELETE FROM session WHERE sess->'user'->>'id' = $1", [String(rows[0].user_id)]);
    res.json({ success: true });
}));

// Admin gives someone a temporary password (for people who cannot use email)
app.post('/api/admin/user/:id/reset-password', requireAdmin, wrap(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
    const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let temp = '';
    for (let i = 0; i < 10; i++) temp += alphabet[crypto.randomInt(alphabet.length)];
    const hash = await bcrypt.hash(temp, 10);
    const { rowCount } = await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, id]);
    if (!rowCount) return res.status(404).json({ error: 'User not found' });
    await pool.query("DELETE FROM session WHERE sess->'user'->>'id' = $1", [String(id)]);
    res.json({ success: true, password: temp });
}));

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Server error. Please try again.' });
});

init()
    .then(() => app.listen(PORT, () => console.log(`Dreamscape server running on port ${PORT}`)))
    .catch(err => { console.error('Database connection failed:', err.message); process.exit(1); });
