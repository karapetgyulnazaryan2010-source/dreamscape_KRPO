(async function () {
    var nameEl = document.getElementById('displayName');
    var yes = document.getElementById('yesButton');
    var no = document.getElementById('noButton');

    try {
        var r = await window.api('/api/me');
        if (!r.ok) {
            window.location.href = 'login.html';
            return;
        }
        nameEl.textContent = r.data.name;
    } catch (e) {
        window.location.href = 'login.html';
        return;
    }

    // Yes: go to the main page
    yes.addEventListener('click', function () {
        window.location.href = 'index.html';
    });

    // No: log out and go back to the login page
    no.addEventListener('click', async function () {
        try { await window.api('/api/logout', { method: 'POST', retries: 0 }); } catch (e) {}
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });
})();
