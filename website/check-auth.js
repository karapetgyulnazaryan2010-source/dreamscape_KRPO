(async function () {
    var analyzeButton = document.getElementById('analyzeButton');
    var loginOverlay = document.getElementById('loginOverlay');
    var closeOverlay = document.getElementById('closeOverlay');

    if (!analyzeButton || !loginOverlay) return;

    loginOverlay.classList.add('hidden');
    loginOverlay.style.display = 'none';

    function showOverlay() {
        loginOverlay.classList.remove('hidden');
        loginOverlay.style.display = 'flex';
    }

    analyzeButton.addEventListener('click', async function (event) {
        try {
            var r = await window.api('/api/me', { retries: 0 });
            if (!r.ok) {
                event.preventDefault();
                event.stopImmediatePropagation();
                showOverlay();
            }
        } catch (error) {
            event.preventDefault();
            event.stopImmediatePropagation();
            showOverlay();
        }
    }, true);

    if (closeOverlay) {
        closeOverlay.addEventListener('click', function () {
            loginOverlay.classList.add('hidden');
            loginOverlay.style.display = 'none';
        });
    }
})();
