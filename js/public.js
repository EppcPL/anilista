/* =========================================================
   public.js – publiczny profil (profil.html), tylko do oglądania.
   Dane pochodzą z pliku profil-dane.js (window.__PROFILE__).
   ========================================================= */
const App = (() => {
    const P = Store.profile;
    const VIEWS = ['profil', 'lista', 'tier-lista', 'planer'];

    function header() {
        const nick = P.nick || 'Profil';
        document.title = `${nick} – anilista`;
        U.$('pub-nick').textContent = nick;
        U.$('pub-avatar').textContent = nick.charAt(0).toUpperCase();
        const list = Store.state.anime;
        const done = list.filter(a => a.status === 'completed').length;
        const minutes = list.reduce((s, a) => s + Calc.totalMinutes(a), 0);
        U.$('pub-meta').innerHTML = `${list.length} anime · ${done} obejrzanych · ${Math.round(minutes / 60)} h oglądania<br>
            <small>Zaktualizowano ${U.fmtDate(new Date(P.updatedAt))}</small>`;
    }

    /** „Teraz ogląda” – pasek na górze statystyk */
    function watching() {
        const list = Store.state.anime.filter(a => a.status === 'watching')
            .sort((a, b) => (b.lastWatchedDate || '').localeCompare(a.lastWatchedDate || ''));
        const box = U.$('pub-watching');
        if (!list.length) { box.innerHTML = ''; return; }
        box.innerHTML = `
            <h2 class="view-title">Teraz ogląda</h2>
            <div class="now-row">${list.map(a => `
                <button class="now-card" data-open="${a.id}">
                    ${a.image ? `<img src="${a.image}" alt="">` : `<span class="now-letter">${U.esc(a.title.charAt(0).toUpperCase())}</span>`}
                    <span class="now-info">
                        <b>${U.esc(a.title)}</b>
                        <small>Odcinek ${a.watchedEpisodes}/${a.totalEpisodes}${a.lastWatchedDate ? ` · ${U.fmtDateRelative(a.lastWatchedDate).toLowerCase()}` : ''}</small>
                        ${UI.bar(Calc.progress(a))}
                    </span>
                </button>`).join('')}
            </div>`;
    }

    function planner() {
        const prio = { 'duży': 1, 'średni': 2, 'niski': 3 };
        const list = [...Store.state.planner].sort((a, b) => (prio[a.priority] || 9) - (prio[b.priority] || 9));
        U.$('pub-tab-planer').hidden = !list.length;
        U.$('pub-planner').innerHTML = list.length ? list.map(p => `
            <article class="planner-item prio-${p.priority === 'duży' ? 'high' : p.priority === 'niski' ? 'low' : 'mid'}">
                <div class="planner-main">
                    <h3>${U.esc(p.title)}</h3>
                    <p class="muted">Priorytet: ${U.esc(p.priority)} · ${U.eps(p.totalEpisodes || 0)}</p>
                    ${p.tags && p.tags.length ? `<div class="tags">${p.tags.map(t => `<span class="tag">${U.esc(t)}</span>`).join('')}</div>` : ''}
                    ${p.notes ? `<p class="planner-notes">${U.esc(p.notes)}</p>` : ''}
                </div>
            </article>`).join('') : '<div class="empty">Brak pozycji.</div>';
    }

    function refresh() {
        header();
        watching();
        Profile.render();
        Calendar.render();
        Collection.render();
        TierList.render();
        planner();
        const noActivity = P.options && P.options.activity === false;
        U.$('pub-calendar-block').hidden = noActivity;
        U.$('wrapped-banner').hidden = noActivity;
    }

    function show(view) {
        if (!VIEWS.includes(view)) view = 'profil';
        U.qsa('.view').forEach(v => { v.hidden = v.id !== view; });
        U.qsa('.pub-tabs a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
        window.scrollTo({ top: 0 });
    }

    function init() {
        if (!P) {
            U.qsa('.view, .pub-tabs').forEach(v => { v.hidden = true; });
            U.$('pub-missing').hidden = false;
            return;
        }
        UI.initDialogs();
        Collection.init();
        TierList.init();
        Calendar.init();
        Profile.init();
        U.$('pub-watching').addEventListener('click', (e) => {
            const open = e.target.closest('[data-open]');
            if (open) Details.open(open.dataset.open);
        });
        refresh();
        show(location.hash.slice(1));
        window.addEventListener('hashchange', () => show(location.hash.slice(1)));
    }

    document.addEventListener('DOMContentLoaded', init);
    return { refresh, show };
})();
