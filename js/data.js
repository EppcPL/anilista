/* =========================================================
   data.js – eksport / import pliku JSON i czyszczenie danych
   ========================================================= */
const DataIO = (() => {
    function exportData() {
        const { anime, planner, activity, details } = Store.state;
        const payload = { animeList: anime, plannerList: planner, activityData: activity, activityDetails: details, exportedAt: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `anilista-data-${U.todayKey()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        UI.toast('Dane wyeksportowane', 'success');
    }

    function importFile(file) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                const s = Store.state;
                let anime, planner;
                if (Array.isArray(data)) { anime = data; planner = []; }        // bardzo stary format
                else if (Array.isArray(data.animeList)) { anime = data.animeList; planner = data.plannerList || []; }
                else return UI.toast('Ten plik nie wygląda na kopię anilista', 'danger');

                if (!confirm(`Zastąpić obecne dane? W pliku: ${anime.length} anime, ${planner.length} w planerze.`)) return;
                s.anime = anime;
                s.planner = planner;
                if (data.activityData) s.activity = data.activityData;
                if (data.activityDetails) s.details = data.activityDetails;
                Store.saveAll();
                App.refresh();
                UI.toast('Dane zaimportowane', 'success');
            } catch (err) {
                UI.toast('Nie udało się odczytać pliku: ' + err.message, 'danger');
            }
        };
        reader.readAsText(file);
    }

    function clearAll() {
        if (!confirm('Usunąć wszystkie dane z tej przeglądarki? Tego nie da się cofnąć.')) return;
        Object.assign(Store.state, { anime: [], planner: [], activity: {}, details: {} });
        Store.saveAll();
        App.refresh();
        UI.toast('Wszystkie dane usunięte', 'danger');
    }

    /* ---------- publiczny profil ---------- */
    const PP_FIELDS = ['activity', 'covers', 'planner', 'notes'];

    function ppSettings() {
        let saved = {};
        try { saved = JSON.parse(Store.pref('publicProfile', '{}')) || {}; } catch { /* pomijamy */ }
        return { nick: '', activity: true, covers: true, planner: true, notes: false, ...saved };
    }

    function ppRead() {
        const s = { nick: U.$('pp-nick').value.trim() };
        PP_FIELDS.forEach(f => { s[f] = U.$(`pp-${f}`).checked; });
        Store.setPref('publicProfile', JSON.stringify(s));
        return s;
    }

    /** Dane, które trafią na publiczny profil (bez prywatnych rzeczy) */
    function buildProfile(opt) {
        const { anime, planner, activity, details } = Store.state;
        return {
            nick: opt.nick || 'Mój profil',
            updatedAt: new Date().toISOString(),
            animeList: anime.map(a => {
                const copy = { ...a };
                if (!opt.covers) delete copy.image;
                return copy;
            }),
            plannerList: opt.planner ? planner.map(p => {
                const copy = { ...p };
                if (!opt.notes) delete copy.notes;
                return copy;
            }) : [],
            activityData: opt.activity ? activity : {},
            activityDetails: opt.activity ? details : {},
            options: { activity: opt.activity, planner: opt.planner }
        };
    }

    function profileText() {
        const data = buildProfile(ppRead());
        return `/* Publiczny profil anilista – wygenerowano ${new Date().toLocaleString('pl-PL')} */\nwindow.__PROFILE__ = ${JSON.stringify(data)};\n`;
    }

    const fmtSize = (bytes) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

    function exportProfile() {
        const text = profileText();
        const blob = new Blob([text], { type: 'text/javascript' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'profil-dane.js';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        U.$('pp-size').textContent = `Rozmiar pliku: ${fmtSize(blob.size)}. Wgraj go do repo (Add file → Upload files), a po minucie profil będzie widoczny.`;
        UI.toast('Pobrano profil-dane.js', 'success');
    }

    /* ---------- wysyłanie na GitHuba (GitHub API, token tylko w tej przeglądarce) ---------- */
    const GH_TOKEN = 'ghToken';
    const GH_REPO = 'ghRepo';
    const PROFILE_FILE = 'profil-dane.js';

    function ghConfig() {
        return { token: Store.pref(GH_TOKEN, ''), repo: Store.pref(GH_REPO, 'EppcPL/anilista') };
    }

    function ghStatus() {
        const { token, repo } = ghConfig();
        U.$('gh-status').textContent = token ? `– połączono z ${repo}` : '– nie połączono';
    }

    /** Tekst (UTF-8) -> base64, kawałkami, żeby duże pliki nie wywaliły przeglądarki */
    function toBase64(text) {
        const bytes = new TextEncoder().encode(text);
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(bin);
    }

    async function ghRequest(path, options = {}) {
        const { token, repo } = ghConfig();
        const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
            ...options,
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${token}`,
                'X-GitHub-Api-Version': '2022-11-28',
                ...(options.headers || {})
            }
        });
        return res;
    }

    function ghError(status) {
        if (status === 401) return 'Token jest nieprawidłowy albo wygasł. Wygeneruj nowy.';
        if (status === 403) return 'Token nie ma uprawnień do zapisu. Ustaw „Contents: Read and write”.';
        if (status === 404) return 'Nie znaleziono repozytorium. Sprawdź nazwę i czy token ma dostęp do tego repo.';
        if (status === 409 || status === 422) return 'GitHub odrzucił zapis (konflikt). Spróbuj jeszcze raz za chwilę.';
        return `GitHub zwrócił błąd ${status}.`;
    }

    /* ---------- automatyczna publikacja ---------- */
    const AUTO_KEY = 'ghAutoPublish';
    const SIG_KEY = 'ghLastSignature';
    const LAST_KEY = 'ghLastPublished';
    const AUTO_DELAY = 15 * 1000; // zbieramy zmiany przez 15 s, potem jedna wysyłka
    let autoTimer = null;
    let publishing = null;   // trwająca wysyłka (Promise)
    let again = false;       // coś się zmieniło w trakcie wysyłki

    const autoOn = () => Store.pref(AUTO_KEY, 'true') !== 'false' && !!ghConfig().token;

    /** Podpis danych bez daty – żeby nie wysyłać, gdy nic się nie zmieniło */
    function signature() {
        const data = buildProfile(ppSettingsSaved());
        delete data.updatedAt;
        const str = JSON.stringify(data);
        let h = 0;
        for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
        return `${str.length}:${h}`;
    }

    function ppSettingsSaved() {
        const s = ppSettings();
        return s;
    }

    function renderPublishInfo(extra = '') {
        const last = Store.pref(LAST_KEY, '');
        const el = U.$('pp-last');
        if (!el) return;
        if (!ghConfig().token) { el.textContent = 'Połącz z GitHubem, żeby profil aktualizował się sam.'; return; }
        el.innerHTML = `${autoOn() ? '<i class="fas fa-circle-check ok"></i> Profil aktualizuje się automatycznie.' : '<i class="fas fa-circle-pause"></i> Automatyczna aktualizacja wyłączona.'}
            ${last ? ` Ostatnia publikacja: ${U.fmtDateRelative(new Date(last)).toLowerCase()} o ${U.fmtClock(new Date(last))}.` : ''} ${extra}`;
    }

    /** Wywoływane przy każdym zapisie danych */
    function scheduleAuto() {
        if (!autoOn()) return;
        clearTimeout(autoTimer);
        renderPublishInfo('<span class="muted">Zmiany zostaną wysłane za chwilę…</span>');
        autoTimer = setTimeout(() => publishProfile({ silent: true }), AUTO_DELAY);
    }

    async function publishProfile({ silent = false } = {}) {
        clearTimeout(autoTimer);
        const { token } = ghConfig();
        if (!token) {
            if (silent) return;
            U.$('gh-setup').open = true;
            U.$('gh-token').focus();
            return UI.toast('Najpierw połącz stronę z GitHubem (instrukcja poniżej)', 'warning');
        }
        // jedna wysyłka naraz; zmiany w trakcie – kolejna po zakończeniu
        if (publishing) { again = true; return publishing; }
        const sig = signature();
        if (silent && sig === Store.pref(SIG_KEY, '')) { renderPublishInfo(); return; }

        const btn = U.$('pp-publish');
        const original = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Wysyłanie…';
        publishing = (async () => {
            try {
                // sha istniejącego pliku jest potrzebne, żeby go nadpisać
                let sha;
                const head = await ghRequest(`${PROFILE_FILE}?ref=main`, { cache: 'no-store' });
                if (head.ok) sha = (await head.json()).sha;
                else if (head.status !== 404) throw new Error(ghError(head.status));

                const text = silent ? profileTextSaved() : profileText();
                const res = await ghRequest(PROFILE_FILE, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: `Aktualizacja profilu (${new Date().toLocaleString('pl-PL')})`,
                        content: toBase64(text),
                        branch: 'main',
                        ...(sha ? { sha } : {})
                    })
                });
                if (!res.ok) throw new Error(ghError(res.status));
                Store.setPref(SIG_KEY, signature());
                Store.setPref(LAST_KEY, new Date().toISOString());
                const { repo } = ghConfig();
                const [owner, name] = repo.split('/');
                const url = `https://${owner.toLowerCase()}.github.io/${name}/profil.html`;
                U.$('pp-size').innerHTML = `Opublikowano (${fmtSize(new Blob([text]).size)}). Profil: <a href="${url}" target="_blank" rel="noopener">${url}</a>`;
                renderPublishInfo();
                if (!silent) UI.toast('Profil opublikowany na GitHubie', 'success');
            } catch (err) {
                const msg = err.message.startsWith('Failed to fetch') ? 'Brak połączenia z GitHubem' : err.message;
                UI.toast(silent ? `Nie udało się zaktualizować profilu: ${msg}` : msg, 'danger');
                renderPublishInfo('<span class="warn">Ostatnia próba się nie udała.</span>');
            } finally {
                btn.disabled = false;
                btn.innerHTML = original;
                publishing = null;
                if (again) { again = false; scheduleAuto(); }
            }
        })();
        return publishing;
    }

    function profileTextSaved() {
        const data = buildProfile(ppSettingsSaved());
        return `/* Publiczny profil anilista – wygenerowano ${new Date().toLocaleString('pl-PL')} */\nwindow.__PROFILE__ = ${JSON.stringify(data)};\n`;
    }

    function init() {
        U.$('gh-token').value = Store.pref(GH_TOKEN, '');
        U.$('gh-repo').value = Store.pref(GH_REPO, 'EppcPL/anilista');
        ghStatus();
        U.$('gh-save').onclick = () => {
            Store.setPref(GH_TOKEN, U.$('gh-token').value.trim());
            Store.setPref(GH_REPO, U.$('gh-repo').value.trim() || 'EppcPL/anilista');
            ghStatus();
            renderPublishInfo();
            UI.toast('Zapisano połączenie z GitHubem', 'success');
            scheduleAuto();
        };
        U.$('gh-forget').onclick = () => {
            localStorage.removeItem(GH_TOKEN);
            U.$('gh-token').value = '';
            ghStatus();
            renderPublishInfo();
            UI.toast('Token usunięty z tej przeglądarki', 'info');
        };
        U.$('pp-publish').onclick = () => publishProfile();
        U.$('pp-auto').checked = Store.pref(AUTO_KEY, 'true') !== 'false';
        U.$('pp-auto').onchange = (e) => {
            Store.setPref(AUTO_KEY, e.target.checked);
            renderPublishInfo();
            if (e.target.checked) scheduleAuto();
        };
        // zmiana ustawień profilu też się liczy jako zmiana
        ['pp-nick', 'pp-activity', 'pp-covers', 'pp-planner', 'pp-notes'].forEach(id => U.$(id).addEventListener('change', () => { ppRead(); scheduleAuto(); }));
        // przy zamykaniu karty wyślij od razu, jeśli coś czeka
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden' && autoTimer) publishProfile({ silent: true });
        });
        renderPublishInfo();
        // przy otwarciu strony nadrób zmiany z innej sesji
        if (autoOn()) setTimeout(() => publishProfile({ silent: true }), 3000);

        const pp = ppSettings();
        U.$('pp-nick').value = pp.nick;
        PP_FIELDS.forEach(f => { U.$(`pp-${f}`).checked = !!pp[f]; });
        U.$('pp-planner').addEventListener('change', (e) => { U.$('pp-notes').disabled = !e.target.checked; });
        U.$('pp-notes').disabled = !pp.planner;
        U.$('pp-export').onclick = exportProfile;

        U.$('export-btn').onclick = exportData;
        U.$('import-btn').onclick = () => U.$('import-file').click();
        U.$('import-file').onchange = (e) => {
            const file = e.target.files[0];
            e.target.value = '';
            if (file) importFile(file);
        };
        U.$('clear-btn').onclick = clearAll;
    }

    return { init, scheduleAuto };
})();
