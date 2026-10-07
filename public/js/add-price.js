document.addEventListener('DOMContentLoaded', () => {
    const form = [...document.querySelector('.form').children];

    form.forEach((item, i) => {
        setTimeout(() => {
            item.style.opacity = 1;
        }, i * 100);
    });

    const categorySelect = document.querySelector('.category');
    const subcategorySelect = document.querySelector('.subcategory');
    const productSelect = document.querySelector('.product');
    const supermarketSelect = document.querySelector('.supermarket');
    const price = document.querySelector('.price');
    const date = document.querySelector('.date');
    const submitBtn = document.querySelector('.submit-btn');
    const formMessage = document.querySelector('.form-message');

    date.value = new Date().toLocaleDateString('en-CA');

    function showMessage(message, isError) {
        formMessage.textContent = message;
        formMessage.classList.toggle('error-message', isError);
        formMessage.classList.toggle('success-message', !isError);
    }

    function fillSelect(select, placeholder, items, label) {
        select.innerHTML = '';
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = placeholder;
        placeholderOption.disabled = true;
        placeholderOption.selected = true;
        select.appendChild(placeholderOption);

        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = label(item);
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

    load('/api/supermarkets')
        .then(data => fillSelect(supermarketSelect, 'Select a supermarket', data, s => (s.address ? `${s.name} (${s.address})` : s.name)))
        .catch(error => console.error('Error fetching supermarkets:', error));

    load('/api/categories')
        .then(data => fillSelect(categorySelect, 'Select a category', data, c => c.name))
        .catch(error => console.error('Error fetching categories:', error));

    categorySelect.addEventListener('change', () => {
        fillSelect(productSelect, 'Select a product', [], p => p.name);
        load(`/api/subcategories?category=${encodeURIComponent(categorySelect.value)}`)
            .then(data => fillSelect(subcategorySelect, 'Select a subcategory', data, s => s.name))
            .catch(error => console.error('Error fetching subcategories:', error));
    });

    subcategorySelect.addEventListener('change', () => {
        load(`/api/products?subcategory=${encodeURIComponent(subcategorySelect.value)}`)
            .then(data => fillSelect(productSelect, 'Select a product', data, p => p.name))
            .catch(error => console.error('Error fetching products:', error));
    });

    submitBtn.addEventListener('click', () => {
        submitBtn.disabled = true;

        fetch('/addprice', {
            method: 'post',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                price: price.value,
                date: date.value,
                product_id: productSelect.value,
                supermarket_id: supermarketSelect.value,
            }),
        })
            .then(res => res.json().then(data => ({ ok: res.ok, data })))
            .then(({ ok, data }) => {
                if (!ok) {
                    showMessage(data.error || 'An error occurred while adding the price.', true);
                    return;
                }
                const reward = data.rewardPoints > 0 ? ` You earned ${data.rewardPoints} tokens.` : '';
                showMessage(`The price was added.${reward}`, false);
                price.value = '';
            })
            .catch(error => {
                console.error('Error:', error);
                showMessage('An error occurred while adding the price.', true);
            })
            .finally(() => {
                submitBtn.disabled = false;
            });
    });
});
