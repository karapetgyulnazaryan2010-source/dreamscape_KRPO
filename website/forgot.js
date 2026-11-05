(function () {
    var form = document.getElementById('forgotForm');
    var msg = document.getElementById('formMessage');
    var button = form.querySelector('button[type="submit"]');

    function show(text, isError) {
        msg.textContent = text;
        msg.className = 'form-message ' + (isError ? 'error' : 'info');
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var email = document.getElementById('email').value.trim();

        button.disabled = true;
        show('Sending...', false);
        try {
            var r = await window.api('/api/forgot-password', {
                method: 'POST',
                body: { email: email },
                onWaking: function () { show('The server is waking up, this can take up to a minute...', false); }
            });
            if (r.ok) {
                show('If an account exists for this email, a reset link is on its way. It is valid for 30 minutes.', false);
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
