(async function () {
    try {
        var r = await window.api('/api/me');
        if (!r.ok) {
            window.location.href = 'login.html';
            return;
        }
        var user = r.data;

        document.getElementById('userName').textContent = user.name;
        document.getElementById('userEmail').textContent = user.email;

        if (user.role === 'admin') {
            document.body.classList.add('admin-profile');
            var adminBtn = document.createElement('button');
            adminBtn.className = 'main-button full-width';
            adminBtn.style.marginTop = '10px';
            adminBtn.style.backgroundColor = '#6c5ce7';
            adminBtn.textContent = 'Open Admin Panel';
            adminBtn.onclick = function () { window.location.href = 'admin.html'; };
            var container = document.querySelector('.auth-card');
            if (container) container.appendChild(adminBtn);
        }

        document.getElementById('logoutButton').addEventListener('click', async function () {
            try { await window.api('/api/logout', { method: 'POST', retries: 0 }); } catch (e) {}
            localStorage.removeItem('user');
            window.location.href = 'index.html';
        });
    } catch (error) {
        window.location.href = 'login.html';
    }
})();
