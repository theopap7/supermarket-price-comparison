document.addEventListener('DOMContentLoaded', async () => {
    const categorySelect = document.getElementById('categorySelect');
    const subcategorySelect = document.getElementById('subcategorySelect');
    const productList = document.getElementById('productList');
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');

    const user = await currentUser;
    const isAdmin = Boolean(user && user.isAdmin);

    function load(url) {
        return fetch(url).then(response => {
            if (!response.ok) {
                throw new Error('Request failed');
            }
            return response.json();
        });
    }

    function fillSelect(select, items) {
        select.innerHTML = '';
        const allOption = document.createElement('option');
        allOption.value = '';
        allOption.textContent = 'All';
        select.appendChild(allOption);

        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.name;
            select.appendChild(option);
        });
    }

    function showProducts(products) {
        productList.innerHTML = '';

        if (products.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.className = 'product';
            emptyItem.textContent = 'No products found.';
            productList.appendChild(emptyItem);
            return;
        }

        products.forEach(product => {
            const productItem = document.createElement('li');
            productItem.className = 'product';

            const productName = document.createElement('span');
            productName.className = 'product-name';
            productName.textContent = product.name;
            productItem.appendChild(productName);

            const viewDetailsLink = document.createElement('a');
            viewDetailsLink.href = `/product-details?productId=${product.id}`;
            viewDetailsLink.className = 'view-details';
            viewDetailsLink.textContent = 'View Details';
            productItem.appendChild(viewDetailsLink);

            if (isAdmin) {
                const editLink = document.createElement('a');
                editLink.href = `/edit-product?productId=${product.id}`;
                editLink.textContent = 'Edit';
                productItem.appendChild(editLink);
            }

            productList.appendChild(productItem);
        });
    }

    const SEARCH_DELAY_MS = 250;
    let latestRequest = 0;
    let searchTimer;

    function loadProducts(url) {
        const request = ++latestRequest;
        load(url)
            .then(products => {
                if (request === latestRequest) {
                    showProducts(products);
                }
            })
            .catch(error => console.error('Error fetching products:', error));
    }

    function displayProducts() {
        const params = new URLSearchParams({
            category: categorySelect.value,
            subcategory: subcategorySelect.value,
        });
        loadProducts(`/api/products?${params}`);
    }

    function searchProducts() {
        clearTimeout(searchTimer);
        const searchTerm = searchInput.value.trim();
        if (searchTerm === '') {
            displayProducts();
            return;
        }
        loadProducts(`/api/products/search?search=${encodeURIComponent(searchTerm)}`);
    }

    categorySelect.addEventListener('change', () => {
        searchInput.value = '';
        fillSelect(subcategorySelect, []);
        displayProducts();
        if (categorySelect.value) {
            load(`/api/subcategories?category=${encodeURIComponent(categorySelect.value)}`)
                .then(subcategories => fillSelect(subcategorySelect, subcategories))
                .catch(error => console.error('Error fetching subcategories:', error));
        }
    });

    subcategorySelect.addEventListener('change', () => {
        searchInput.value = '';
        displayProducts();
    });

    searchButton.addEventListener('click', searchProducts);
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(searchProducts, SEARCH_DELAY_MS);
    });
    searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            searchProducts();
        }
    });

    load('/api/categories')
        .then(categories => fillSelect(categorySelect, categories))
        .catch(error => console.error('Error fetching categories:', error));
    displayProducts();
});
