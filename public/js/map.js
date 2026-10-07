document.addEventListener('DOMContentLoaded', () => {
    const PATRAS = [38.2466, 21.7345];
    const map = L.map('map').setView(PATRAS, 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const hasOfferIcon = L.icon({ iconUrl: '/img/discount.png', iconSize: [32, 32] });
    const noOfferIcon = L.icon({ iconUrl: '/img/nodiscount.png', iconSize: [32, 32] });
    const markersLayer = L.layerGroup().addTo(map);
    const userLocationMarker = L.circle(PATRAS, {
        color: 'blue',
        fillColor: 'blue',
        fillOpacity: 0.5,
        radius: 10,
    });

    const categorySelect = document.getElementById('category-select');
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');

    let supermarkets = [];
    let userLatLng = null;

    if ('geolocation' in navigator) {
        navigator.geolocation.watchPosition((position) => {
            const isFirstPosition = userLatLng === null;
            userLatLng = L.latLng(position.coords.latitude, position.coords.longitude);
            userLocationMarker.setLatLng(userLatLng).addTo(map);
            if (isFirstPosition) {
                map.setView(userLatLng, 13);
            }
        }, (error) => {
            console.error('Error getting user location:', error);
        });
    }

    function normalize(value) {
        return value
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{M}/gu, '')
            .replace(/ς/g, 'σ');
    }

    function line(textContent, tag = 'div') {
        const node = document.createElement(tag);
        node.textContent = textContent;
        return node;
    }

    function buildPopup(supermarket, offers) {
        const container = document.createElement('div');
        container.appendChild(line(supermarket.supermarket_name, 'strong'));
        if (supermarket.address) {
            container.appendChild(line(supermarket.address));
        }
        if (userLatLng) {
            const distance = userLatLng.distanceTo([supermarket.latitude, supermarket.longitude]);
            const formatted = distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`;
            container.appendChild(line(`Distance: ${formatted}`));
        }

        container.appendChild(document.createElement('br'));
        if (!offers) {
            container.appendChild(line('Loading prices...'));
            return container;
        }
        if (offers.length === 0) {
            container.appendChild(line('No prices available.'));
            return container;
        }

        container.appendChild(line('Latest prices:'));
        offers.forEach(offer => {
            container.appendChild(line(`${offer.product_name}: ${offer.price.toFixed(2)} € (${offer.date})`));
        });

        container.appendChild(document.createElement('br'));
        const link = line('View Prices', 'a');
        link.href = `/prices?supermarket_id=${supermarket.supermarket_id}`;
        container.appendChild(link);
        return container;
    }

    function showStoreOffers(marker, supermarket) {
        marker.setPopupContent(buildPopup(supermarket, null));
        fetch(`/api/supermarket-offers?supermarket_id=${supermarket.supermarket_id}`)
            .then(response => response.json())
            .then(offers => {
                marker.setPopupContent(buildPopup(supermarket, offers));
            })
            .catch(error => {
                console.error('Error fetching prices:', error);
            });
    }

    function renderMarkers() {
        const searchTerm = normalize(searchInput.value.trim());
        markersLayer.clearLayers();

        supermarkets
            .filter(supermarket => normalize(supermarket.supermarket_name).includes(searchTerm))
            .forEach(supermarket => {
                const marker = L.marker([supermarket.latitude, supermarket.longitude], {
                    icon: supermarket.offer_count > 0 ? hasOfferIcon : noOfferIcon,
                }).bindPopup(supermarket.supermarket_name);

                marker.on('popupopen', () => showStoreOffers(marker, supermarket));
                marker.addTo(markersLayer);
            });
    }

    function loadSupermarkets() {
        const category = categorySelect.value;
        const query = category ? `?category=${encodeURIComponent(category)}` : '';

        fetch(`/api/supermarkets-with-offer-status${query}`)
            .then(response => response.json())
            .then(data => {
                supermarkets = data;
                renderMarkers();
            })
            .catch(error => {
                console.error('Error fetching supermarkets:', error);
            });
    }

    fetch('/api/categories')
        .then(response => response.json())
        .then(categories => {
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                categorySelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Error fetching categories:', error);
        });

    categorySelect.addEventListener('change', loadSupermarkets);
    searchButton.addEventListener('click', renderMarkers);
    searchInput.addEventListener('input', renderMarkers);
    searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            renderMarkers();
        }
    });

    loadSupermarkets();
});
