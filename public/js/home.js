const greeting = document.querySelector('.greeting');

currentUser.then(user => {
    if (user) {
        greeting.textContent = `hello ${user.name}`;
    }
});
