// "Decode My Dream": save what the person wrote, then open the chat page with the Dream Guide.
(function () {
    var button = document.getElementById('analyzeButton');
    var input = document.getElementById('dreamInput');
    if (!button || !input) return;

    // If the person had to log in first, put their text back
    var pending = sessionStorage.getItem('pendingDream');
    if (pending && !input.value) input.value = pending;

    function notice(text) {
        var el = document.getElementById('decodeNotice');
        if (!el) {
            el = document.createElement('p');
            el.id = 'decodeNotice';
            el.style.cssText = 'margin-top:10px;font-size:.9rem;color:#c4b5fd;text-align:center;';
            button.insertAdjacentElement('afterend', el);
        }
        el.textContent = text;
    }

    function showLoginOverlay() {
        var overlay = document.getElementById('loginOverlay');
        if (!overlay) { window.location.href = 'login.html'; return; }
        overlay.classList.remove('hidden');
        overlay.style.display = 'flex';
    }

    button.addEventListener('click', async function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();

        var text = input.value.trim();
        if (!text) {
            input.focus();
            input.style.outline = '2px solid #ff7675';
            setTimeout(function () { input.style.outline = ''; }, 1500);
            return;
        }

        button.disabled = true;
        notice('');
        sessionStorage.setItem('pendingDream', text);
        try {
            var r = await window.api('/api/me', { retries: 3 });
            if (r.ok) {
                sessionStorage.removeItem('dreamChat');   // start a fresh conversation
                window.location.href = 'chat.html';
                return;
            }
            if (r.status === 401) {
                showLoginOverlay();            // really not logged in
            } else {
                notice('The server is waking up. Please wait a few seconds and press the button again.');
            }
        } catch (err) {
            notice('Could not reach the server. Please try again in a moment.');
        }
        button.disabled = false;
    }, true);
})();
