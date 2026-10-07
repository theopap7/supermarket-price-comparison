const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db } = require('../db');
const { handle, text } = require('../utils');
const { EMAIL_PATTERN, UPLOADS_PATH } = require('../config');
const { requireUser, requireUserPage } = require('../middleware/auth');
const { upload, imageExtension, invalidImageError } = require('../middleware/upload');

const router = express.Router();

router.get('/profile', requireUserPage, handle(async (req, res) => {
    const [rows] = await db.query('SELECT name, email, profile_photo, tokens FROM users WHERE id = ?', [req.session.userId]);
    if (!rows.length) {
        return res.redirect('/logout');
    }
    res.render('profile-info', { profileData: rows[0] });
}));

router.get('/edit-profile', requireUserPage, handle(async (req, res) => {
    const [rows] = await db.query('SELECT name, email, profile_photo FROM users WHERE id = ?', [req.session.userId]);
    if (!rows.length) {
        return res.redirect('/logout');
    }
    res.render('edit-profile', { profileData: rows[0] });
}));

router.post('/update-profile', requireUser, upload.single('profilePhoto'), handle(async (req, res) => {
    const name = text(req.body.name);
    const email = text(req.body.email).toLowerCase();

    if (!name || !EMAIL_PATTERN.test(email)) {
        return res.status(400).json({ success: false, error: 'Enter a name and a valid email.' });
    }

    let newPhoto = null;
    if (req.file) {
        const extension = imageExtension(req.file.buffer);
        if (!extension) {
            throw invalidImageError();
        }
        newPhoto = crypto.randomUUID() + extension;
    }

    const [admins] = await db.query('SELECT id FROM administrators WHERE email = ?', [email]);
    if (admins.length) {
        return res.status(409).json({ success: false, error: 'This email is already in use.' });
    }

    const [[current]] = await db.query('SELECT profile_photo FROM users WHERE id = ?', [req.session.userId]);
    if (!current) {
        return res.status(401).json({ success: false, error: 'You must be logged in.' });
    }
    try {
        await db.query(
            'UPDATE users SET name = ?, email = ?, profile_photo = ? WHERE id = ?',
            [name, email, newPhoto || current.profile_photo, req.session.userId]
        );
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, error: 'This email is already in use.' });
        }
        throw err;
    }

    if (newPhoto) {
        await fs.promises.mkdir(UPLOADS_PATH, { recursive: true });
        await fs.promises.writeFile(path.join(UPLOADS_PATH, newPhoto), req.file.buffer);
        if (current.profile_photo) {
            fs.unlink(path.join(UPLOADS_PATH, path.basename(current.profile_photo)), () => {});
        }
    }

    req.session.name = name;
    req.session.email = email;
    res.json({ success: true });
}));

module.exports = router;
