(async function() {
    const analyzeButton = document.getElementById('analyzeButton');
    const loginOverlay = document.getElementById('loginOverlay');
    const closeOverlay = document.getElementById('closeOverlay');

    if (!analyzeButton || !loginOverlay) return;

    loginOverlay.classList.add('hidden');
    loginOverlay.style.display = 'none';

    analyzeButton.addEventListener('click', async function(event) {
        try {
            const response = await fetch('window.API_BASE_URL/api/me', { credentials: 'include' });
            if (!response.ok) {
                // Not logged in: Show overlay and STOP
                event.preventDefault();
                event.stopImmediatePropagation();
                loginOverlay.classList.remove('hidden');
                loginOverlay.style.display = 'flex';
            } else {
                console.log('User is logged in, proceeding...');
            }
        } catch (error) {
            // Server error: Default to showing login for safety
            event.preventDefault();
            loginOverlay.classList.remove('hidden');
            loginOverlay.style.display = 'flex';
        }
    }, true);

    closeOverlay.addEventListener('click', function() {
        loginOverlay.classList.add('hidden');
        loginOverlay.style.display = 'none';
    });
})();