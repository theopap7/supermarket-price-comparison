document.addEventListener('DOMContentLoaded', async () => {
    const productDetailsDiv = document.getElementById('productDetails');
    const productId = new URLSearchParams(window.location.search).get('productId');

    function line(tag, textContent) {
        const node = document.createElement(tag);
        node.textContent = textContent;
        return node;
    }

    if (!productId) {
        productDetailsDiv.appendChild(line('p', 'Product ID not found.'));
        return;
    }

    try {
        const user = await currentUser;
        const response = await fetch(`/api/products/${encodeURIComponent(productId)}`);
        if (!response.ok) {
            productDetailsDiv.appendChild(line('p', response.status === 404 ? 'Product not found.' : 'Error fetching product details.'));
            return;
        }
        const productData = await response.json();

        productDetailsDiv.appendChild(line('h2', productData.name));
        productDetailsDiv.appendChild(line('p', `Category: ${productData.category} / ${productData.subcategory}`));

        if (user && user.isAdmin) {
            const editLink = line('a', 'Edit Product');
            editLink.href = `/edit-product?productId=${productData.id}`;
            productDetailsDiv.appendChild(editLink);
        }

        productDetailsDiv.appendChild(line('h3', 'Price History:'));
        const dates = [...new Set([...productData.prices, ...productData.offers].map(point => point.date))].sort();
        if (dates.length === 0) {
            productDetailsDiv.appendChild(line('p', 'There are no prices for this product yet.'));
            return;
        }

        const valuesByDate = (points) => {
            const byDate = new Map(points.map(point => [point.date, point.price]));
            return dates.map(date => (byDate.has(date) ? byDate.get(date) : null));
        };

        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container';
        const chartCanvas = document.createElement('canvas');
        chartCanvas.id = 'priceChart';
        chartContainer.appendChild(chartCanvas);
        productDetailsDiv.appendChild(chartContainer);

        new Chart(chartCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: dates,
                datasets: [
                    {
                        label: 'Reference price',
                        data: valuesByDate(productData.prices),
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 2,
                        spanGaps: true,
                        fill: false,
                    },
                    {
                        label: 'Prices added by users (daily average)',
                        data: valuesByDate(productData.offers),
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 2,
                        spanGaps: true,
                        fill: false,
                    },
                ],
            },
            options: {
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                    },
                },
            },
        });
    } catch (error) {
        console.error('Error fetching product data:', error);
        productDetailsDiv.appendChild(line('p', 'Error fetching product details.'));
    }
});
