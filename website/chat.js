(async function () {
    var box = document.getElementById('chatMessages');
    var form = document.getElementById('chatForm');
    var input = document.getElementById('chatInput');
    var sendButton = document.getElementById('sendButton');
    var newButton = document.getElementById('newChatButton');

    var history = [];
    try { history = JSON.parse(sessionStorage.getItem('dreamChat') || '[]'); } catch (e) { history = []; }
    var busy = false;

    function save() { sessionStorage.setItem('dreamChat', JSON.stringify(history)); }

    function scrollDown() { box.scrollTop = box.scrollHeight; }

    function bubble(role, text) {
        var row = document.createElement('div');
        row.className = 'chat-row ' + role;
        var b = document.createElement('div');
        b.className = 'chat-bubble';
        b.textContent = text;               // textContent: nothing typed can inject HTML
        row.appendChild(b);
        box.appendChild(row);
        scrollDown();
        return row;
    }

    function typing(text) {
        var row = document.createElement('div');
        row.className = 'chat-row assistant';
        row.id = 'typingRow';
        var b = document.createElement('div');
        b.className = 'chat-bubble chat-typing';
        b.innerHTML = '<span class="dots"><i></i><i></i><i></i></span><span class="typing-text"></span>';
        b.querySelector('.typing-text').textContent = text || '';
        row.appendChild(b);
        box.appendChild(row);
        scrollDown();
        return row;
    }

    function greeting() {
        bubble('assistant', 'Hi ☾ I\'m your Dream Guide. Tell me about your dream: what happened, who was there, and how you felt. Then we\'ll explore what it might mean together.');
    }

    function render() {
        box.innerHTML = '';
        if (!history.length) greeting();
        history.forEach(function (m) { bubble(m.role, m.content); });
    }

    function setBusy(v) {
        busy = v;
        sendButton.disabled = v;
        input.disabled = v;
        if (!v) input.focus();
    }

    // Ask the server for the Dream Guide's answer to the current conversation
    async function ask() {
        setBusy(true);
        var t = typing('');
        try {
            var r = await window.api('/api/chat', {
                method: 'POST',
                body: { messages: history },
                retries: 6,
                onWaking: function () {
                    var el = t.querySelector('.typing-text');
                    if (el) el.textContent = ' The server is waking up, this can take up to a minute...';
                }
            });
            t.remove();
            if (r.ok && r.data && r.data.reply) {
                history.push({ role: 'assistant', content: r.data.reply });
                save();
                bubble('assistant', r.data.reply);
            } else if (r.status === 401) {
                window.location.href = 'login.html';
                return;
            } else {
                errorBubble((r.data && r.data.error) || 'The server is waking up or busy. Please press "Try again" in a few seconds.');
            }
        } catch (e) {
            t.remove();
            errorBubble('Could not reach the server. Please try again in a minute.');
        }
        setBusy(false);
    }

    function errorBubble(message) {
        var row = bubble('assistant', message);
        row.classList.add('chat-error');
        var retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'chat-retry';
        retry.textContent = 'Try again';
        retry.addEventListener('click', function () { row.remove(); ask(); });
        row.querySelector('.chat-bubble').appendChild(document.createElement('br'));
        row.querySelector('.chat-bubble').appendChild(retry);
    }

    function sendText(text) {
        text = text.trim();
        if (!text || busy) return;
        history.push({ role: 'user', content: text });
        save();
        bubble('user', text);
        input.value = '';
        autoGrow();
        ask();
    }

    function autoGrow() {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 140) + 'px';
    }

    // Only logged-in people can chat
    try {
        var me = await window.api('/api/me', { retries: 3 });
        if (!me.ok) { window.location.href = 'login.html'; return; }
    } catch (e) {
        window.location.href = 'login.html';
        return;
    }

    render();

    form.addEventListener('submit', function (e) { e.preventDefault(); sendText(input.value); });
    input.addEventListener('input', autoGrow);
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(input.value); }
    });
    newButton.addEventListener('click', function () {
        if (busy) return;
        history = [];
        sessionStorage.removeItem('dreamChat');
        sessionStorage.removeItem('pendingDream');
        render();
        input.focus();
    });

    // The dream written on the main page becomes the first message
    var pending = sessionStorage.getItem('pendingDream');
    if (pending && !history.length) {
        sessionStorage.removeItem('pendingDream');
        sendText(pending);
    } else if (history.length && history[history.length - 1].role === 'user') {
        ask();   // the last answer never arrived (page was closed): ask again
    }
})();
