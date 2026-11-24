/* =========================================================
   episodes.js – dodawanie obejrzanych odcinków i aktywność
   ========================================================= */
const Episodes = (() => {
    let currentId = null;

    /** Zapisz aktywność w kalendarzu */
    function addActivity(date, count, animeId) {
        const { activity, details } = Store.state;
        activity[date] = (activity[date] || 0) + count;
        details[date] = details[date] || [];
        const anime = animeId != null ? Store.find(animeId) : null;
        details[date].push(anime
            ? { animeId: anime.id, title: anime.title, episodes: count }
            : { animeId: null, title: 'Dodane ręcznie', episodes: count });
        Store.saveActivity();
    }

    /**
     * Dodaje odcinki do anime (lub jako powtórkę, jeśli anime było już skończone).
     * activityOnly = tylko wpis w kalendarzu, bez zmiany postępu.
     */
    function add(animeId, count, date, activityOnly = false) {
        const anime = Store.find(animeId);
        addActivity(date, count, animeId);

        if (anime) {
            if (!anime.lastWatchedDate || date >= anime.lastWatchedDate) anime.lastWatchedDate = date;
            if (!activityOnly) {
                if (Calc.isComplete(anime)) {
                    anime.rewatchCount = (anime.rewatchCount || 0) + count;
                } else {
                    anime.watchedEpisodes = Math.min(anime.totalEpisodes || Infinity, anime.watchedEpisodes + count);
                    if (anime.status === 'upcoming') anime.status = 'watching';
                    if (Calc.isComplete(anime) && anime.status === 'watching') {
                        anime.status = 'completed';
                        UI.toast(`Ukończono „${anime.title}”!`, 'success');
                    }
                }
            }
            Store.saveAnime();
        }
        App.refresh();
        UI.toast(activityOnly ? 'Aktywność dodana' : `Dodano ${U.eps(count)}`, 'success');
    }

    function openModal(animeId) {
        currentId = animeId;
        const anime = Store.find(animeId);
        U.$('episode-modal-title').textContent = anime ? anime.title : 'Dodaj odcinki';
        U.$('episode-date').value = U.todayKey();
        U.$('episode-count').textContent = '1';
        U.$('activity-only').checked = false;
        UI.open('episode-modal');
    }

    function init() {
        const countEl = U.$('episode-count');
        U.$('episode-decrease').onclick = () => { countEl.textContent = Math.max(1, U.int(countEl.textContent) - 1); };
        U.$('episode-increase').onclick = () => { countEl.textContent = U.int(countEl.textContent) + 1; };
        U.$('add-episode-btn').onclick = () => {
            const date = U.$('episode-date').value;
            if (!date) return UI.toast('Wybierz datę', 'warning');
            add(currentId, U.int(countEl.textContent, 1), date, U.$('activity-only').checked);
            UI.close('episode-modal');
        };
    }

    return { add, openModal, init };
})();
