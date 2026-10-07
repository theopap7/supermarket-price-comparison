document.addEventListener('DOMContentLoaded', () => {
    const form = [...document.querySelector('.form').children];

    form.forEach((item, i) => {
        setTimeout(() => {
            item.style.opacity = 1;
        }, i * 100);
    });

    const categorySelect = document.querySelector('#category');
    const subcategorySelect = document.querySelector('#subcategory');
    const productNameInput = document.querySelector('#productName');
    const addProductBtn = document.querySelector('#addProductBtn');
    const formMessage = document.querySelector('.form-message');
    const tableBody = document.querySelector('#productsTable tbody');

    function showMessage(message, isError) {
        formMessage.textContent = message;
        formMessage.classList.toggle('error-message', isError);
        formMessage.classList.toggle('success-message', !isError);
    }

    function fillSelect(select, placeholder, items) {
        select.innerHTML = '';
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = placeholder;
        select.appendChild(placeholderOption);

        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.name;
            select.appendChild(option);
        });
    }

    function load(url) {
        return fetch(url).then(res => {
            if (!res.ok) {
                throw new Error('Request failed');
            }
            return res.json();
        });
    }

    function showProducts() {
        tableBody.innerHTML = '';
        if (!subcategorySelect.value) {
            return;
        }

        load(`/api/products?subcategory=${encodeURIComponent(subcategorySelect.value)}`)
            .then(products => {
                products.forEach(product => {
                    const row = document.createElement('tr');
                    [product.id, product.name].forEach(value => {
                        const cell = document.createElement('td');
                        cell.textContent = value;
                        row.appendChild(cell);
                    });
                    tableBody.appendChild(row);
                });
            })
            .catch(error => console.error('Error fetching products:', error));
    }

    load('/api/categories')
        .then(data => fillSelect(categorySelect, 'Select Category', data))
        .catch(error => console.error('Error fetching categories:', error));

    categorySelect.addEventListener('change', () => {
        tableBody.innerHTML = '';
        if (!categorySelect.value) {
            fillSelect(subcategorySelect, 'Select Subcategory', []);
            return;
        }
        load(`/api/subcategories?category=${encodeURIComponent(categorySelect.value)}`)
            .then(data => fillSelect(subcategorySelect, 'Select Subcategory', data))
            .catch(error => console.error('Error fetching subcategories:', error));
    });

    subcategorySelect.addEventListener('change', showProducts);

    addProductBtn.addEventListener('click', () => {
        addProductBtn.disabled = true;

        fetch('/api/addProduct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productName: productNameInput.value,
                category: categorySelect.value,
                subcategory: subcategorySelect.value,
            }),
        })
            .then(res => res.json().then(data => ({ ok: res.ok, data })))
            .then(({ ok, data }) => {
                if (!ok) {
                    showMessage(data.error || 'The product could not be added.', true);
                    return;
                }
                showMessage(`The product was added with ID ${data.id}.`, false);
                productNameInput.value = '';
                showProducts();
            })
            .catch(error => {
                console.error('Error adding product:', error);
                showMessage('The product could not be added.', true);
            })
            .finally(() => {
                addProductBtn.disabled = false;
            });
    });
});
