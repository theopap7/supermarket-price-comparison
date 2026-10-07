const form = [...document.querySelector('.form').children];

form.forEach((item, i) => {
    setTimeout(() => {
        item.style.opacity = 1;
    }, i * 100);
});

const name = document.querySelector('.name');
const email = document.querySelector('.email');
const password = document.querySelector('.password');
const submitBtn = document.querySelector('.submit-btn');
const isRegisterPage = name !== null;

const alertBox = (message) => {
    const alertContainer = document.querySelector('.alert-box');
    const alertMsg = document.querySelector('.alert');
    alertMsg.textContent = message;

    alertContainer.style.top = `5%`;
    setTimeout(() => {
        alertContainer.style.top = null;
    }, 5000);
};

const validateData = (data) => {
    if (!data.name) {
        alertBox(data.error || data);
    } else {
        location.href = data.isAdmin ? '/admin' : '/profile';
    }
};

const submit = () => {
    const body = { email: email.value, password: password.value };
    if (isRegisterPage) {
        body.name = name.value;
    }

    fetch(isRegisterPage ? '/register-user' : '/login-user', {
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
        .then(res => res.json())
        .then(validateData)
        .catch(() => alertBox('something went wrong, try again'));
};

submitBtn.addEventListener('click', submit);
[name, email, password].filter(Boolean).forEach(input => {
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            submit();
        }
    });
});
