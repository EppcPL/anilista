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

    function exportProfile() {
        const data = buildProfile(ppRead());
        const text = `/* Publiczny profil anilista – wygenerowano ${new Date().toLocaleString('pl-PL')} */\nwindow.__PROFILE__ = ${JSON.stringify(data)};\n`;
        const blob = new Blob([text], { type: 'text/javascript' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'profil-dane.js';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        U.$('pp-size').textContent = `Rozmiar pliku: ${(blob.size / 1024 / 1024).toFixed(2)} MB. Wgraj go do repo (Add file → Upload files), a po minucie profil będzie widoczny.`;
        UI.toast('Pobrano profil-dane.js', 'success');
    }

    function init() {
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

    return { init };
})();
