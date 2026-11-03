// On the live site the browser talks to /api on the same address as the website;
// vercel.json forwards it to the Render server (so login cookies work in every browser).
// When you open the files on your own computer it talks to the local server instead.
(function () {
    var local = ['localhost', '127.0.0.1', ''].indexOf(location.hostname) !== -1;
    window.API_BASE_URL = local ? 'http://localhost:3000' : '';

    var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

    // api('/api/signin', { method: 'POST', body: {...}, onWaking: fn })
    // Returns { ok, status, data }. Retries while the free Render server wakes up.
    window.api = async function (path, opts) {
        opts = opts || {};
        var init = { method: opts.method || 'GET', credentials: 'include', headers: {} };
        if (opts.body !== undefined) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(opts.body);
        }
        var retries = opts.retries === undefined ? 8 : opts.retries;
        var lastError;
        for (var i = 0; i <= retries; i++) {
            try {
                var res = await fetch(window.API_BASE_URL + path, init);
                if ([502, 503, 504].indexOf(res.status) !== -1 && i < retries) {
                    if (opts.onWaking) opts.onWaking();
                    await sleep(5000);
                    continue;
                }
                var data = null;
                try { data = await res.json(); } catch (e) {}
                return { ok: res.ok, status: res.status, data: data };
            } catch (e) {
                lastError = e;
                if (i < retries) {
                    if (opts.onWaking) opts.onWaking();
                    await sleep(5000);
                }
            }
        }
        throw lastError || new Error('Network error');
    };

    // Wake the free server up as soon as any page opens.
    fetch(window.API_BASE_URL + '/api/health').catch(function () {});
})();
