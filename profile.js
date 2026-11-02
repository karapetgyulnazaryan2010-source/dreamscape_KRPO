(async function() {
    try {
        const response = await fetch('window.API_BASE_URL/api/me', { credentials: 'include' });
        if (!response.ok) {
            window.location.href = 'login.html';
            return;
        }
        const user = await response.json();

        document.getElementById('userName').textContent = user.name;
        document.getElementById('userEmail').textContent = user.email;

        // Admin specific styling and buttons
        if (user.role === 'admin') {
            document.body.classList.add('admin-profile');
            const adminBtn = document.createElement('button');
            adminBtn.className = 'main-button full-width';
            adminBtn.style.marginTop = '10px';
            adminBtn.style.backgroundColor = '#6c5ce7';
            adminBtn.textContent = 'Open Admin Panel';
            adminBtn.onclick = () => window.location.href = 'admin.html';

            const container = document.querySelector('.auth-card');
            if (container) {
                container.appendChild(adminBtn);
            }
        }

        document.getElementById('logoutButton').addEventListener('click', async function() {
            try {
                await fetch('window.API_BASE_URL/api/logout', { method: 'POST', credentials: 'include' });
            } catch (e) {}
            window.location.href = 'index.html';
        });
    } catch (error) {
        window.location.href = 'login.html';
    }
})();