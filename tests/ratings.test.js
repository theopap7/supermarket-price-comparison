const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, today } = require('./helpers');

let app;
let author;
let rater;
let authorId;
let raterId;
let offerId;

before(async () => {
    app = await startApp();
    author = app.client();
    rater = app.client();
    await author.register('Author', 'author@example.com');
    await rater.register('Rater', 'rater@example.com');
    authorId = (await app.query('SELECT id FROM users WHERE email = ?', ['author@example.com']))[0].id;
    raterId = (await app.query('SELECT id FROM users WHERE email = ?', ['rater@example.com']))[0].id;

    const storeId = (await app.query('SELECT id FROM supermarkets ORDER BY id LIMIT 1'))[0].id;
    await author.post('/addprice', { json: { price: '99', date: today(), product_id: 1001, supermarket_id: storeId } });
    offerId = (await app.query('SELECT id FROM offers WHERE added_by = ?', [authorId]))[0].id;
});
after(async () => { await app.stop(); });

const rate = (client, action, id = offerId) => client.post('/like-dislike', { json: { id, action } });
const authorTokens = async () => (await app.query('SELECT tokens FROM users WHERE id = ?', [authorId]))[0].tokens;

test('users cannot rate their own price', async () => {
    const response = await rate(author, 'like');
    assert.equal(response.status, 400);
    assert.equal(await authorTokens(), 100);
});

test('a like adds one like and gives the author 5 tokens', async () => {
    const response = await rate(rater, 'like');
    assert.deepEqual(response.body, { userAction: 'like', likes: 1, dislikes: 0 });
    assert.equal(await authorTokens(), 105);
});

test('the same rating twice is rejected', async () => {
    assert.equal((await rate(rater, 'like')).status, 400);
    assert.equal(await authorTokens(), 105);
});

test('the feed reports the viewer\'s own rating', async () => {
    const feed = await rater.get('/getprices');
    const offer = feed.body.find(entry => entry.id === offerId);
    assert.equal(offer.my_action, 'like');
    assert.equal(offer.likes, 1);

    const authorsFeed = await author.get('/getprices');
    assert.equal(authorsFeed.body.find(entry => entry.id === offerId).my_action, null);
});

test('switching to dislike moves the count and the tokens', async () => {
    const response = await rate(rater, 'dislike');
    assert.deepEqual(response.body, { userAction: 'dislike', likes: 0, dislikes: 1 });
    assert.equal(await authorTokens(), 99);
});

test('undo removes the rating and restores the tokens', async () => {
    const response = await rate(rater, 'undo');
    assert.deepEqual(response.body, { userAction: null, likes: 0, dislikes: 0 });
    assert.equal(await authorTokens(), 100);
    assert.equal((await rate(rater, 'undo')).status, 400);
});

test('invalid ratings are rejected', async () => {
    assert.equal((await rate(rater, 'hack')).status, 400);
    assert.equal((await rate(rater, 'like', 99999999)).status, 404);
    assert.equal((await rate(rater, 'like', 'abc')).status, 400);
});

test('administrators cannot rate', async () => {
    const admin = app.client();
    await admin.loginAsAdmin();
    assert.equal((await rate(admin, 'like')).status, 403);
});

test('a user has at most one rating per price', async () => {
    await rate(rater, 'like');
    await rate(rater, 'dislike');
    await rate(rater, 'like');
    const rows = await app.query('SELECT action FROM ratings WHERE user_id = ? AND offer_id = ?', [raterId, offerId]);
    assert.deepEqual(rows.map(row => row.action), ['like']);
    assert.equal(await authorTokens(), 105);
});

test('the history lists the prices a user rated and the prices they added', async () => {
    const rated = await rater.get('/get-user-history');
    assert.equal(rated.body.length, 1);
    assert.equal(rated.body[0].product_name, 'Spaghetti No.6 500g');
    assert.equal(rated.body[0].action, 'like');

    const added = await author.get('/get-user-prices');
    assert.equal(added.body.length, 1);
    assert.equal(added.body[0].likes, 1);
    assert.equal(added.body[0].dislikes, 0);
    assert.equal(added.body[0].tokensFromRatings, 5);
    assert.equal(added.body[0].rewardPoints, 0);

    assert.deepEqual((await rater.get('/get-user-prices')).body, []);
});

test('the history is for users only', async () => {
    assert.equal((await app.client().get('/get-user-history')).status, 401);
    assert.equal((await app.client().get('/get-user-prices')).status, 401);

    const admin = app.client();
    await admin.loginAsAdmin();
    assert.equal((await admin.get('/get-user-prices')).status, 403);
});

test('seeded balances equal 100 plus the tokens from ratings', async () => {
    const maria = app.client();
    await maria.loginAsUser('maria');
    const added = await maria.get('/get-user-prices');
    const [row] = await app.query('SELECT tokens FROM users WHERE email = ?', ['maria@example.com']);
    assert.equal(100 + added.body.reduce((sum, offer) => sum + offer.tokensFromRatings, 0), row.tokens);
});
