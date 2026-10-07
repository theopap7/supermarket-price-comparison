const { PORT } = require('./config');
const { db } = require('./db');
const app = require('./app');
const { scheduleMonthlyTokenDistribution } = require('./jobs/monthlyTokens');

db.query('SELECT 1')
    .then(() => console.log('Connected to the database'))
    .catch(err => console.error('Error connecting to the database:', err.message));

scheduleMonthlyTokenDistribution();

app.listen(PORT, () => {
    console.log(`listening on port ${PORT}...`);
});
