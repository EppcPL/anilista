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

    function init() {
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
