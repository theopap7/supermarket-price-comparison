const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const supermarkets = require('./supermarkets.json');

const randomPassword = () => crypto.randomBytes(9).toString('base64url');
const DEMO_USER_PASSWORD = process.env.DEMO_USER_PASSWORD || randomPassword();
const DEMO_ADMIN = { name: 'Admin', email: 'admin@example.com', password: process.env.DEMO_ADMIN_PASSWORD || randomPassword() };
const DEMO_USERS = ['Maria', 'Nikos', 'Eleni', 'Giorgos', 'Katerina', 'Dimitris'];

const BCRYPT_ROUNDS = 10;
const STARTING_TOKENS = 100;
const TOKENS_PER_ACTION = { like: 5, dislike: -1 };
const REFERENCE_DAYS = 30;
const OFFER_DAYS = 21;
const OFFER_COUNT = 90;
const STORES_WITH_OFFERS = 20;
const RATING_CHANCE = 0.35;
const TABLES = ['sessions', 'ratings', 'offers', 'prices', 'products', 'subcategories', 'categories', 'supermarkets', 'administrators', 'users'];

const CATEGORIES = [
    [1, 'Pasta & Rice'],
    [2, 'Dairy'],
    [3, 'Drinks'],
    [4, 'Snacks'],
    [5, 'Cleaning'],
    [6, 'Baby Care'],
];

const SUBCATEGORIES = [
    [11, 'Pasta', 1],
    [12, 'Rice', 1],
    [21, 'Milk', 2],
    [22, 'Cheese', 2],
    [23, 'Yogurt', 2],
    [31, 'Juice', 3],
    [32, 'Soft Drinks', 3],
    [33, 'Coffee', 3],
    [41, 'Chips', 4],
    [42, 'Biscuits', 4],
    [51, 'Laundry', 5],
    [52, 'Dishwashing', 5],
    [61, 'Baby Food', 6],
    [62, 'Diapers', 6],
];

const PRODUCTS = [
    [1001, 'Spaghetti No.6 500g', 1, 11, 1.05],
    [1002, 'Penne Rigate 500g', 1, 11, 1.10],
    [1003, 'Long Grain Rice 1kg', 1, 12, 2.20],
    [1004, 'Risotto Rice 500g', 1, 12, 1.85],
    [1005, 'Fresh Whole Milk 1L', 2, 21, 1.55],
    [1006, 'Semi-Skimmed Milk 1L', 2, 21, 1.45],
    [1007, 'Feta Cheese 400g', 2, 22, 4.90],
    [1008, 'Gouda Slices 200g', 2, 22, 2.60],
    [1009, 'Greek Yogurt 2% 3x200g', 2, 23, 2.95],
    [1010, 'Orange Juice 1L', 3, 31, 1.90],
    [1011, 'Cola 1.5L', 3, 32, 1.75],
    [1012, 'Sparkling Water 1L', 3, 32, 0.85],
    [1013, 'Greek Coffee 200g', 3, 33, 3.40],
    [1014, 'Instant Coffee 100g', 3, 33, 4.20],
    [1015, 'Potato Chips Oregano 150g', 4, 41, 1.65],
    [1016, 'Digestive Biscuits 250g', 4, 42, 1.80],
    [1017, 'Laundry Detergent 40 Washes', 5, 51, 9.90],
    [1018, 'Fabric Softener 1.5L', 5, 51, 3.30],
    [1019, 'Dishwashing Liquid 750ml', 5, 52, 2.40],
    [1020, 'Baby Rice Cream 300g', 6, 61, 3.10],
    [1021, 'Diapers Size 4 (50 pcs)', 6, 62, 11.50],
];

function createRandom(seed) {
    let state = seed;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const random = createRandom(42);
const pick = (items) => items[Math.floor(random() * items.length)];
const between = (min, max) => min + random() * (max - min);
const toMoney = (value) => Math.max(0.05, Math.round(value * 100) / 100);
const pad = (value) => String(value).padStart(2, '0');
const toDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const toDateTime = (date) => `${toDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

function daysAgo(days, hour = 12, minute = 0) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(hour, minute, 0, 0);
    return date;
}

function buildReferencePrices() {
    const rows = [];
    const priceOn = new Map();

    for (const [productId, , , , basePrice] of PRODUCTS) {
        let price = basePrice;
        for (let day = REFERENCE_DAYS; day >= 0; day--) {
            price = toMoney(price * between(0.985, 1.015));
            const date = toDate(daysAgo(day));
            rows.push([productId, price, date]);
            priceOn.set(`${productId}:${date}`, price);
        }
    }
    return { rows, priceOn };
}

function buildOffers(userIds, storeIds, priceOn) {
    const offers = [];
    const now = new Date();

    for (let i = 0; i < OFFER_COUNT; i++) {
        const [productId] = pick(PRODUCTS);
        const createdAt = daysAgo(Math.floor(between(0, OFFER_DAYS + 1)), Math.floor(between(9, 21)), Math.floor(between(0, 60)));
        const moment = createdAt > now ? now : createdAt;
        const date = toDate(moment);
        const reference = priceOn.get(`${productId}:${date}`);

        offers.push({
            productId,
            price: toMoney(reference * between(0.72, 1.08)),
            reference,
            date,
            addedBy: pick(userIds),
            createdAt: moment,
            supermarketId: pick(storeIds),
        });
    }
    return offers.sort((a, b) => a.createdAt - b.createdAt);
}

function buildRatings(offers, userIds) {
    const ratings = [];
    const now = new Date();

    offers.forEach((offer) => {
        for (const userId of userIds) {
            if (userId === offer.addedBy || random() > RATING_CHANCE) {
                continue;
            }
            const isGoodPrice = offer.price <= offer.reference * 0.95;
            const action = random() < (isGoodPrice ? 0.9 : 0.35) ? 'like' : 'dislike';
            const createdAt = new Date(offer.createdAt.getTime() + between(1, 48) * 60 * 60 * 1000);
            ratings.push({ userId, offer, action, createdAt: createdAt > now ? now : createdAt });
        }
    });
    return ratings;
}

async function seed({ database = process.env.DB_NAME || 'supermarket', reset = false } = {}) {
    if (!/^\w+$/.test(database)) {
        throw new Error(`"${database}" is not a valid database name.`);
    }

    const db = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        multipleStatements: true,
    });

    try {
        await db.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4`);
        await db.query(`USE \`${database}\``);

        const [existing] = await db.query('SHOW TABLES');
        const existingTables = existing.map(row => Object.values(row)[0]).filter(table => TABLES.includes(table));
        if (existingTables.length && !reset) {
            throw new Error(`The database "${database}" already has tables. Run "npm run seed -- --reset" to delete them and start again.`);
        }

        await db.query('SET FOREIGN_KEY_CHECKS = 0');
        for (const table of TABLES) {
            await db.query(`DROP TABLE IF EXISTS \`${table}\``);
        }
        await db.query('SET FOREIGN_KEY_CHECKS = 1');
        await db.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

        await db.query('INSERT INTO categories (id, name) VALUES ?', [CATEGORIES]);
        await db.query('INSERT INTO subcategories (id, name, parent_category_id) VALUES ?', [SUBCATEGORIES]);
        await db.query('INSERT INTO products (id, name, category_id, subcategory_id) VALUES ?', [PRODUCTS.map(product => product.slice(0, 4))]);
        await db.query(
            'INSERT INTO supermarkets (name, latitude, longitude, address, city, country) VALUES ?',
            [supermarkets.map(s => [s.name, s.latitude, s.longitude, s.address, s.city, 'Ελλάδα'])]
        );

        await db.query(
            'INSERT INTO administrators (name, email, password) VALUES (?, ?, ?)',
            [DEMO_ADMIN.name, DEMO_ADMIN.email, await bcrypt.hash(DEMO_ADMIN.password, BCRYPT_ROUNDS)]
        );
        const userPasswordHash = await bcrypt.hash(DEMO_USER_PASSWORD, BCRYPT_ROUNDS);
        await db.query(
            'INSERT INTO users (name, email, password) VALUES ?',
            [DEMO_USERS.map(name => [name, `${name.toLowerCase()}@example.com`, userPasswordHash])]
        );

        const [users] = await db.query('SELECT id FROM users ORDER BY id');
        const [stores] = await db.query('SELECT id FROM supermarkets ORDER BY id');
        const userIds = users.map(user => user.id);
        const allStoreIds = stores.map(store => store.id);
        const storeIds = [];
        while (storeIds.length < Math.min(STORES_WITH_OFFERS, allStoreIds.length)) {
            const storeId = pick(allStoreIds);
            if (!storeIds.includes(storeId)) {
                storeIds.push(storeId);
            }
        }

        const reference = buildReferencePrices();
        await db.query('INSERT INTO prices (product_id, price, date) VALUES ?', [reference.rows]);

        const offers = buildOffers(userIds, storeIds, reference.priceOn);
        for (const offer of offers) {
            const [result] = await db.query(
                'INSERT INTO offers (product_id, price, date, added_by, created_at, supermarket_id) VALUES (?, ?, ?, ?, ?, ?)',
                [offer.productId, offer.price, offer.date, offer.addedBy, toDateTime(offer.createdAt), offer.supermarketId]
            );
            offer.id = result.insertId;
        }

        const ratings = buildRatings(offers, userIds);
        await db.query(
            'INSERT INTO ratings (user_id, offer_id, action, created_at) VALUES ?',
            [ratings.map(rating => [rating.userId, rating.offer.id, rating.action, toDateTime(rating.createdAt)])]
        );

        for (const userId of userIds) {
            const earned = ratings
                .filter(rating => rating.offer.addedBy === userId)
                .reduce((sum, rating) => sum + TOKENS_PER_ACTION[rating.action], 0);
            await db.query('UPDATE users SET tokens = ? WHERE id = ?', [Math.max(0, STARTING_TOKENS + earned), userId]);
        }

        return {
            database,
            products: PRODUCTS.length,
            supermarkets: supermarkets.length,
            users: userIds.length,
            offers: offers.length,
            ratings: ratings.length,
        };
    } finally {
        await db.end();
    }
}

if (require.main === module) {
    seed({ reset: process.argv.includes('--reset') })
        .then(counts => {
            console.log(`Seeded "${counts.database}": ${counts.products} products, ${counts.supermarkets} supermarkets, ${counts.users} users, ${counts.offers} prices, ${counts.ratings} ratings.`);
            console.log(`Demo users (${DEMO_USERS.map(name => `${name.toLowerCase()}@example.com`).join(', ')}): password ${DEMO_USER_PASSWORD}`);
            console.log(`Administrator (${DEMO_ADMIN.email}): password ${DEMO_ADMIN.password}`);
        })
        .catch(err => {
            console.error('Seed failed:', err.message);
            process.exit(1);
        });
}

module.exports = { seed, DEMO_ADMIN, DEMO_USERS, DEMO_USER_PASSWORD };
