const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is missing. Copy .env.example to .env and fill it in.');
}

const PUBLIC_PATH = path.join(__dirname, 'public');

module.exports = {
    PORT: process.env.PORT || 3001,
    SESSION_SECRET: process.env.SESSION_SECRET,
    DATABASE: {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'supermarket',
    },

    PUBLIC_PATH,
    PAGES_PATH: path.join(__dirname, 'pages'),
    VIEWS_PATH: path.join(__dirname, 'views'),
    UPLOADS_PATH: path.join(PUBLIC_PATH, 'uploads'),

    PASSWORD_MIN_LENGTH: 8,
    BCRYPT_ROUNDS: 10,
    EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    DATE_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
    PRODUCT_NAME_MAX_LENGTH: 255,
    MAX_PRICE: 99999999.99,

    LOGIN_WINDOW_MS: 10 * 60 * 1000,
    LOGIN_MAX_FAILURES: 10,
    REGISTER_WINDOW_MS: 60 * 60 * 1000,
    REGISTER_MAX_REQUESTS: 20,

    SESSION_TTL_MS: 7 * 24 * 60 * 60 * 1000,
    SESSION_CLEANUP_INTERVAL_MS: 60 * 60 * 1000,

    MAX_PHOTO_BYTES: 2 * 1024 * 1024,
    IMAGE_SIGNATURES: [
        { extension: '.png', bytes: [0x89, 0x50, 0x4e, 0x47] },
        { extension: '.jpg', bytes: [0xff, 0xd8, 0xff] },
        { extension: '.gif', bytes: [0x47, 0x49, 0x46, 0x38] },
    ],

    USERS_PER_PAGE: 15,
    OFFERS_PER_POPUP: 10,

    TOKENS_PER_ACTION: { like: 5, dislike: -1 },
    REWARD_PRICE_RATIO: 0.8,
    UNREALISTIC_PRICE_RATIO: 0.5,
    DAILY_REWARD: 50,
    WEEKLY_REWARD: 20,
    MONTHLY_TOKENS_PER_USER: 100,
    MONTHLY_DISTRIBUTION_RATIO: 0.8,
};
