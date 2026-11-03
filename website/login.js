(function () {
    var form = document.getElementById('loginForm');
    var msg = document.getElementById('formMessage');
    var button = form.querySelector('button[type="submit"]');

    function show(text, isError) {
        msg.textContent = text;
        msg.className = 'form-message ' + (isError ? 'error' : 'info');
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var email = document.getElementById('email').value.trim();
        var password = document.getElementById('password').value;

        button.disabled = true;
        show('Logging in...', false);
        try {
            var r = await window.api('/api/signin', {
                method: 'POST',
                body: { email: email, password: password },
                onWaking: function () { show('The server is waking up, this can take up to a minute...', false); }
            });
            if (r.ok) {
                localStorage.setItem('user', JSON.stringify(r.data.user));
                window.location.href = 'index.html';
            } else {
                show((r.data && r.data.error) || 'Login failed', true);
                button.disabled = false;
            }
        } catch (err) {
            show('Could not reach the server. Please try again in a minute.', true);
            button.disabled = false;
        }
    });
})();
