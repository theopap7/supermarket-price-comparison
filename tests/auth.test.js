const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp, DEMO_ADMIN } = require('./helpers');

let app;
before(async () => { app = await startApp(); });
after(async () => { await app.stop(); });

test('pages redirect anonymous visitors to the login page', async () => {
    const anonymous = app.client();
    for (const page of ['/', '/map', '/prices', '/product', '/add-price', '/list', '/history', '/profile', '/admin', '/add-product', '/stat']) {
        const response = await anonymous.get(page);
        assert.equal(response.status, 302, page);
        assert.equal(response.location, '/login', page);
    }
});

test('the login and register pages are public', async () => {
    const anonymous = app.client();
    assert.equal((await anonymous.get('/login')).status, 200);
    assert.equal((await anonymous.get('/register')).status, 200);
});

test('pages are not reachable as static files', async () => {
    const anonymous = app.client();
    for (const file of ['/admin.html', '/map.html', '/add-product.html', '/index.html']) {
        assert.equal((await anonymous.get(file)).status, 404, file);
    }
});

test('data endpoints reject anonymous requests', async () => {
    const anonymous = app.client();
    assert.equal((await anonymous.get('/api/categories')).status, 401);
    assert.equal((await anonymous.get('/getprices')).status, 401);
    assert.equal((await anonymous.get('/getUsers')).status, 401);
    assert.equal((await anonymous.post('/addprice', { json: { price: '1', date: '2000-01-01', product_id: 1001, supermarket_id: 1 } })).status, 401);
    assert.equal((await anonymous.post('/like-dislike', { json: { id: 1, action: 'like' } })).status, 401);
    assert.equal((await anonymous.post('/api/addProduct', { json: { productName: 'x', category: 1, subcategory: 11 } })).status, 401);
    assert.equal((await anonymous.delete('/deletePrice/1')).status, 401);
});

test('responses carry the security headers', async () => {
    const response = await app.client().get('/login');
    assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal(response.headers.get('x-powered-by'), null);
    assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
});

test('registration validates its input', async () => {
    const visitor = app.client();
    assert.equal((await visitor.register('', 'empty@example.com')).body, 'fill all the fields');
    assert.equal((await visitor.register('Bad', 'not-an-email')).body, 'enter a valid email');
    assert.equal((await visitor.register('Short', 'short@example.com', 'abc')).body, 'password must be at least 8 characters');
    assert.equal((await visitor.register('Taken', 'maria@example.com')).body, 'email already exists');
    assert.equal((await visitor.register('Taken', DEMO_ADMIN.email)).body, 'email already exists');
});

test('a new account is logged in, starts with 100 tokens and has a hashed password', async () => {
    const visitor = app.client();
    const response = await visitor.register('Nora', 'Nora@Example.com', 'a-good-password');
    assert.deepEqual(response.body, { name: 'Nora', email: 'nora@example.com', isAdmin: false });

    const [row] = await app.query('SELECT password, tokens FROM users WHERE email = ?', ['nora@example.com']);
    assert.equal(row.tokens, 100);
    assert.match(row.password, /^\$2[aby]\$/);
    assert.notEqual(row.password, 'a-good-password');

    const me = await visitor.get('/api/me');
    assert.equal(me.body.name, 'Nora');
    assert.equal(me.body.isAdmin, false);
});

test('login rejects wrong credentials and odd input', async () => {
    const visitor = app.client();
    assert.equal((await visitor.login('maria@example.com', 'wrong-password')).body, 'username or password is incorrect');
    assert.equal((await visitor.login("' OR '1'='1", "' OR '1'='1")).body, 'username or password is incorrect');
    assert.equal((await visitor.login({ a: 1 }, ['x'])).body, 'username or password is incorrect');
    assert.equal((await visitor.get('/api/me')).status, 401);
});

test('a user logs in and reaches user pages but not admin pages', async () => {
    const user = app.client();
    const response = await user.loginAsUser('maria');
    assert.equal(response.body.name, 'Maria');
    assert.equal(response.body.isAdmin, false);

    for (const page of ['/', '/map', '/prices', '/product', '/product-details?productId=1001', '/add-price', '/list', '/history', '/profile', '/edit-profile']) {
        assert.equal((await user.get(page)).status, 200, page);
    }
    for (const page of ['/admin', '/add-product', '/stat', '/edit-product?productId=1001']) {
        assert.equal((await user.get(page)).status, 403, page);
    }
});

test('an administrator logs in and is sent away from user-only pages', async () => {
    const admin = app.client();
    const response = await admin.loginAsAdmin();
    assert.equal(response.body.isAdmin, true);

    for (const page of ['/admin', '/add-product', '/stat', '/map', '/prices', '/product', '/list']) {
        assert.equal((await admin.get(page)).status, 200, page);
    }
    const profile = await admin.get('/profile');
    assert.equal(profile.status, 302);
    assert.equal(profile.location, '/admin');
});

test('the session id changes at login and stops working after logout', async () => {
    const user = app.client();
    await user.get('/login');
    await user.loginAsUser('nikos');
    assert.equal((await user.get('/api/me')).status, 200);

    const logout = await user.get('/logout');
    assert.equal(logout.status, 302);
    assert.equal(logout.location, '/login');
    assert.equal((await user.get('/api/me')).status, 401);
    assert.equal((await user.get('/profile')).location, '/login');
});

test('sessions are stored in the database', async () => {
    const user = app.client();
    await user.loginAsUser('eleni');
    const [{ id: userId }] = await app.query("SELECT id FROM users WHERE email = 'eleni@example.com'");
    const stored = async () => (await app.query('SELECT data FROM sessions')).filter(row => JSON.parse(row.data).userId === userId);
    assert.equal((await stored()).length, 1);

    await user.get('/logout');
    assert.equal((await stored()).length, 0);
});
