// "Decode My Dream": save what the person wrote, then open the chat page with the Dream Guide.
(function () {
    var button = document.getElementById('analyzeButton');
    var input = document.getElementById('dreamInput');
    if (!button || !input) return;

    // If the person had to log in first, put their text back
    var pending = sessionStorage.getItem('pendingDream');
    if (pending && !input.value) input.value = pending;

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
        sessionStorage.setItem('pendingDream', text);
        try {
            var r = await window.api('/api/me', { retries: 3 });
            if (r.ok) {
                sessionStorage.removeItem('dreamChat');   // start a fresh conversation
                window.location.href = 'chat.html';
                return;
            }
            showLoginOverlay();
        } catch (err) {
            showLoginOverlay();
        }
        button.disabled = false;
    }, true);
})();
