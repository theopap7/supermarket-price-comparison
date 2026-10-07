document.addEventListener('DOMContentLoaded', async () => {
    const twitContainer = document.querySelector('.twit-container');
    const pageMessage = document.querySelector('.page-message');
    const supermarketId = new URLSearchParams(location.search).get('supermarket_id');
    const query = supermarketId ? `?supermarket_id=${encodeURIComponent(supermarketId)}` : '';

    try {
        const user = await currentUser;
        const response = await fetch(`/getprices${query}`);
        if (!response.ok) {
            throw new Error('Request failed');
        }
        const entries = await response.json();

        if (entries.length === 0) {
            pageMessage.textContent = 'No prices have been added yet.';
            return;
        }
        if (supermarketId) {
            pageMessage.textContent = `Showing prices for ${entries[0].supermarket_name}.`;
        }
        entries.forEach(entry => twitContainer.appendChild(createTwit(entry, user)));
    } catch (error) {
        console.error('Error fetching prices:', error);
        pageMessage.textContent = 'The prices could not be loaded. Try again.';
    }
});

function element(tag, className, textContent) {
    const node = document.createElement(tag);
    if (className) {
        node.className = className;
    }
    if (textContent !== undefined) {
        node.textContent = textContent;
    }
    return node;
}

function createTwit(entry, user) {
    const twit = element('div', 'twit');
    twit.id = `twit-${entry.id}`;

    const userInfo = element('div', 'user-info');
    const profilePhoto = element('img', 'profile-photo');
    profilePhoto.alt = '';
    profilePhoto.src = entry.profile_photo ? `/uploads/${entry.profile_photo}` : '/img/default-profile.svg';
    userInfo.appendChild(profilePhoto);
    userInfo.appendChild(element('span', 'user-name', entry.username || 'Administrator'));
    twit.appendChild(userInfo);

    twit.appendChild(element('div', 'twit-product', entry.product_name));
    twit.appendChild(element('div', 'twit-content', `Price: ${entry.price.toFixed(2)} €, Date: ${entry.date}`));
    twit.appendChild(element('div', 'supermarket-name', `Supermarket: ${entry.supermarket_name || 'Unknown'}`));

    const likesCount = element('div', 'likes-count', `Likes: ${entry.likes}`);
    const dislikesCount = element('div', 'dislikes-count', `Dislikes: ${entry.dislikes}`);
    const isOwnPrice = user && user.id !== null && user.id === entry.added_by;

    if (user && !user.isAdmin && !isOwnPrice) {
        const likeButton = element('button', 'like-button', 'Like');
        const dislikeButton = element('button', 'dislike-button', 'Dislike');
        const undoButton = element('button', 'undo-button', 'Undo');
        const actionsInfo = element('div', 'actions-info');
        const buttons = { like: likeButton, dislike: dislikeButton, undo: undoButton };

        const showAction = (action) => {
            actionsInfo.textContent = `Your action: ${action || 'None'}`;
            likeButton.disabled = action === 'like';
            dislikeButton.disabled = action === 'dislike';
            undoButton.disabled = !action;
        };

        Object.entries(buttons).forEach(([action, button]) => {
            button.addEventListener('click', () => {
                handleAction(entry.id, action, Object.values(buttons))
                    .then(data => {
                        showAction(data.userAction);
                        likesCount.textContent = `Likes: ${data.likes}`;
                        dislikesCount.textContent = `Dislikes: ${data.dislikes}`;
                    })
                    .catch(error => {
                        actionsInfo.textContent = error.message;
                    });
            });
        });

        const actionsContainer = element('div', 'actions-container');
        actionsContainer.append(likeButton, dislikeButton, undoButton);
        twit.appendChild(actionsContainer);
        twit.appendChild(actionsInfo);
        showAction(entry.my_action);
    } else if (isOwnPrice) {
        twit.appendChild(element('div', 'actions-info', 'You added this price.'));
    }

    twit.appendChild(likesCount);
    twit.appendChild(dislikesCount);

    if (user && user.isAdmin) {
        const deleteButton = element('button', 'delete-button', 'Delete');
        deleteButton.addEventListener('click', () => handleDelete(entry.id, twit));
        twit.appendChild(deleteButton);
    }

    return twit;
}

async function handleAction(id, action, buttons) {
    const disabledBefore = buttons.map(button => button.disabled);
    buttons.forEach(button => {
        button.disabled = true;
    });

    try {
        const response = await fetch('/like-dislike', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, action }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'An error occurred.');
        }
        return data;
    } catch (error) {
        buttons.forEach((button, i) => {
            button.disabled = disabledBefore[i];
        });
        throw error;
    }
}

function handleDelete(id, twit) {
    if (!window.confirm('Are you sure you want to delete this post?')) {
        return;
    }

    fetch(`/deletePrice/${id}`, { method: 'DELETE' })
        .then((response) => {
            if (response.status === 204) {
                twit.remove();
            } else {
                window.alert('The price could not be deleted.');
            }
        })
        .catch((error) => {
            console.error('Error during delete:', error);
            window.alert('The price could not be deleted.');
        });
}
