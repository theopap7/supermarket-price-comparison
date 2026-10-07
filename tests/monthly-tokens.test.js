const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');

const POOL_PER_USER = 80;

let app;
let distributeTokensToUsersMonthly;
before(async () => {
    app = await startApp();
    ({ distributeTokensToUsersMonthly } = require('../jobs/monthlyTokens'));
    await app.query('DELETE FROM offers');
});
after(async () => { await app.stop(); });

const nextMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 5);
};
const balances = async () => new Map((await app.query('SELECT id, tokens FROM users')).map(user => [user.id, user.tokens]));

test('nothing is distributed when nobody earned anything during the month', async () => {
    const before = await balances();
    await distributeTokensToUsersMonthly(nextMonth());
    assert.deepEqual(await balances(), before);
});

test('the monthly pool is shared in proportion to what each user earned', async () => {
    const users = await app.query('SELECT id FROM users ORDER BY id');
    const [first, second, third] = users.map(user => user.id);
    const [{ id: productId }] = await app.query('SELECT id FROM products LIMIT 1');
    const [{ id: storeId }] = await app.query('SELECT id FROM supermarkets LIMIT 1');
    const addOffer = async (userId, rewardPoints) => (await app.query(
        'INSERT INTO offers (product_id, price, date, added_by, supermarket_id, reward_points) VALUES (?, 1, CURDATE(), ?, ?, ?)',
        [productId, userId, storeId, rewardPoints]
    )).insertId;

    await addOffer(first, 50);
    const liked = await addOffer(second, 20);
    const disliked = await addOffer(third, 0);
    await app.query("INSERT INTO ratings (user_id, offer_id, action) VALUES (?, ?, 'like')", [first, liked]);
    await app.query("INSERT INTO ratings (user_id, offer_id, action) VALUES (?, ?, 'dislike')", [first, disliked]);

    const before = await balances();
    const pool = users.length * POOL_PER_USER;
    await distributeTokensToUsersMonthly(nextMonth());
    const after = await balances();

    assert.equal(after.get(first) - before.get(first), Math.floor(pool * 50 / 75));
    assert.equal(after.get(second) - before.get(second), Math.floor(pool * 25 / 75));
    assert.equal(after.get(third), before.get(third));

    await distributeTokensToUsersMonthly(new Date());
    assert.deepEqual(await balances(), after);
});
