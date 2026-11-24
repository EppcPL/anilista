/* =========================================================
   store.js – dane aplikacji i zapis do localStorage.
   Klucze są takie same jak w starej wersji, więc
   istniejąca kolekcja wczytuje się bez zmian.
   ========================================================= */
const Store = (() => {
    function read(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    }

    function write(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (err) {
            // Najczęściej: brak miejsca (duże obrazki)
            UI.toast('Nie udało się zapisać – pamięć przeglądarki jest pełna. Usuń kilka obrazków lub wyeksportuj dane.', 'danger');
            console.error(err);
            return false;
        }
    }

    const state = {
        anime: read('animeList', []),
        planner: read('plannerList', []),
        activity: read('activityData', {}),
        details: read('activityDetails', {})
    };

    // Uzupełnij brakujące pola w starszych wpisach
    state.anime.forEach(a => {
        a.ratings = a.ratings || { graphics: 5, music: 5, characters: 5, story: 5, fun: 5 };
        a.tags = Array.isArray(a.tags) ? a.tags : [];
        a.watchedEpisodes = Number(a.watchedEpisodes) || 0;
        a.totalEpisodes = Number(a.totalEpisodes) || 0;
        a.episodeLength = Number(a.episodeLength) || 24;
    });

    return {
        state,
        saveAnime: () => write('animeList', state.anime),
        savePlanner: () => write('plannerList', state.planner),
        saveActivity: () => write('activityData', state.activity) && write('activityDetails', state.details),
        saveAll() {
            this.saveAnime(); this.savePlanner(); this.saveActivity();
        },
        find: (id) => state.anime.find(a => U.sameId(a.id, id)),
        findPlanner: (id) => state.planner.find(p => U.sameId(p.id, id)),
        pref: (key, fallback = null) => localStorage.getItem(key) ?? fallback,
        setPref: (key, value) => localStorage.setItem(key, String(value)),
        newId: () => Date.now() + Math.floor(Math.random() * 1000)
    };
})();
