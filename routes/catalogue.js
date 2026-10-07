const express = require('express');
const { db } = require('../db');
const { handle, text } = require('../utils');
const { OFFERS_PER_POPUP } = require('../config');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

router.get('/api/categories', requireLogin, handle(async (req, res) => {
    const [rows] = await db.query('SELECT id, name FROM categories ORDER BY name');
    res.json(rows);
}));

router.get('/api/subcategories', requireLogin, handle(async (req, res) => {
    const [rows] = await db.query(
        'SELECT id, name, parent_category_id FROM subcategories WHERE parent_category_id = ? ORDER BY name',
        [req.query.category]
    );
    res.json(rows);
}));

router.get('/api/products', requireLogin, handle(async (req, res) => {
    const conditions = [];
    const params = [];
    if (req.query.category) {
        conditions.push('category_id = ?');
        params.push(req.query.category);
    }
    if (req.query.subcategory) {
        conditions.push('subcategory_id = ?');
        params.push(req.query.subcategory);
    }

    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await db.query(`SELECT id, name, category_id, subcategory_id FROM products${where} ORDER BY name`, params);
    res.json(rows);
}));

router.get('/api/products/search', requireLogin, handle(async (req, res) => {
    const search = text(req.query.search);
    if (!search) {
        return res.json([]);
    }
    const [rows] = await db.query(
        'SELECT id, name, category_id, subcategory_id FROM products WHERE name LIKE ? ORDER BY name',
        [`%${search}%`]
    );
    res.json(rows);
}));

router.get('/api/products/:productId', requireLogin, handle(async (req, res) => {
    const productId = Number(req.params.productId);
    if (!Number.isInteger(productId)) {
        return res.status(404).json({ error: 'Product not found.' });
    }

    const [products] = await db.query(
        `SELECT p.id, p.name, c.name AS category, s.name AS subcategory
         FROM products p
         JOIN categories c ON c.id = p.category_id
         JOIN subcategories s ON s.id = p.subcategory_id
         WHERE p.id = ?`,
        [productId]
    );
    if (!products.length) {
        return res.status(404).json({ error: 'Product not found.' });
    }

    const [prices] = await db.query(
        'SELECT date, ROUND(AVG(price), 2) AS price FROM prices WHERE product_id = ? GROUP BY date ORDER BY date',
        [productId]
    );
    const [offers] = await db.query(
        'SELECT date, ROUND(AVG(price), 2) AS price FROM offers WHERE product_id = ? GROUP BY date ORDER BY date',
        [productId]
    );
    const toPoint = ({ date, price }) => ({ date, price: Number(price) });

    res.json({ ...products[0], prices: prices.map(toPoint), offers: offers.map(toPoint) });
}));

router.get('/api/supermarkets', requireLogin, handle(async (req, res) => {
    const [rows] = await db.query('SELECT id, name, address FROM supermarkets ORDER BY name, address');
    res.json(rows);
}));

router.get('/api/supermarkets-with-offer-status', requireLogin, handle(async (req, res) => {
    const select = `SELECT s.id AS supermarket_id, s.name AS supermarket_name, s.address,
                           s.latitude, s.longitude, COUNT(o.id) AS offer_count
                    FROM supermarkets s`;
    const [rows] = req.query.category
        ? await db.query(
            `${select}
             JOIN offers o ON o.supermarket_id = s.id
             JOIN products p ON p.id = o.product_id
             WHERE p.category_id = ?
             GROUP BY s.id`,
            [req.query.category]
        )
        : await db.query(`${select} LEFT JOIN offers o ON o.supermarket_id = s.id GROUP BY s.id`);

    res.json(rows.map(row => ({
        ...row,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        offer_status: row.offer_count > 0 ? 'Has Offer' : 'No Offer',
    })));
}));

router.get('/api/supermarket-offers', requireLogin, handle(async (req, res) => {
    const [rows] = await db.query(
        `SELECT o.id, o.price, o.date, p.name AS product_name
         FROM offers o
         JOIN products p ON p.id = o.product_id
         WHERE o.supermarket_id = ?
         ORDER BY o.date DESC, o.id DESC
         LIMIT ?`,
        [req.query.supermarket_id, OFFERS_PER_POPUP]
    );
    res.json(rows.map(row => ({ ...row, price: Number(row.price) })));
}));

module.exports = router;
