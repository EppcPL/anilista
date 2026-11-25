/* =========================================================
   main.js – start aplikacji, przełączanie widoków, odświeżanie
   ========================================================= */
const App = (() => {
    const VIEWS = ['start', 'profil', 'lista', 'dodaj', 'tier-lista', 'planer', 'eksport'];

    /** Przerysuj wszystko, co zależy od danych */
    function refresh() {
        Airing.render();
        Profile.render();
        Calendar.render();
        Collection.render();
        TierList.render();
        Planner.render();
        Transfer.renderBox();
    }

    function show(view) {
        if (!VIEWS.includes(view)) view = defaultView();
        FX.switchView(() => {
            U.qsa('.view').forEach(v => { v.hidden = v.id !== view; });
            U.qsa('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
            window.scrollTo({ top: 0, behavior: 'instant' });
        }, () => U.$(view));
    }

    /** Start: emisje, jeśli coś jest śledzone; inaczej kolekcja */
    function defaultView() {
        return Store.state.anime.some(a => a.airing) ? 'start' : (Store.state.anime.length ? 'lista' : 'dodaj');
    }

    function init() {
        FX.init();
        UI.initDialogs();
        Episodes.init();
        AnimeForm.init();
        Collection.init();
        TierList.init();
        Planner.init();
        Calendar.init();
        Profile.init();
        Transfer.init();
        DataIO.init();
        Airing.init();

        refresh();
        show(location.hash.slice(1));
        window.addEventListener('hashchange', () => show(location.hash.slice(1)));

        const fab = U.$('scroll-top-btn');
        window.addEventListener('scroll', () => { fab.hidden = window.scrollY < 400; }, { passive: true });
        fab.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.addEventListener('DOMContentLoaded', init);
    return { refresh, show };
})();
