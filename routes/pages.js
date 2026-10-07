const express = require('express');
const path = require('path');
const { PAGES_PATH } = require('../config');
const { requireLoginPage, requireUserPage, requireAdminPage } = require('../middleware/auth');

const router = express.Router();
const page = (name) => (req, res) => res.sendFile(path.join(PAGES_PATH, name));

router.get('/', requireLoginPage, page('index.html'));
router.get('/login', page('login.html'));
router.get('/register', page('register.html'));
router.get('/map', requireLoginPage, page('map.html'));
router.get('/prices', requireLoginPage, page('prices.html'));
router.get('/product', requireLoginPage, page('products.html'));
router.get('/product-details', requireLoginPage, page('product-details.html'));
router.get('/add-price', requireLoginPage, page('add-price.html'));
router.get('/list', requireLoginPage, page('list.html'));
router.get('/history', requireUserPage, page('history.html'));
router.get('/admin', requireAdminPage, page('admin.html'));
router.get('/add-product', requireAdminPage, page('add-product.html'));
router.get('/stat', requireAdminPage, page('stat.html'));

module.exports = router;
