const handle = (handler) => (req, res, next) => handler(req, res, next).catch(next);
const text = (value) => (typeof value === 'string' ? value.trim() : '');

module.exports = { handle, text };
