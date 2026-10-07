document.addEventListener('DOMContentLoaded', () => {
    function load(url) {
        return fetch(url).then(res => {
            if (!res.ok) {
                throw new Error('Request failed');
            }
            return res.json();
        });
    }

    function createEntry(lines) {
        const entry = document.createElement('div');
        entry.classList.add('twit', 'history-entry');

        lines.forEach(([className, textContent]) => {
            const line = document.createElement('div');
            line.className = className;
            line.textContent = textContent;
            entry.appendChild(line);
        });
        return entry;
    }

    function showSection({ url, container, message, emptyText, errorText, toLines }) {
        load(url)
            .then(data => {
                if (data.length === 0) {
                    message.textContent = emptyText;
                    return;
                }
                data.forEach(entry => container.appendChild(createEntry(toLines(entry))));
            })
            .catch(error => {
                console.error('Error fetching user history:', error);
                message.textContent = errorText;
            });
    }

    function formatTokens(tokens) {
        return tokens > 0 ? `+${tokens}` : String(tokens);
    }

    showSection({
        url: '/get-user-prices',
        container: document.getElementById('addedContainer'),
        message: document.getElementById('addedMessage'),
        emptyText: 'You have not added any prices yet.',
        errorText: 'Your prices could not be loaded. Try again.',
        toLines: entry => [
            ['twit-product', entry.product_name],
            ['twit-content', `Price: ${entry.price.toFixed(2)} €, Date: ${entry.date}`],
            ['supermarket-name', `Supermarket: ${entry.supermarket_name || 'Unknown'}`],
            ['likes-count', `Likes: ${entry.likes}, Dislikes: ${entry.dislikes}`],
            ['actions-info', `Reward for adding: ${formatTokens(entry.rewardPoints)}`],
            ['actions-info', `Tokens from ratings: ${formatTokens(entry.tokensFromRatings)}`],
            ['tokens-total', `Total tokens from this price: ${formatTokens(entry.rewardPoints + entry.tokensFromRatings)}`],
            ['history-date', `Added on: ${entry.created_at}`],
        ],
    });

    showSection({
        url: '/get-user-history',
        container: document.getElementById('ratedContainer'),
        message: document.getElementById('ratedMessage'),
        emptyText: 'You have not rated any prices yet.',
        errorText: 'Your ratings could not be loaded. Try again.',
        toLines: entry => [
            ['twit-product', entry.product_name],
            ['twit-content', `Price: ${entry.price.toFixed(2)} €, Date: ${entry.date}`],
            ['supermarket-name', `Supermarket: ${entry.supermarket_name || 'Unknown'}`],
            ['actions-info', `Your action: ${entry.action}`],
            ['history-date', `Rated on: ${entry.created_at}`],
        ],
    });
});
