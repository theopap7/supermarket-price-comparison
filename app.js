const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const { SESSION_SECRET, PUBLIC_PATH, VIEWS_PATH } = require('./config');
const { isUploadError } = require('./middleware/upload');
const { MySQLSessionStore } = require('./middleware/sessionStore');

const app = express();

app.set('view engine', 'ejs');
app.set('views', VIEWS_PATH);

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            'script-src': ["'self'", 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
            'img-src': ["'self'", 'data:', 'https://unpkg.com', 'https://*.tile.openstreetmap.org'],
            'upgrade-insecure-requests': null,
        },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(express.static(PUBLIC_PATH, { index: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: SESSION_SECRET,
    store: new MySQLSessionStore(),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: false },
}));

app.use(require('./routes/pages'));
app.use(require('./routes/auth'));
app.use(require('./routes/profile'));
app.use(require('./routes/catalogue'));
app.use(require('./routes/offers'));
app.use(require('./routes/leaderboard'));
app.use(require('./routes/admin'));

app.use((req, res) => {
    res.status(404).send('Page not found.');
});

app.use((err, req, res, next) => {
    if (isUploadError(err)) {
        return res.status(400).json({ success: false, error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
});

module.exports = app;
