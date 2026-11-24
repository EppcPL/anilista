/* =========================================================
   transfer.js – przenoszenie danych kodem (JSONBin.io + kopia lokalna)
   ========================================================= */
const Transfer = (() => {
    // UWAGA: klucz jest widoczny dla każdego, kto otworzy źródło strony.
    const JSONBIN = {
        apiUrl: 'https://api.jsonbin.io/v3/b',
        binId: '688be2b17b4b8670d8aa9a8b',
        apiKey: '$2a$10$5TR9RcCQnEyNeG6Un1qRW.ftdKAU9U5BZESY9FhDh4yCr8xWcJli2'
    };
    const FALLBACK_URL = 'https://eppcpl.github.io/anilista/anilista.html';
    const HOUR = 60 * 60 * 1000;
    let online = true;
    let timer = null;

    /* ---------- magazyn kodów ---------- */
    const localRead = () => { try { return JSON.parse(localStorage.getItem('transfer_codes_backup')) || { transfer_codes: {} }; } catch { return { transfer_codes: {} }; } };
    const localWrite = (data) => { try { localStorage.setItem('transfer_codes_backup', JSON.stringify(data)); } catch { /* pomijamy */ } };

    async function remoteRead() {
        const res = await fetch(`${JSONBIN.apiUrl}/${JSONBIN.binId}/latest`, { headers: { 'X-Master-Key': JSONBIN.apiKey } });
        if (!res.ok) throw new Error(`JSONBin ${res.status}`);
        const json = await res.json();
        const data = json.record || json;
        delete data._ignore;
        data.transfer_codes = data.transfer_codes || {};
        return data;
    }

    async function remoteWrite(data) {
        const res = await fetch(`${JSONBIN.apiUrl}/${JSONBIN.binId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN.apiKey },
            body: JSON.stringify({ ...data, _ignore: true })
        });
        if (!res.ok) throw new Error(`JSONBin ${res.status}`);
    }

    async function load() {
        if (online) {
            try {
                const data = await remoteRead();
                localWrite(data);
                return data;
            } catch (err) {
                online = false;
                console.warn('JSONBin niedostępny, używam kopii lokalnej', err);
            }
        }
        return localRead();
    }

    async function save(data) {
        localWrite(data);
        if (!online) return false;
        try {
            await remoteWrite(data);
            return true;
        } catch (err) {
            online = false;
            console.warn(err);
            return false;
        }
    }

    function dropExpired(data) {
        const now = Date.now();
        let changed = false;
        Object.keys(data.transfer_codes).forEach(code => {
            if (data.transfer_codes[code].expiresAt < now) { delete data.transfer_codes[code]; changed = true; }
        });
        return changed;
    }

    async function getCode(code) {
        const data = await load();
        const entry = data.transfer_codes[code];
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            delete data.transfer_codes[code];
            await save(data);
            return null;
        }
        return entry;
    }

    /* ---------- aktywny kod ---------- */
    function active() {
        try {
            const c = JSON.parse(localStorage.getItem('active_export_code'));
            if (c && c.expiresAt > Date.now()) return c;
        } catch { /* pomijamy */ }
        localStorage.removeItem('active_export_code');
        return null;
    }

    const linkFor = (code) => {
        const base = location.protocol.startsWith('http') ? location.origin + location.pathname : FALLBACK_URL;
        return `${base}?code=${code}`;
    };

    function renderBox() {
        clearInterval(timer);
        const box = U.$('transfer-box');
        const a = active();
        if (!a) {
            box.innerHTML = `
                <div class="transfer-text"><i class="fas fa-mobile-screen"></i> Przenieś dane na inne urządzenie</div>
                <button class="btn btn-ghost btn-sm" data-t="generate"><i class="fas fa-qrcode"></i> Generuj kod</button>
                <button class="btn btn-ghost btn-sm" data-t="import"><i class="fas fa-download"></i> Wgraj kod</button>`;
            return;
        }
        box.innerHTML = `
            <div class="transfer-text">Aktywny kod: <strong class="code-inline">${a.code}</strong> <span class="muted" data-left></span></div>
            <button class="btn btn-ghost btn-sm" data-t="show"><i class="fas fa-qrcode"></i> Pokaż</button>
            <button class="btn btn-ghost btn-sm" data-t="copy"><i class="fas fa-copy"></i> Kopiuj</button>
            <button class="btn btn-ghost btn-sm" data-t="check"><i class="fas fa-magnifying-glass"></i> Sprawdź</button>
            <button class="btn btn-ghost btn-sm" data-t="import"><i class="fas fa-download"></i> Wgraj kod</button>`;
        const tickFn = () => {
            const left = a.expiresAt - Date.now();
            if (left <= 0) { localStorage.removeItem('active_export_code'); renderBox(); return; }
            const m = Math.floor(left / 60000), s = Math.floor(left % 60000 / 1000);
            const text = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            const el = box.querySelector('[data-left]');
            if (el) el.textContent = `(wygasa za ${text})`;
            U.$('time-remaining').textContent = text;
        };
        tickFn();
        timer = setInterval(tickFn, 1000);
    }

    /* ---------- akcje ---------- */
    async function generate() {
        if (active()) return showCode();
        U.$('generated-code').textContent = 'Generowanie…';
        U.$('qr-code-inline').hidden = true;
        UI.open('generate-code-modal');
        try {
            const data = await load();
            dropExpired(data);
            let code;
            do { code = String(Math.floor(100000 + Math.random() * 900000)); } while (data.transfer_codes[code]);
            const now = Date.now();
            const { anime, planner, activity, details } = Store.state;
            data.transfer_codes[code] = { animeList: anime, plannerList: planner, activityData: activity, activityDetails: details, createdAt: now, expiresAt: now + HOUR };
            const remote = await save(data);
            localStorage.setItem('active_export_code', JSON.stringify({ code, expiresAt: now + HOUR, createdAt: now }));
            U.$('generated-code').textContent = code;
            renderBox();
            UI.toast(remote ? `Kod ${code} gotowy` : 'Serwer niedostępny – kod działa tylko na tym urządzeniu', remote ? 'success' : 'warning');
        } catch (err) {
            UI.close('generate-code-modal');
            UI.toast('Nie udało się wygenerować kodu: ' + err.message, 'danger');
        }
    }

    function showCode() {
        const a = active();
        if (!a) return;
        U.$('generated-code').textContent = a.code;
        U.$('qr-code-inline').hidden = true;
        UI.open('generate-code-modal');
    }

    function showQR() {
        const a = active();
        if (!a) return;
        const box = U.$('qr-code-inline');
        const url = linkFor(a.code);
        if (typeof qrcode === 'function') {
            const qr = qrcode(0, 'L');
            qr.addData(url);
            qr.make();
            box.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2 });
        } else {
            box.innerHTML = `<p>Nie udało się załadować generatora QR. Link:</p><p class="break">${U.esc(url)}</p>`;
        }
        box.innerHTML += `<a class="btn btn-ghost btn-sm" href="${U.esc(url)}" target="_blank" rel="noopener"><i class="fas fa-up-right-from-square"></i> Otwórz link</a>`;
        box.hidden = false;
    }

    async function check() {
        const a = active();
        if (!a) return;
        const entry = await getCode(a.code);
        if (entry) UI.toast('Kod jest nadal ważny', 'success');
        else {
            localStorage.removeItem('active_export_code');
            renderBox();
            UI.toast('Kod został już użyty albo wygasł', 'warning');
        }
    }

    function openImport(prefill = '') {
        const input = U.$('import-code-input');
        input.value = prefill;
        input.classList.remove('error');
        U.$('import-preview').hidden = true;
        UI.open('import-code-modal');
        input.focus();
        if (prefill) input.dispatchEvent(new Event('input'));
    }

    async function onCodeInput(e) {
        const input = e.target;
        input.value = input.value.replace(/\D/g, '');
        input.classList.remove('error');
        const preview = U.$('import-preview');
        preview.hidden = true;
        if (input.value.length !== 6) return;
        const out = U.$('import-preview-content');
        out.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sprawdzam kod…';
        preview.hidden = false;
        U.$('confirm-import-btn').hidden = true;
        const entry = await getCode(input.value);
        if (!entry) {
            preview.hidden = true;
            input.classList.add('error');
            return UI.toast('Nieprawidłowy lub wygasły kod', 'danger');
        }
        out.innerHTML = `
            <b>Znaleziono dane:</b><br>
            Anime: ${(entry.animeList || []).length} · Planer: ${(entry.plannerList || []).length} · Dni aktywności: ${Object.keys(entry.activityData || {}).length}<br>
            <small>Utworzono ${new Date(entry.createdAt).toLocaleString('pl-PL')}</small>`;
        U.$('confirm-import-btn').hidden = false;
    }

    async function confirmImport() {
        const code = U.$('import-code-input').value;
        const btn = U.$('confirm-import-btn');
        btn.disabled = true;
        try {
            const entry = await getCode(code);
            if (!entry) return UI.toast('Kod jest nieprawidłowy lub wygasł', 'danger');
            const s = Store.state;
            (entry.animeList || []).forEach(a => {
                if (!s.anime.some(x => x.title === a.title)) s.anime.push({ ...a, id: Store.newId() + Math.floor(Math.random() * 1e6) });
            });
            (entry.plannerList || []).forEach(p => {
                if (!s.planner.some(x => x.title === p.title)) s.planner.push({ ...p, id: Store.newId() + Math.floor(Math.random() * 1e6) });
            });
            Object.entries(entry.activityData || {}).forEach(([d, n]) => { s.activity[d] = (s.activity[d] || 0) + n; });
            Object.entries(entry.activityDetails || {}).forEach(([d, list]) => { s.details[d] = (s.details[d] || []).concat(list || []); });
            Store.saveAll();

            const data = await load();
            delete data.transfer_codes[code];
            await save(data);
            const a = active();
            if (a && a.code === code) localStorage.removeItem('active_export_code');

            UI.close('import-code-modal');
            App.refresh();
            UI.toast('Dane wgrane, kod usunięty', 'success');
        } catch (err) {
            UI.toast('Błąd importu: ' + err.message, 'danger');
        } finally {
            btn.disabled = false;
        }
    }

    function init() {
        U.$('transfer-box').addEventListener('click', (e) => {
            const t = e.target.closest('[data-t]')?.dataset.t;
            if (t === 'generate') generate();
            if (t === 'import') openImport();
            if (t === 'show') showCode();
            if (t === 'copy') U.copyText(active()?.code || '').then(() => UI.toast('Kod skopiowany', 'success'));
            if (t === 'check') check();
        });
        U.$('copy-code-btn').onclick = () => U.copyText(U.$('generated-code').textContent).then(() => UI.toast('Kod skopiowany', 'success'));
        U.$('show-qr-btn').onclick = showQR;
        U.$('import-code-input').addEventListener('input', onCodeInput);
        U.$('confirm-import-btn').onclick = confirmImport;
        renderBox();

        // Link z kodem (?code=123456) – od razu otwórz import
        const code = new URLSearchParams(location.search).get('code');
        if (code && /^\d{6}$/.test(code)) setTimeout(() => openImport(code), 400);

        // Sprzątanie wygasłych kodów w tle
        load().then(data => { if (dropExpired(data)) save(data); }).catch(() => {});
    }

    return { init, renderBox };
})();
