/* =========================================================
   store.js – dane aplikacji i zapis do localStorage.
   Klucze są takie same jak w starej wersji, więc
   istniejąca kolekcja wczytuje się bez zmian.
   ========================================================= */
const Store = (() => {
    // Publiczny profil (profil.html) wczytuje dane z pliku profil-dane.js
    // i NIGDY nie zapisuje niczego w przeglądarce odwiedzającego.
    const PUBLIC_PAGE = !!window.__PROFILE_PAGE__;
    const PUBLIC = PUBLIC_PAGE ? (window.__PROFILE__ || null) : null;
    const memoryPrefs = {};

    function read(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    }

    function write(key, value) {
        if (PUBLIC_PAGE) return true;
        try {
            localStorage.setItem(key, JSON.stringify(value));
            // publiczny profil aktualizuje się sam (data.js)
            if (typeof DataIO !== 'undefined' && DataIO.scheduleAuto) DataIO.scheduleAuto();
            return true;
        } catch (err) {
            // Najczęściej: brak miejsca (duże obrazki)
            UI.toast('Nie udało się zapisać – pamięć przeglądarki jest pełna. Usuń kilka obrazków lub wyeksportuj dane.', 'danger');
            console.error(err);
            return false;
        }
    }

    const state = PUBLIC_PAGE ? {
        anime: (PUBLIC && PUBLIC.animeList) || [],
        planner: (PUBLIC && PUBLIC.plannerList) || [],
        activity: (PUBLIC && PUBLIC.activityData) || {},
        details: (PUBLIC && PUBLIC.activityDetails) || {}
    } : {
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
        readonly: PUBLIC_PAGE,
        profile: PUBLIC,
        pref: (key, fallback = null) => PUBLIC_PAGE ? (memoryPrefs[key] ?? fallback) : (localStorage.getItem(key) ?? fallback),
        setPref: (key, value) => { if (PUBLIC_PAGE) memoryPrefs[key] = String(value); else localStorage.setItem(key, String(value)); },
        newId: () => Date.now() + Math.floor(Math.random() * 1000)
    };
})();
