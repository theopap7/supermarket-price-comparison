const express = require('express');
const { db, withTransaction } = require('../db');
const { handle, text } = require('../utils');
const { DATE_PATTERN, PRODUCT_NAME_MAX_LENGTH } = require('../config');
const { isAdmin, requireAdminPage } = require('../middleware/auth');

const router = express.Router();

const isValidProductName = (name) => name.length > 0 && name.length <= PRODUCT_NAME_MAX_LENGTH;

router.post('/api/addProduct', isAdmin, handle(async (req, res) => {
    const name = text(req.body.productName);
    const categoryId = Number(req.body.category);
    const subcategoryId = Number(req.body.subcategory);

    if (!isValidProductName(name)) {
        return res.status(400).json({ error: 'Enter a product name.' });
    }
    if (!Number.isInteger(categoryId) || !Number.isInteger(subcategoryId)) {
        return res.status(400).json({ error: 'Select a category and one of its subcategories.' });
    }

    const [subcategories] = await db.query(
        'SELECT id FROM subcategories WHERE id = ? AND parent_category_id = ?',
        [subcategoryId, categoryId]
    );
    if (!subcategories.length) {
        return res.status(400).json({ error: 'Select a category and one of its subcategories.' });
    }

    const [existing] = await db.query('SELECT id FROM products WHERE name = ? AND subcategory_id = ?', [name, subcategoryId]);
    if (existing.length) {
        return res.status(409).json({ error: 'This product already exists in the subcategory.' });
    }

    const [result] = await db.query(
        'INSERT INTO products (name, category_id, subcategory_id) VALUES (?, ?, ?)',
        [name, categoryId, subcategoryId]
    );

    res.status(201).json({ message: 'Product inserted successfully', id: result.insertId });
}));

router.get('/edit-product', requireAdminPage, handle(async (req, res) => {
    const [rows] = await db.query('SELECT id, name FROM products WHERE id = ?', [req.query.productId]);
    if (!rows.length) {
        return res.status(404).send('Product not found.');
    }
    res.render('edit-product', { product: rows[0] });
}));

router.post('/update-product', requireAdminPage, handle(async (req, res) => {
    const name = text(req.body.name);
    if (!isValidProductName(name)) {
        return res.status(400).send('Enter a product name.');
    }

    const [result] = await db.query('UPDATE products SET name = ? WHERE id = ?', [name, req.body.productId]);
    if (!result.affectedRows) {
        return res.status(404).send('Product not found.');
    }
    res.redirect('/product');
}));

router.delete('/deletePrice/:id', isAdmin, handle(async (req, res) => {
    const deleted = await withTransaction(async (conn) => {
        await conn.query('DELETE FROM ratings WHERE offer_id = ?', [req.params.id]);
        const [result] = await conn.query('DELETE FROM offers WHERE id = ?', [req.params.id]);
        return result.affectedRows;
    });

    if (!deleted) {
        return res.status(404).json({ error: 'Price entry not found' });
    }
    res.sendStatus(204);
}));

router.get('/getOffers', isAdmin, handle(async (req, res) => {
    const selectedDate = text(req.query.date);
    if (!DATE_PATTERN.test(selectedDate)) {
        return res.status(400).json({ error: 'Select a date.' });
    }

    const [year, month] = selectedDate.split('-');
    const [rows] = await db.query(
        'SELECT date, COUNT(*) AS offerCount FROM offers WHERE YEAR(date) = ? AND MONTH(date) = ? GROUP BY date ORDER BY date',
        [year, month]
    );
    res.json(rows);
}));

module.exports = router;
