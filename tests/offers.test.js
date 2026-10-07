const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, today, daysAgo } = require('./helpers');

const PRODUCT = 1004;

let app;
let user;
let storeId;
let userId;

before(async () => {
    app = await startApp();
    user = app.client();
    await user.register('Reporter', 'reporter@example.com');
    userId = (await app.query('SELECT id FROM users WHERE email = ?', ['reporter@example.com']))[0].id;
    storeId = (await app.query('SELECT id FROM supermarkets ORDER BY id LIMIT 1'))[0].id;
});
after(async () => { await app.stop(); });

beforeEach(async () => {
    await app.query('DELETE FROM offers WHERE product_id = ?', [PRODUCT]);
    await app.query('DELETE FROM prices WHERE product_id = ?', [PRODUCT]);
    await app.query('UPDATE users SET tokens = 100 WHERE id = ?', [userId]);
});

const addPrice = (price, overrides = {}) => user.post('/addprice', {
    json: { price: String(price), date: today(), product_id: PRODUCT, supermarket_id: storeId, ...overrides },
});
const otherUsersPrice = (price, date) => app.query(
    'INSERT INTO offers (product_id, price, date, supermarket_id) VALUES (?, ?, ?, ?)',
    [PRODUCT, price, date, storeId]
);
const referencePrice = (price, date = today()) => app.query(
    'INSERT INTO prices (product_id, price, date) VALUES (?, ?, ?)',
    [PRODUCT, price, date]
);
const tokens = async () => (await app.query('SELECT tokens FROM users WHERE id = ?', [userId]))[0].tokens;

test('adding a price validates every field', async () => {
    assert.equal((await addPrice('')).body.error, 'All fields must be filled.');
    assert.equal((await addPrice('abc')).status, 400);
    assert.equal((await addPrice(-3)).status, 400);
    assert.equal((await addPrice(0)).status, 400);
    assert.equal((await addPrice(0.001)).status, 400);
    assert.equal((await addPrice(999999999999)).status, 400);
    assert.equal((await addPrice(2, { date: 'not-a-date' })).status, 400);
    assert.equal((await addPrice(2, { date: '2026-02-31' })).status, 400);
    assert.equal((await addPrice(2, { product_id: 999999 })).status, 400);
    assert.equal((await addPrice(2, { product_id: 'abc' })).status, 400);
    assert.equal((await addPrice(2, { supermarket_id: 999999 })).status, 400);
    assert.equal((await addPrice(2, { supermarket_id: 'abc' })).status, 400);
    assert.equal((await app.query('SELECT COUNT(*) AS n FROM offers WHERE product_id = ?', [PRODUCT]))[0].n, 0);
});

test('a valid price is stored with its author and appears first in the feed', async () => {
    const response = await addPrice(1.5);
    assert.equal(response.status, 201);
    assert.equal(response.body.added_by, userId);

    const feed = await user.get('/getprices');
    assert.equal(feed.body[0].product_name, 'Risotto Rice 500g');
    assert.equal(feed.body[0].price, 1.5);
    assert.equal(feed.body[0].username, 'Reporter');
    assert.ok(feed.body[0].supermarket_name);
});

test('20% below yesterday\'s average earns 50 tokens', async () => {
    await otherUsersPrice(10, daysAgo(1));
    const response = await addPrice(7);
    assert.equal(response.body.rewardPoints, 50);
    assert.equal(await tokens(), 150);
});

test('20% below the week\'s average earns 20 tokens', async () => {
    await otherUsersPrice(10, daysAgo(4));
    const response = await addPrice(7);
    assert.equal(response.body.rewardPoints, 20);
    assert.equal(await tokens(), 120);
});

test('a price that is not 20% lower earns nothing', async () => {
    await otherUsersPrice(10, daysAgo(4));
    assert.equal((await addPrice(8)).body.rewardPoints, 0);
    assert.equal((await addPrice(12)).body.rewardPoints, 0);
    assert.equal(await tokens(), 100);
});

test('with no user prices in the week the reference price is used', async () => {
    await referencePrice(10);
    assert.equal((await addPrice(9)).body.rewardPoints, 0);
    await app.query('DELETE FROM offers WHERE product_id = ?', [PRODUCT]);
    assert.equal((await addPrice(7)).body.rewardPoints, 20);
    assert.equal(await tokens(), 120);
});

test('the reference price is ignored when user prices exist', async () => {
    await referencePrice(5);
    await otherUsersPrice(10, daysAgo(4));
    assert.equal((await addPrice(7)).body.rewardPoints, 20);
});

test('with nothing to compare against there is no reward', async () => {
    assert.equal((await addPrice(0.1)).body.rewardPoints, 0);
    assert.equal(await tokens(), 100);
});

test('an unrealistically low price earns nothing', async () => {
    await otherUsersPrice(10, daysAgo(4));
    assert.equal((await addPrice(0.01)).body.rewardPoints, 0);
    assert.equal((await addPrice(4.99)).body.rewardPoints, 0);
    assert.equal(await tokens(), 100);
    assert.equal((await addPrice(5)).body.rewardPoints, 20);
});

test('a product is rewarded once per user per day', async () => {
    await otherUsersPrice(10, daysAgo(4));
    assert.equal((await addPrice(7)).body.rewardPoints, 20);
    assert.equal((await addPrice(7)).body.rewardPoints, 0);
    assert.equal((await addPrice(6)).body.rewardPoints, 0);
    assert.equal(await tokens(), 120);

    const stored = await app.query('SELECT reward_points FROM offers WHERE added_by = ? ORDER BY id', [userId]);
    assert.deepEqual(stored.map(row => row.reward_points), [20, 0, 0]);
});

test('reporting the same product for several past days is rewarded once', async () => {
    await referencePrice(10, daysAgo(10));
    const rewards = [];
    for (let days = 0; days < 4; days++) {
        rewards.push((await addPrice(7, { date: daysAgo(days) })).body.rewardPoints);
    }
    assert.deepEqual(rewards, [20, 0, 0, 0]);
    assert.equal(await tokens(), 120);
});

test('a date in the future is rejected', async () => {
    const response = await addPrice(2, { date: daysAgo(-1) });
    assert.equal(response.status, 400);
    assert.equal(response.body.error, 'The date cannot be in the future.');
});

test('a user\'s own prices do not count towards the average they have to beat', async () => {
    assert.equal((await addPrice(50, { date: daysAgo(1) })).body.rewardPoints, 0);
    assert.equal((await addPrice(39)).body.rewardPoints, 0);
    assert.equal(await tokens(), 100);
});

test('reports sent at the same moment are rewarded once', async () => {
    await otherUsersPrice(10, daysAgo(1));
    const responses = await Promise.all([addPrice(7), addPrice(7), addPrice(7)]);
    assert.deepEqual(responses.map(response => response.status), [201, 201, 201]);
    assert.deepEqual(responses.map(response => response.body.rewardPoints).sort(), [0, 0, 50]);
    assert.equal(await tokens(), 150);
});

test('an administrator can add a price but earns no reward', async () => {
    await otherUsersPrice(10, daysAgo(4));
    const admin = app.client();
    await admin.loginAsAdmin();
    const response = await admin.post('/addprice', {
        json: { price: '7', date: today(), product_id: PRODUCT, supermarket_id: storeId },
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.added_by, null);
    assert.equal(response.body.rewardPoints, 0);
});

test('the feed can be limited to one supermarket', async () => {
    const [busiest] = await app.query('SELECT supermarket_id, COUNT(*) AS n FROM offers GROUP BY supermarket_id ORDER BY n DESC LIMIT 1');
    const response = await user.get(`/getprices?supermarket_id=${busiest.supermarket_id}`);
    assert.equal(response.body.length, busiest.n);
    assert.equal(new Set(response.body.map(offer => offer.supermarket_name)).size, 1);
});

test('the statistics count prices per day and are for administrators only', async () => {
    assert.equal((await user.get(`/getOffers?date=${today()}`)).status, 403);

    const admin = app.client();
    await admin.loginAsAdmin();
    assert.equal((await admin.get('/getOffers')).status, 400);

    const response = await admin.get(`/getOffers?date=${today()}`);
    const expected = await app.query(
        'SELECT COUNT(*) AS n FROM offers WHERE YEAR(date) = YEAR(CURDATE()) AND MONTH(date) = MONTH(CURDATE())'
    );
    assert.equal(response.body.reduce((sum, day) => sum + day.offerCount, 0), expected[0].n);
});
