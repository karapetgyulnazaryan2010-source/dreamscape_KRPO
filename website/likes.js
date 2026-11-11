document.addEventListener('DOMContentLoaded', async () => {
    const buttons = Array.from(document.querySelectorAll('.like-button'));
    const state = { counts: {}, liked: new Set() };

    // The number shown = the starting number written in the page + the real likes saved on the server
    function render(button) {
        const id = button.dataset.postId;
        const base = parseInt(button.dataset.base, 10) || 0;
        const liked = state.liked.has(id);
        button.classList.toggle('liked', liked);
        button.querySelector('.heart-icon').textContent = liked ? '♥' : '♡';
        button.querySelector('.like-count').textContent = base + (state.counts[id] || 0);
    }

    function pop(button) {
        const heart = button.querySelector('.heart-icon');
        heart.classList.remove('heart-pop');
        void heart.offsetWidth;
        heart.classList.add('heart-pop');
    }

    function toast(html) {
        let box = document.getElementById('likeToast');
        if (!box) {
            box = document.createElement('div');
            box.id = 'likeToast';
            box.style.cssText = 'position:fixed;left:50%;bottom:30px;transform:translateX(-50%);' +
                'background:rgba(30,25,60,.97);color:#fff;padding:12px 20px;border-radius:12px;' +
                'box-shadow:0 8px 30px rgba(0,0,0,.4);z-index:1000;font-size:.95rem;';
            document.body.appendChild(box);
        }
        box.innerHTML = html;
        box.style.display = 'block';
        clearTimeout(box._t);
        box._t = setTimeout(() => { box.style.display = 'none'; }, 4000);
    }

    // Load the saved likes (works even when logged out)
    try {
        const r = await window.api('/api/likes', { retries: 3 });
        if (r.ok && r.data) {
            state.counts = r.data.counts || {};
            state.liked = new Set(r.data.liked || []);
        }
    } catch (e) { /* keep the numbers written in the page */ }
    buttons.forEach(render);

    buttons.forEach((button) => {
        let busy = false;
        button.addEventListener('click', async () => {
            if (busy) return;
            const id = button.dataset.postId;
            if (!id) return;
            busy = true;

            const wasLiked = state.liked.has(id);
            const before = state.counts[id] || 0;

            // Show the change immediately
            if (wasLiked) {
                state.liked.delete(id);
                state.counts[id] = Math.max(0, before - 1);
            } else {
                state.liked.add(id);
                state.counts[id] = before + 1;
            }
            render(button);
            pop(button);

            function undo() {
                if (wasLiked) state.liked.add(id); else state.liked.delete(id);
                state.counts[id] = before;
                render(button);
            }

            try {
                const r = await window.api('/api/likes/' + encodeURIComponent(id), {
                    method: wasLiked ? 'DELETE' : 'POST',
                    retries: 2
                });
                if (r.status === 401) {
                    undo();
                    toast('Please <a href="login.html" style="color:#a99bff;font-weight:600;">log in</a> to like dreams.');
                } else if (!r.ok) {
                    undo();
                    toast('Could not save your like. Please try again.');
                } else {
                    state.counts[id] = r.data.count;   // the real number from the server
                    render(button);
                }
            } catch (e) {
                undo();
                toast('Could not reach the server. Please try again.');
            }
            busy = false;
        });
    });
});
