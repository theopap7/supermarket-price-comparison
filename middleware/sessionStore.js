const session = require('express-session');
const { db } = require('../db');
const { SESSION_TTL_MS, SESSION_CLEANUP_INTERVAL_MS } = require('../config');

class MySQLSessionStore extends session.Store {
    constructor() {
        super();
        setInterval(() => {
            db.query('DELETE FROM sessions WHERE expires_at <= NOW()').catch(() => {});
        }, SESSION_CLEANUP_INTERVAL_MS).unref();
    }

    get(sid, callback) {
        db.query('SELECT data FROM sessions WHERE id = ? AND expires_at > NOW()', [sid])
            .then(([rows]) => callback(null, rows.length ? JSON.parse(rows[0].data) : null))
            .catch(callback);
    }

    set(sid, sessionData, callback = () => {}) {
        db.query(
            `INSERT INTO sessions (id, data, expires_at) VALUES (?, ?, NOW() + INTERVAL ? SECOND)
             ON DUPLICATE KEY UPDATE data = VALUES(data), expires_at = VALUES(expires_at)`,
            [sid, JSON.stringify(sessionData), secondsToLive(sessionData)]
        )
            .then(() => callback(null))
            .catch(callback);
    }

    touch(sid, sessionData, callback = () => {}) {
        db.query('UPDATE sessions SET expires_at = NOW() + INTERVAL ? SECOND WHERE id = ?', [secondsToLive(sessionData), sid])
            .then(() => callback(null))
            .catch(callback);
    }

    destroy(sid, callback = () => {}) {
        db.query('DELETE FROM sessions WHERE id = ?', [sid])
            .then(() => callback(null))
            .catch(callback);
    }
}

function secondsToLive(sessionData) {
    const maxAge = sessionData.cookie && sessionData.cookie.maxAge;
    return Math.ceil((typeof maxAge === 'number' ? maxAge : SESSION_TTL_MS) / 1000);
}

module.exports = { MySQLSessionStore };
