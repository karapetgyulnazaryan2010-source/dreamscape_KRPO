(function () {
    var form = document.getElementById('resetForm');
    var msg = document.getElementById('formMessage');
    var button = form.querySelector('button[type="submit"]');
    var token = new URLSearchParams(window.location.search).get('token') || '';

    function show(text, isError) {
        msg.textContent = text;
        msg.className = 'form-message ' + (isError ? 'error' : 'info');
    }

    if (!token) {
        show('This link is incomplete. Ask for a new reset link.', true);
        button.disabled = true;
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var p1 = document.getElementById('password').value;
        var p2 = document.getElementById('password2').value;

        if (p1.length < 8) { show('Password must be at least 8 characters', true); return; }
        if (p1 !== p2) { show('The two passwords are not the same', true); return; }

        button.disabled = true;
        show('Saving...', false);
        try {
            var r = await window.api('/api/reset-password', {
                method: 'POST',
                body: { token: token, password: p1 },
                onWaking: function () { show('The server is waking up, this can take up to a minute...', false); }
            });
            if (r.ok) {
                show('Password changed. Taking you to the login page...', false);
                setTimeout(function () { window.location.href = 'login.html'; }, 1500);
            } else {
                show((r.data && r.data.error) || 'Something went wrong', true);
                button.disabled = false;
            }
        } catch (err) {
            show('Could not reach the server. Please try again in a minute.', true);
            button.disabled = false;
        }
    });
})();
