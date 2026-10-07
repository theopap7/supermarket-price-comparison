const rateLimit = require('express-rate-limit');
const { LOGIN_WINDOW_MS, LOGIN_MAX_FAILURES, REGISTER_WINDOW_MS, REGISTER_MAX_REQUESTS } = require('../config');

const tooManyAttempts = (req, res) => {
    res.status(429).json('too many attempts, try again later');
};

const loginLimiter = rateLimit({
    windowMs: LOGIN_WINDOW_MS,
    max: LOGIN_MAX_FAILURES,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (req, res) => res.locals.loggedIn === true,
    standardHeaders: true,
    legacyHeaders: false,
    handler: tooManyAttempts,
});

const registerLimiter = rateLimit({
    windowMs: REGISTER_WINDOW_MS,
    max: REGISTER_MAX_REQUESTS,
    standardHeaders: true,
    legacyHeaders: false,
    handler: tooManyAttempts,
});

module.exports = { loginLimiter, registerLimiter };
