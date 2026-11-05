(function () {
    var form = document.getElementById('signupForm');
    var msg = document.getElementById('formMessage');
    var button = form.querySelector('button[type="submit"]');

    function show(text, isError) {
        msg.textContent = text;
        msg.className = 'form-message ' + (isError ? 'error' : 'info');
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var name = document.getElementById('name').value.trim();
        var email = document.getElementById('email').value.trim();
        var password = document.getElementById('password').value;
        if (password.length < 8) {
            show('Password must be at least 8 characters', true);
            return;
        }

        button.disabled = true;
        show('Creating your account...', false);
        try {
            var r = await window.api('/api/signup', {
                method: 'POST',
                body: { name: name, email: email, password: password },
                onWaking: function () { show('The server is waking up, this can take up to a minute...', false); }
            });
            if (r.ok) {
                localStorage.setItem('user', JSON.stringify(r.data.user));
                window.location.href = 'welcome.html';
            } else {
                show((r.data && r.data.error) || 'Signup failed', true);
                button.disabled = false;
            }
        } catch (err) {
            show('Could not reach the server. Please try again in a minute.', true);
            button.disabled = false;
        }
    });
})();
