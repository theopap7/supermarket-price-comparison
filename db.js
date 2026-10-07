const mysql = require('mysql2');
const { DATABASE } = require('./config');

const db = mysql.createPool({ ...DATABASE, dateStrings: true }).promise();

async function withTransaction(work) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const result = await work(conn);
        await conn.commit();
        return result;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

module.exports = { db, withTransaction };
