const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');

const LOGIN_MAX_FAILURES = 10;

let app;
before(async () => { app = await startApp(); });
after(async () => { await app.stop(); });

test('successful logins do not count towards the limit', async () => {
    for (let i = 0; i < LOGIN_MAX_FAILURES + 3; i++) {
        const response = await app.client().loginAsUser('maria');
        assert.equal(response.status, 200);
        assert.equal(response.body.name, 'Maria');
    }
});

test('login is blocked after ten failed attempts', async () => {
    const attacker = app.client();
    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
        const response = await attacker.login('maria@example.com', `guess-${i}`);
        assert.equal(response.status, 200);
        assert.equal(response.body, 'username or password is incorrect');
    }

    const blocked = await attacker.login('maria@example.com', 'one-more-guess');
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body, 'too many attempts, try again later');

    const evenWithTheRightPassword = await attacker.loginAsUser('maria');
    assert.equal(evenWithTheRightPassword.status, 429);
});
