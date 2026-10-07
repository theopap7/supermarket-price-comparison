const { db, withTransaction } = require('../db');
const { MONTHLY_TOKENS_PER_USER, MONTHLY_DISTRIBUTION_RATIO, TOKENS_PER_ACTION } = require('../config');

const MAX_TIMEOUT_DELAY = 2147483647;

const pad = (value) => String(value).padStart(2, '0');
const monthStart = (year, month) => {
    const date = new Date(year, month, 1);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01 00:00:00`;
};

// Shares a pool of new tokens between the users, in proportion to what each one
// earned from reports and ratings during the month before `now`.
async function distributeTokensToUsersMonthly(now = new Date()) {
    const from = monthStart(now.getFullYear(), now.getMonth() - 1);
    const to = monthStart(now.getFullYear(), now.getMonth());

    const [users] = await db.query(
        `SELECT u.id,
                (SELECT COALESCE(SUM(o.reward_points), 0)
                   FROM offers o
                  WHERE o.added_by = u.id AND o.created_at >= ? AND o.created_at < ?)
              + (SELECT COALESCE(SUM(IF(r.action = 'like', ?, ?)), 0)
                   FROM ratings r
                   JOIN offers o ON o.id = r.offer_id
                  WHERE o.added_by = u.id AND r.created_at >= ? AND r.created_at < ?) AS score
           FROM users u`,
        [from, to, TOKENS_PER_ACTION.like, TOKENS_PER_ACTION.dislike, from, to]
    );

    const scores = users.map(user => ({ id: user.id, score: Math.max(0, Number(user.score)) }));
    const totalScore = scores.reduce((sum, user) => sum + user.score, 0);
    if (totalScore === 0) {
        return;
    }

    const tokensToDistribute = Math.round(users.length * MONTHLY_TOKENS_PER_USER * MONTHLY_DISTRIBUTION_RATIO);
    await withTransaction(async (conn) => {
        for (const user of scores) {
            const tokens = Math.floor((user.score / totalScore) * tokensToDistribute);
            if (tokens > 0) {
                await conn.query('UPDATE users SET tokens = tokens + ? WHERE id = ?', [tokens, user.id]);
            }
        }
    });
    console.log('Token distribution completed successfully.');
}

function scheduleMonthlyTokenDistribution() {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    const timeUntilNextMonth = nextMonth.getTime() - now.getTime();

    if (timeUntilNextMonth > MAX_TIMEOUT_DELAY) {
        setTimeout(scheduleMonthlyTokenDistribution, MAX_TIMEOUT_DELAY).unref();
        return;
    }

    setTimeout(() => {
        distributeTokensToUsersMonthly().catch(err => console.error('Error distributing tokens:', err.message));
        scheduleMonthlyTokenDistribution();
    }, timeUntilNextMonth).unref();
}

module.exports = { scheduleMonthlyTokenDistribution, distributeTokensToUsersMonthly };
