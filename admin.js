(async function() {
    try {
        const response = await fetch('window.API_BASE_URL/api/me', { credentials: 'include' });
        if (!response.ok) {
            window.location.href = 'login.html';
            return;
        }
        const user = await response.json();
        if (user.role !== 'admin') {
            alert('Access denied. You must be an admin to view this page.');
            window.location.href = 'index.html';
            return;
        }
        loadUsers();
    } catch (error) {
        window.location.href = 'login.html';
    }
})();

async function loadUsers() {
    try {
        const response = await fetch('window.API_BASE_URL/api/admin/users', { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to load users');

        const users = await response.json();
        const listElement = document.getElementById('userList');
        listElement.innerHTML = '';

        if (users.length === 0) {
            listElement.innerHTML = '<p style="text-align: center; opacity: 0.6;">No users found.</p>';
            return;
        }

        users.forEach(user => {
            const item = document.createElement('div');
            item.className = 'user-item';
            item.innerHTML = `
                <div class="user-info">
                    <div class="user-name">${user.name} <span class="user-role">${user.role}</span></div>
                    <div class="user-email">${user.email}</div>
                </div>
                <button class="delete-btn" onclick="deleteUser(${user.id})">Delete</button>
            `;
            listElement.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('userList').innerHTML = '<p style="text-align: center; color: #ff7675;">Failed to load users. Are you an admin?</p>';
    }
}

async function deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
        const response = await fetch(`window.API_BASE_URL/api/admin/user/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (response.ok) {
            alert('User deleted successfully.');
            loadUsers();
        } else {
            alert('Failed to delete user.');
        }
    } catch (error) {
        alert('Error connecting to server.');
    }
}
