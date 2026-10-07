const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../db');
const { handle, text } = require('../utils');
const { PASSWORD_MIN_LENGTH, BCRYPT_ROUNDS, EMAIL_PATTERN } = require('../config');
const { startSession, requireLogin } = require('../middleware/auth');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.post('/register-user', registerLimiter, handle(async (req, res) => {
    const name = text(req.body.name);
    const email = text(req.body.email).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!name || !email || !password) {
        return res.json('fill all the fields');
    }
    if (!EMAIL_PATTERN.test(email)) {
        return res.json('enter a valid email');
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
        return res.json(`password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    }

    const [admins] = await db.query('SELECT id FROM administrators WHERE email = ?', [email]);
    if (admins.length) {
        return res.json('email already exists');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    let result;
    try {
        [result] = await db.query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, passwordHash]);
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.json('email already exists');
        }
        throw err;
    }

    await startSession(req, { userId: result.insertId, name, email });
    res.json({ name, email, isAdmin: false });
}));

router.post('/login-user', loginLimiter, handle(async (req, res) => {
    const email = text(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    const [users] = await db.query('SELECT id, name, email, password FROM users WHERE email = ?', [email]);
    if (users.length && await bcrypt.compare(password, users[0].password)) {
        const { id, name } = users[0];
        await startSession(req, { userId: id, name, email: users[0].email });
        res.locals.loggedIn = true;
        return res.json({ id, name, email: users[0].email, isAdmin: false });
    }

    const [admins] = await db.query('SELECT id, name, email, password FROM administrators WHERE email = ?', [email]);
    if (admins.length && await bcrypt.compare(password, admins[0].password)) {
        const { id, name } = admins[0];
        await startSession(req, { isAdmin: true, adminId: id, name, email: admins[0].email });
        res.locals.loggedIn = true;
        return res.json({ id, name, email: admins[0].email, isAdmin: true });
    }

    res.json('username or password is incorrect');
}));

router.get('/logout', (req, res, next) => {
    req.session.destroy(err => {
        if (err) return next(err);
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

router.get('/api/me', requireLogin, (req, res) => {
    res.json({
        id: req.session.userId || null,
        name: req.session.name,
        email: req.session.email,
        isAdmin: Boolean(req.session.isAdmin),
    });
});

module.exports = router;
