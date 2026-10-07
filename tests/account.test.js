const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { startApp, PNG_HEADER } = require('./helpers');

const uploadsPath = path.join(__dirname, '..', 'public', 'uploads');

let app;
let user;
let filesBefore;

before(async () => {
    app = await startApp();
    user = app.client();
    await user.register('Photo Person', 'photo@example.com');
    filesBefore = new Set(fs.readdirSync(uploadsPath));
});
after(async () => {
    for (const file of fs.readdirSync(uploadsPath)) {
        if (!filesBefore.has(file)) {
            fs.unlinkSync(path.join(uploadsPath, file));
        }
    }
    await app.stop();
});

function profileForm({ name = 'Photo Person', email = 'photo@example.com', file, type = 'image/png', filename = 'photo.png' } = {}) {
    const form = new FormData();
    form.append('name', name);
    form.append('email', email);
    if (file) {
        form.append('profilePhoto', new Blob([file], { type }), filename);
    }
    return form;
}

const save = (options) => user.post('/update-profile', { multipart: profileForm(options) });
const storedPhoto = async () => (await app.query('SELECT profile_photo FROM users WHERE email = ?', ['photo@example.com']))[0].profile_photo;

test('the profile page shows the name, email and tokens', async () => {
    const page = await user.get('/profile');
    assert.match(page.text, /Welcome, Photo Person!/);
    assert.match(page.text, /photo@example\.com/);
    assert.match(page.text, />100</);
});

test('a PNG photo is stored under a generated name and served back', async () => {
    const response = await save({ file: Buffer.concat([PNG_HEADER, Buffer.alloc(64)]) });
    assert.deepEqual(response.body, { success: true });

    const photo = await storedPhoto();
    assert.match(photo, /^[0-9a-f-]{36}\.png$/);
    assert.ok(fs.existsSync(path.join(uploadsPath, photo)));

    const served = await user.get(`/uploads/${photo}`);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('content-type'), 'image/png');
});

test('files that are not images are rejected', async () => {
    const photo = await storedPhoto();
    assert.equal((await save({ file: '<script>alert(1)</script>', filename: 'evil.html' })).status, 400);
    assert.equal((await save({ file: 'hello', type: 'text/plain', filename: 'notes.txt' })).status, 400);
    assert.equal(await storedPhoto(), photo);
});

test('photos over 2 MB are rejected', async () => {
    const large = Buffer.concat([PNG_HEADER, Buffer.alloc(3 * 1024 * 1024)]);
    assert.equal((await save({ file: large })).status, 400);
});

test('saving without a new photo keeps the current one', async () => {
    const photo = await storedPhoto();
    assert.deepEqual((await save({ name: 'Renamed Person' })).body, { success: true });
    assert.equal(await storedPhoto(), photo);
    assert.equal((await user.get('/api/me')).body.name, 'Renamed Person');
});

test('replacing the photo deletes the old file', async () => {
    const oldPhoto = await storedPhoto();
    await save({ file: Buffer.concat([PNG_HEADER, Buffer.alloc(32)]) });
    assert.notEqual(await storedPhoto(), oldPhoto);
    assert.equal(fs.existsSync(path.join(uploadsPath, oldPhoto)), false);
});

test('the profile rejects bad names and emails that are taken', async () => {
    assert.equal((await save({ name: '' })).status, 400);
    assert.equal((await save({ email: 'not-an-email' })).status, 400);
    assert.equal((await save({ email: 'maria@example.com' })).status, 409);
    assert.equal((await save({ email: 'admin@example.com' })).status, 409);
});

test('only logged-in users can change a profile', async () => {
    const anonymous = app.client();
    assert.equal((await anonymous.post('/update-profile', { multipart: profileForm() })).status, 401);

    const admin = app.client();
    await admin.loginAsAdmin();
    assert.equal((await admin.post('/update-profile', { multipart: profileForm() })).status, 403);
});

test('saving a profile after the account was deleted is rejected', async () => {
    const ghost = app.client();
    await ghost.register('Ghost', 'ghost@example.com');
    await app.query('DELETE FROM users WHERE email = ?', ['ghost@example.com']);

    const response = await ghost.post('/update-profile', { multipart: profileForm({ name: 'Ghost', email: 'ghost@example.com' }) });
    assert.equal(response.status, 401);
});

test('the leaderboard is sorted and paged', async () => {
    const one = await user.get('/getUsers?page=1');
    assert.equal(one.body.totalPages, 1);
    assert.equal(one.body.users.length, 7);
    assert.ok(one.body.users.every((entry, i) => i === 0 || one.body.users[i - 1].tokens >= entry.tokens));

    for (let i = 0; i < 9; i++) {
        await app.query('INSERT INTO users (name, email, password, tokens) VALUES (?, ?, ?, ?)', [`Extra ${i}`, `extra${i}@example.com`, 'x', 10 + i]);
    }
    const two = await user.get('/getUsers?page=2');
    assert.equal(two.body.totalPages, 2);
    assert.equal(two.body.page, 2);
    assert.equal(two.body.users.length, 1);

    assert.equal((await user.get('/getUsers?page=99')).body.page, 2);
    assert.equal((await user.get('/getUsers?page=abc')).body.page, 1);
});
