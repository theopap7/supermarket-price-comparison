const express = require('express');
const { db, withTransaction } = require('../db');
const { handle } = require('../utils');
const {
    DATE_PATTERN,
    TOKENS_PER_ACTION,
    REWARD_PRICE_RATIO,
    UNREALISTIC_PRICE_RATIO,
    DAILY_REWARD,
    WEEKLY_REWARD,
} = require('../config');
const { requireLogin, requireUser } = require('../middleware/auth');

const router = express.Router();

async function averageUserPrice(productId, date, days) {
    const [[row]] = await db.query(
        'SELECT AVG(price) AS avg_price FROM offers WHERE product_id = ? AND date < DATE(?) AND date >= DATE(?) - INTERVAL ? DAY',
        [productId, date, date, days]
    );
    return row.avg_price === null ? null : Number(row.avg_price);
}

async function referencePrice(productId, date) {
    const [rows] = await db.query(
        'SELECT price FROM prices WHERE product_id = ? AND date <= DATE(?) ORDER BY date DESC LIMIT 1',
        [productId, date]
    );
    return rows.length ? Number(rows[0].price) : null;
}

async function wasRewardedToday(userId, productId, date) {
    const [rows] = await db.query(
        'SELECT id FROM offers WHERE added_by = ? AND product_id = ? AND date = DATE(?) AND reward_points > 0 LIMIT 1',
        [userId, productId, date]
    );
    return rows.length > 0;
}

async function rewardFor({ price, productId, date, userId }) {
    if (!userId) {
        return 0;
    }

    const earnsReward = (comparedTo) => (
        comparedTo !== null
        && price < REWARD_PRICE_RATIO * comparedTo
        && price >= UNREALISTIC_PRICE_RATIO * comparedTo
    );
    const dailyAverage = await averageUserPrice(productId, date, 1);
    const weeklyAverage = await averageUserPrice(productId, date, 7);

    let rewardPoints = 0;
    if (earnsReward(dailyAverage)) {
        rewardPoints = DAILY_REWARD;
    } else if (earnsReward(weeklyAverage)) {
        rewardPoints = WEEKLY_REWARD;
    } else if (weeklyAverage === null && earnsReward(await referencePrice(productId, date))) {
        rewardPoints = WEEKLY_REWARD;
    }

    if (rewardPoints > 0 && await wasRewardedToday(userId, productId, date)) {
        return 0;
    }
    return rewardPoints;
}

router.post('/addprice', requireLogin, handle(async (req, res) => {
    const { date } = req.body;
    const price = Number(req.body.price);
    const productId = Number(req.body.product_id);
    const supermarketId = Number(req.body.supermarket_id);

    if (!req.body.price || !date || !req.body.product_id || !req.body.supermarket_id) {
        return res.status(400).json({ error: 'All fields must be filled.' });
    }
    if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ error: 'Enter a valid price.' });
    }
    if (!DATE_PATTERN.test(date) || Number.isNaN(Date.parse(date))) {
        return res.status(400).json({ error: 'Enter a valid date.' });
    }
    if (!Number.isInteger(productId) || !Number.isInteger(supermarketId)) {
        return res.status(400).json({ error: 'Select a product and a supermarket.' });
    }

    const [products] = await db.query('SELECT id FROM products WHERE id = ?', [productId]);
    const [supermarkets] = await db.query('SELECT id FROM supermarkets WHERE id = ?', [supermarketId]);
    if (!products.length || !supermarkets.length) {
        return res.status(400).json({ error: 'Select a product and a supermarket.' });
    }

    const addedBy = req.session.userId || null;
    const rewardPoints = await rewardFor({ price, productId, date, userId: addedBy });

    await withTransaction(async (conn) => {
        await conn.query(
            'INSERT INTO offers (price, date, product_id, supermarket_id, added_by, reward_points) VALUES (?, ?, ?, ?, ?, ?)',
            [price, date, productId, supermarketId, addedBy, rewardPoints]
        );
        if (rewardPoints > 0) {
            await conn.query('UPDATE users SET tokens = tokens + ? WHERE id = ?', [rewardPoints, addedBy]);
        }
    });

    res.status(201).json({
        price,
        date,
        product_id: productId,
        supermarket_id: supermarketId,
        added_by: addedBy,
        rewardPoints,
    });
}));

router.get('/getprices', requireLogin, handle(async (req, res) => {
    const params = [req.session.userId || 0];
    let where = '';
    if (req.query.supermarket_id) {
        where = 'WHERE o.supermarket_id = ?';
        params.push(req.query.supermarket_id);
    }

    const [rows] = await db.query(
        `SELECT o.id, o.price, o.date, o.added_by,
                p.name AS product_name, s.name AS supermarket_name,
                u.name AS username, u.profile_photo,
                COALESCE(SUM(r.action = 'like'), 0) AS likes,
                COALESCE(SUM(r.action = 'dislike'), 0) AS dislikes,
                MAX(CASE WHEN r.user_id = ? THEN r.action END) AS my_action
         FROM offers o
         JOIN products p ON p.id = o.product_id
         LEFT JOIN supermarkets s ON s.id = o.supermarket_id
         LEFT JOIN users u ON u.id = o.added_by
         LEFT JOIN ratings r ON r.offer_id = o.id
         ${where}
         GROUP BY o.id, p.name, s.name, u.name, u.profile_photo
         ORDER BY o.created_at DESC, o.id DESC`,
        params
    );

    res.json(rows.map(row => ({ ...row, price: Number(row.price), likes: Number(row.likes), dislikes: Number(row.dislikes) })));
}));

router.post('/like-dislike', requireUser, handle(async (req, res) => {
    const offerId = Number(req.body.id);
    const { action } = req.body;
    const userId = req.session.userId;

    if (!Number.isInteger(offerId) || !['like', 'dislike', 'undo'].includes(action)) {
        return res.status(400).json({ error: 'Invalid action.' });
    }

    const result = await withTransaction(async (conn) => {
        const [offers] = await conn.query('SELECT id, added_by FROM offers WHERE id = ? FOR UPDATE', [offerId]);
        if (!offers.length) {
            return { status: 404, error: 'Price entry not found.' };
        }
        const authorId = offers[0].added_by;
        if (authorId === userId) {
            return { status: 400, error: 'You cannot rate a price you added yourself.' };
        }

        const [existing] = await conn.query('SELECT action FROM ratings WHERE user_id = ? AND offer_id = ?', [userId, offerId]);
        const previousAction = existing.length ? existing[0].action : null;
        const nextAction = action === 'undo' ? null : action;
        if (previousAction === nextAction) {
            return {
                status: 400,
                error: nextAction ? 'You have already rated this price that way.' : 'There is no rating to undo.',
            };
        }

        if (!nextAction) {
            await conn.query('DELETE FROM ratings WHERE user_id = ? AND offer_id = ?', [userId, offerId]);
        } else if (previousAction) {
            await conn.query('UPDATE ratings SET action = ? WHERE user_id = ? AND offer_id = ?', [nextAction, userId, offerId]);
        } else {
            await conn.query('INSERT INTO ratings (user_id, offer_id, action) VALUES (?, ?, ?)', [userId, offerId, nextAction]);
        }

        const tokenChange = (TOKENS_PER_ACTION[nextAction] || 0) - (TOKENS_PER_ACTION[previousAction] || 0);
        if (authorId && tokenChange) {
            await conn.query('UPDATE users SET tokens = GREATEST(tokens + ?, 0) WHERE id = ?', [tokenChange, authorId]);
        }

        const [[counts]] = await conn.query(
            "SELECT COALESCE(SUM(action = 'like'), 0) AS likes, COALESCE(SUM(action = 'dislike'), 0) AS dislikes FROM ratings WHERE offer_id = ?",
            [offerId]
        );
        return { userAction: nextAction, likes: Number(counts.likes), dislikes: Number(counts.dislikes) };
    });

    if (result.error) {
        return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
}));

router.get('/get-user-history', requireUser, handle(async (req, res) => {
    const [rows] = await db.query(
        `SELECT r.offer_id, r.action, r.created_at, o.price, o.date,
                p.name AS product_name, s.name AS supermarket_name
         FROM ratings r
         JOIN offers o ON o.id = r.offer_id
         JOIN products p ON p.id = o.product_id
         LEFT JOIN supermarkets s ON s.id = o.supermarket_id
         WHERE r.user_id = ?
         ORDER BY r.created_at DESC`,
        [req.session.userId]
    );
    res.json(rows.map(row => ({ ...row, price: Number(row.price) })));
}));

router.get('/get-user-prices', requireUser, handle(async (req, res) => {
    const [rows] = await db.query(
        `SELECT o.id, o.price, o.date, o.created_at, o.reward_points AS rewardPoints,
                p.name AS product_name, s.name AS supermarket_name,
                COALESCE(SUM(r.action = 'like'), 0) AS likes,
                COALESCE(SUM(r.action = 'dislike'), 0) AS dislikes
         FROM offers o
         JOIN products p ON p.id = o.product_id
         LEFT JOIN supermarkets s ON s.id = o.supermarket_id
         LEFT JOIN ratings r ON r.offer_id = o.id
         WHERE o.added_by = ?
         GROUP BY o.id, p.name, s.name
         ORDER BY o.created_at DESC, o.id DESC`,
        [req.session.userId]
    );

    res.json(rows.map(row => {
        const likes = Number(row.likes);
        const dislikes = Number(row.dislikes);
        return {
            ...row,
            price: Number(row.price),
            likes,
            dislikes,
            tokensFromRatings: likes * TOKENS_PER_ACTION.like + dislikes * TOKENS_PER_ACTION.dislike,
        };
    }));
}));

module.exports = router;
