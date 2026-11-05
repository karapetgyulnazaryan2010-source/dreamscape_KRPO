(async function () {
    try {
        var r = await window.api('/api/me');
        if (!r.ok) {
            window.location.href = 'login.html';
            return;
        }
        if (r.data.role !== 'admin') {
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
    var listElement = document.getElementById('userList');
    try {
        var r = await window.api('/api/admin/users');
        if (!r.ok) throw new Error('Failed to load users');
        var users = r.data;
        listElement.innerHTML = '';

        if (users.length === 0) {
            listElement.innerHTML = '<p style="text-align: center; opacity: 0.6;">No users found.</p>';
            return;
        }

        users.forEach(function (user) {
            var item = document.createElement('div');
            item.className = 'user-item';

            var info = document.createElement('div');
            info.className = 'user-info';
            var nameEl = document.createElement('div');
            nameEl.className = 'user-name';
            nameEl.textContent = user.name + ' ';           // textContent: names can't inject HTML
            var roleEl = document.createElement('span');
            roleEl.className = 'user-role';
            roleEl.textContent = user.role;
            nameEl.appendChild(roleEl);
            var emailEl = document.createElement('div');
            emailEl.className = 'user-email';
            emailEl.textContent = user.email;
            info.appendChild(nameEl);
            info.appendChild(emailEl);

            var del = document.createElement('button');
            del.className = 'delete-btn';
            del.textContent = 'Delete';
            del.addEventListener('click', function () { deleteUser(user.id); });

            var reset = document.createElement('button');
            reset.className = 'reset-btn';
            reset.textContent = 'Reset password';
            reset.addEventListener('click', function () { resetPassword(user); });

            var actions = document.createElement('div');
            actions.className = 'user-actions';
            actions.appendChild(reset);
            actions.appendChild(del);

            item.appendChild(info);
            item.appendChild(actions);
            listElement.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading users:', error);
        listElement.innerHTML = '<p style="text-align: center; color: #ff7675;">Failed to load users. Are you an admin?</p>';
    }
}

async function deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
        var r = await window.api('/api/admin/user/' + id, { method: 'DELETE', retries: 0 });
        if (r.ok) {
            loadUsers();
        } else {
            alert((r.data && r.data.error) || 'Failed to delete user.');
        }
    } catch (error) {
        alert('Error connecting to server.');
    }
}

async function resetPassword(user) {
    if (!confirm('Give ' + user.email + ' a new temporary password? Their old password will stop working.')) return;
    try {
        var r = await window.api('/api/admin/user/' + user.id + '/reset-password', { method: 'POST', retries: 0 });
        if (r.ok) {
            alert('Temporary password for ' + user.email + ':\n\n' + r.data.password + '\n\nGive it to the person. It is shown only once.');
        } else {
            alert((r.data && r.data.error) || 'Failed to reset password.');
        }
    } catch (error) {
        alert('Error connecting to server.');
    }
}
