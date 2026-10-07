function startSession(req, data) {
    return new Promise((resolve, reject) => {
        req.session.regenerate(err => {
            if (err) return reject(err);
            Object.assign(req.session, data);
            resolve();
        });
    });
}

function isLoggedIn(req) {
    return Boolean(req.session.userId || req.session.isAdmin);
}

function requireLogin(req, res, next) {
    if (isLoggedIn(req)) return next();
    res.status(401).json({ error: 'You must be logged in.' });
}

function requireUser(req, res, next) {
    if (req.session.userId) return next();
    res.status(isLoggedIn(req) ? 403 : 401).json({ error: 'This action is only available to registered users.' });
}

function isAdmin(req, res, next) {
    if (req.session.isAdmin) return next();
    res.status(isLoggedIn(req) ? 403 : 401).json({ error: 'Access denied. You are not an administrator.' });
}

function requireLoginPage(req, res, next) {
    if (isLoggedIn(req)) return next();
    res.redirect('/login');
}

function requireUserPage(req, res, next) {
    if (req.session.userId) return next();
    res.redirect(req.session.isAdmin ? '/admin' : '/login');
}

function requireAdminPage(req, res, next) {
    if (req.session.isAdmin) return next();
    if (!isLoggedIn(req)) return res.redirect('/login');
    res.status(403).send('Access denied. You are not an administrator.');
}

module.exports = {
    startSession,
    requireLogin,
    requireUser,
    isAdmin,
    requireLoginPage,
    requireUserPage,
    requireAdminPage,
};
