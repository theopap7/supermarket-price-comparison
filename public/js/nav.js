const currentUser = fetch('/api/me')
    .then(response => (response.ok ? response.json() : null))
    .catch(() => null);

const USER_LINKS = [
    ['/map', 'Map'],
    ['/prices', 'Offers'],
    ['/add-price', 'Add Price'],
    ['/product', 'Products'],
    ['/list', 'Leaderboard'],
    ['/history', 'History'],
    ['/profile', 'Profile'],
];

const ADMIN_LINKS = [
    ['/admin', 'Admin'],
    ['/map', 'Map'],
    ['/prices', 'Offers'],
    ['/add-price', 'Add Price'],
    ['/product', 'Products'],
    ['/add-product', 'Add Product'],
    ['/stat', 'Statistics'],
    ['/list', 'Leaderboard'],
];

currentUser.then(user => {
    const nav = document.querySelector('.site-nav');
    if (!nav || !user) {
        return;
    }

    const links = user.isAdmin ? ADMIN_LINKS : USER_LINKS;
    links.forEach(([href, label]) => {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = label;
        if (location.pathname === href) {
            link.classList.add('active');
        }
        nav.appendChild(link);
    });

    const logoutButton = document.createElement('button');
    logoutButton.type = 'button';
    logoutButton.className = 'site-nav-logout';
    logoutButton.textContent = 'Log out';
    logoutButton.addEventListener('click', () => {
        location.href = '/logout';
    });
    nav.appendChild(logoutButton);
});
