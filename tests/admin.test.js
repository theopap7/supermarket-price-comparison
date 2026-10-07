const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');

let app;
let admin;
let user;

before(async () => {
    app = await startApp();
    admin = app.client();
    user = app.client();
    await admin.loginAsAdmin();
    await user.loginAsUser('eleni');
});
after(async () => { await app.stop(); });

const addProduct = (client, body) => client.post('/api/addProduct', { json: body });

test('an administrator adds a product and the database assigns its ID', async () => {
    const response = await addProduct(admin, { productName: 'Basmati Rice 1kg', category: 1, subcategory: 12 });
    assert.equal(response.status, 201);
    assert.equal(response.body.id, 1022);

    const [row] = await app.query('SELECT name, category_id, subcategory_id FROM products WHERE id = ?', [response.body.id]);
    assert.deepEqual({ ...row }, { name: 'Basmati Rice 1kg', category_id: 1, subcategory_id: 12 });
});

test('adding a product validates the name and the category pair', async () => {
    assert.equal((await addProduct(admin, { productName: '   ', category: 1, subcategory: 12 })).status, 400);
    assert.equal((await addProduct(admin, { productName: 'x'.repeat(256), category: 1, subcategory: 12 })).status, 400);
    assert.equal((await addProduct(admin, { productName: 'Wrong Pair', category: 1, subcategory: 21 })).status, 400);
    assert.equal((await addProduct(admin, { productName: 'No Category' })).status, 400);
});

test('the same product cannot be added twice to a subcategory', async () => {
    assert.equal((await addProduct(admin, { productName: 'Basmati Rice 1kg', category: 1, subcategory: 12 })).status, 409);
});

test('users cannot add, rename or open the edit page of a product', async () => {
    assert.equal((await addProduct(user, { productName: 'Sneaky', category: 1, subcategory: 12 })).status, 403);
    assert.equal((await user.post('/update-product', { form: { productId: 1001, name: 'Hacked' } })).status, 403);
    assert.equal((await user.get('/edit-product?productId=1001')).status, 403);
    assert.equal((await app.query('SELECT name FROM products WHERE id = 1001'))[0].name, 'Spaghetti No.6 500g');
});

test('an administrator renames a product', async () => {
    const page = await admin.get('/edit-product?productId=1002');
    assert.match(page.text, /Penne Rigate 500g/);

    const response = await admin.post('/update-product', { form: { productId: 1002, name: 'Penne Rigate 1kg' } });
    assert.equal(response.status, 302);
    assert.equal(response.location, '/product');
    assert.equal((await app.query('SELECT name FROM products WHERE id = 1002'))[0].name, 'Penne Rigate 1kg');
});

test('renaming validates the name and the product', async () => {
    assert.equal((await admin.post('/update-product', { form: { productId: 1002, name: '' } })).status, 400);
    assert.equal((await admin.post('/update-product', { form: { productId: 424242, name: 'Ghost' } })).status, 404);
    assert.equal((await admin.get('/edit-product?productId=424242')).status, 404);
});

test('product names are escaped in the edit page', async () => {
    await admin.post('/update-product', { form: { productId: 1003, name: '<b>Bold</b> Rice' } });
    const page = await admin.get('/edit-product?productId=1003');
    assert.ok(page.text.includes('&lt;b&gt;Bold&lt;/b&gt; Rice'));
    assert.ok(!page.text.includes('<b>Bold</b>'));
});

test('an administrator deletes a price together with its ratings', async () => {
    const [rated] = await app.query('SELECT offer_id FROM ratings LIMIT 1');
    assert.equal((await user.delete(`/deletePrice/${rated.offer_id}`)).status, 403);

    assert.equal((await admin.delete(`/deletePrice/${rated.offer_id}`)).status, 204);
    assert.equal((await app.query('SELECT COUNT(*) AS n FROM offers WHERE id = ?', [rated.offer_id]))[0].n, 0);
    assert.equal((await app.query('SELECT COUNT(*) AS n FROM ratings WHERE offer_id = ?', [rated.offer_id]))[0].n, 0);
    assert.equal((await admin.delete(`/deletePrice/${rated.offer_id}`)).status, 404);
});

test('the administrator sees every price in the feed', async () => {
    const feed = await admin.get('/getprices');
    const [count] = await app.query('SELECT COUNT(*) AS n FROM offers');
    assert.equal(feed.body.length, count.n);
});
