const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');

let app;
let user;
before(async () => {
    app = await startApp();
    user = app.client();
    await user.loginAsUser('maria');
});
after(async () => { await app.stop(); });

test('categories are listed alphabetically', async () => {
    const response = await user.get('/api/categories');
    assert.deepEqual(response.body.map(category => category.name), ['Baby Care', 'Cleaning', 'Dairy', 'Drinks', 'Pasta & Rice', 'Snacks']);
});

test('subcategories belong to the requested category', async () => {
    const response = await user.get('/api/subcategories?category=2');
    assert.deepEqual(response.body.map(subcategory => subcategory.name), ['Cheese', 'Milk', 'Yogurt']);
    assert.deepEqual((await user.get('/api/subcategories')).body, []);
});

test('products can be filtered by category and subcategory', async () => {
    assert.equal((await user.get('/api/products?category=&subcategory=')).body.length, 21);

    const drinks = await user.get('/api/products?category=3&subcategory=');
    assert.equal(drinks.body.length, 5);
    assert.ok(drinks.body.every(product => product.category_id === 3));

    const milk = await user.get('/api/products?category=2&subcategory=21');
    assert.deepEqual(milk.body.map(product => product.name), ['Fresh Whole Milk 1L', 'Semi-Skimmed Milk 1L']);
});

test('product search matches part of the name', async () => {
    const coffee = await user.get('/api/products/search?search=coffee');
    assert.deepEqual(coffee.body.map(product => product.name), ['Greek Coffee 200g', 'Instant Coffee 100g']);
    assert.deepEqual((await user.get('/api/products/search?search=')).body, []);
    assert.deepEqual((await user.get('/api/products/search?search=zzzz')).body, []);
});

test('a product page gets its names and both price series', async () => {
    const response = await user.get('/api/products/1007');
    assert.equal(response.body.name, 'Feta Cheese 400g');
    assert.equal(response.body.category, 'Dairy');
    assert.equal(response.body.subcategory, 'Cheese');
    assert.equal(response.body.prices.length, 31);
    assert.ok(Array.isArray(response.body.offers));
    assert.equal(typeof response.body.prices[0].price, 'number');
    assert.match(response.body.prices[0].date, /^\d{4}-\d{2}-\d{2}$/);
});

test('an unknown product returns 404', async () => {
    assert.equal((await user.get('/api/products/999999')).status, 404);
    assert.equal((await user.get('/api/products/abc')).status, 404);
});

test('the map gets one row per supermarket with numeric coordinates', async () => {
    const response = await user.get('/api/supermarkets-with-offer-status');
    assert.equal(response.body.length, 62);
    assert.equal(new Set(response.body.map(store => store.supermarket_id)).size, 62);
    assert.equal(typeof response.body[0].latitude, 'number');
    assert.equal(typeof response.body[0].longitude, 'number');

    const withOffers = response.body.filter(store => store.offer_count > 0);
    assert.equal(withOffers.length, 20);
    assert.ok(withOffers.every(store => store.offer_status === 'Has Offer'));
});

test('the map category filter keeps only stores with prices in that category', async () => {
    const filtered = await user.get('/api/supermarkets-with-offer-status?category=6');
    const expected = await app.query(
        `SELECT COUNT(DISTINCT o.supermarket_id) AS stores
         FROM offers o JOIN products p ON p.id = o.product_id
         WHERE p.category_id = 6`
    );
    assert.equal(filtered.body.length, expected[0].stores);
    assert.ok(filtered.body.every(store => store.supermarket_name && store.offer_count > 0));
});

test('a store popup gets at most ten recent prices with product names', async () => {
    const [busiest] = await app.query('SELECT supermarket_id FROM offers GROUP BY supermarket_id ORDER BY COUNT(*) DESC LIMIT 1');
    const response = await user.get(`/api/supermarket-offers?supermarket_id=${busiest.supermarket_id}`);
    assert.ok(response.body.length > 0 && response.body.length <= 10);
    assert.ok(response.body.every(offer => offer.product_name && typeof offer.price === 'number'));
});

test('the supermarket list carries addresses for the dropdown', async () => {
    const response = await user.get('/api/supermarkets');
    assert.equal(response.body.length, 62);
    assert.ok(response.body.every(store => store.name && store.address));
});
