const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const TEST_DATABASE = process.env.TEST_DB_NAME || 'supermarket_test';
if (process.env.DB_NAME === TEST_DATABASE) {
    throw new Error(`The tests delete every table in "${TEST_DATABASE}". Point TEST_DB_NAME at a different database than DB_NAME.`);
}
process.env.DB_NAME = TEST_DATABASE;
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-session-secret';

const { seed, DEMO_ADMIN, DEMO_USER_PASSWORD } = require('../db/seed');

const PNG_HEADER = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

function createClient(baseUrl) {
    let cookie = '';

    async function request(method, url, { json, form, multipart } = {}) {
        const headers = {};
        let body;
        if (cookie) {
            headers.cookie = cookie;
        }
        if (json !== undefined) {
            headers['content-type'] = 'application/json';
            body = JSON.stringify(json);
        } else if (form !== undefined) {
            headers['content-type'] = 'application/x-www-form-urlencoded';
            body = new URLSearchParams(form).toString();
        } else if (multipart !== undefined) {
            body = multipart;
        }

        const response = await fetch(baseUrl + url, { method, headers, body, redirect: 'manual' });
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
            cookie = setCookie.split(';')[0];
        }

        const text = await response.text();
        let data = null;
        try {
            data = JSON.parse(text);
        } catch {
            data = null;
        }
        return { status: response.status, body: data, text, headers: response.headers, location: response.headers.get('location') };
    }

    return {
        get: (url) => request('GET', url),
        post: (url, options) => request('POST', url, options),
        delete: (url) => request('DELETE', url),
        login: (email, password) => request('POST', '/login-user', { json: { email, password } }),
        loginAsUser: (name = 'maria') => request('POST', '/login-user', { json: { email: `${name}@example.com`, password: DEMO_USER_PASSWORD } }),
        loginAsAdmin: () => request('POST', '/login-user', { json: { email: DEMO_ADMIN.email, password: DEMO_ADMIN.password } }),
        register: (name, email, password = 'long-enough-1') => request('POST', '/register-user', { json: { name, email, password } }),
    };
}

async function startApp() {
    await seed({ database: TEST_DATABASE, reset: true });

    const app = require('../app');
    const { db } = require('../db');
    const server = await new Promise(resolve => {
        const listening = app.listen(0, () => resolve(listening));
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    return {
        db,
        client: () => createClient(baseUrl),
        query: async (sql, params) => (await db.query(sql, params))[0],
        async stop() {
            server.closeAllConnections();
            await new Promise(resolve => server.close(resolve));
            await db.end();
        },
    };
}

function today() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function daysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

module.exports = { startApp, today, daysAgo, PNG_HEADER, DEMO_ADMIN };
