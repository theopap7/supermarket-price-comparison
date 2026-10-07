document.addEventListener('DOMContentLoaded', () => {
    const userList = document.getElementById('userList');
    const pagination = document.getElementById('pagination');

    function showPagination(currentPage, totalPages) {
      pagination.innerHTML = '';
      if (totalPages <= 1) {
        return;
      }

      for (let page = 1; page <= totalPages; page++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'page-button';
        button.textContent = page;
        if (page === currentPage) {
          button.classList.add('active');
          button.disabled = true;
        } else {
          button.addEventListener('click', () => fetchUsers(page));
        }
        pagination.appendChild(button);
      }
    }

    function fetchUsers(page) {
      fetch(`/getUsers?page=${page}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error('Request failed');
          }
          return response.json();
        })
        .then((data) => {
          userList.innerHTML = '';

          data.users.forEach((user, index) => {
            const listItem = document.createElement('li');
            const position = (data.page - 1) * data.perPage + index + 1;
            listItem.textContent = `${position}. ${user.name} - ${user.tokens} tokens`;
            userList.appendChild(listItem);
          });

          showPagination(data.page, data.totalPages);
        })
        .catch((error) => {
          console.error('Error fetching user data:', error);
        });
    }

    fetchUsers(1);
  });
