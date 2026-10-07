const express = require('express');
const { db } = require('../db');
const { handle } = require('../utils');
const { USERS_PER_PAGE } = require('../config');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

router.get('/getUsers', requireLogin, handle(async (req, res) => {
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM users');
    const totalPages = Math.max(1, Math.ceil(total / USERS_PER_PAGE));
    const requestedPage = Number.parseInt(req.query.page, 10);
    const pageNumber = Number.isInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, totalPages) : 1;
    const [rows] = await db.query(
        'SELECT name, tokens FROM users ORDER BY tokens DESC, name LIMIT ? OFFSET ?',
        [USERS_PER_PAGE, (pageNumber - 1) * USERS_PER_PAGE]
    );
    res.json({ users: rows, page: pageNumber, totalPages, perPage: USERS_PER_PAGE });
}));

module.exports = router;
