/* =========================================================
   profile.js – kafelki statystyk, szczegółowe tabele, tagi
   ========================================================= */
const Profile = (() => {
    const sortStates = {};
    const sortState = (key, by, dir) => (sortStates[key] = sortStates[key] || { by, dir });

    const titleCol = { key: 'title', label: 'Tytuł', sort: r => r.title, html: r => `<button class="link" data-open="${r.id}">${U.esc(r.title)}</button>` };
    const statusCol = { key: 'status', label: 'Status', sort: r => ({ watching: 1, completed: 2, upcoming: 3 })[r.status] || 9, html: r => UI.statusChip(r.status) };
    const avgCol = { key: 'avg', label: 'Średnia', sort: r => r.averageRating, html: r => `<b>${r.averageRating}</b>` };

    function renderStats() {
        const list = Store.state.anime;
        const rated = list.filter(a => a.averageRating > 0);
        const avg = rated.length ? rated.reduce((s, a) => s + a.averageRating, 0) / rated.length : 0;
        const total = list.reduce((s, a) => s + a.totalEpisodes, 0);
        const watched = list.reduce((s, a) => s + Calc.watchedCount(a), 0);
        const progress = total ? Math.round(watched / total * 100) : 0;
        const minutes = list.reduce((s, a) => s + Calc.totalMinutes(a), 0);
        const streak = Calc.currentStreak();
        const longest = Calc.longestStreak();
        const count = (st) => list.filter(a => a.status === st).length;

        const tiles = [
            { key: 'time', icon: 'fa-clock', label: 'Czas oglądania', value: U.fmtHours(minutes, Store.pref('timeFormat', 'hours')), sub: `${U.fmtDuration(minutes)} · ${list.length} anime w kolekcji`, wide: true },
            { key: 'rating', icon: 'fa-star', label: 'Średnia ocena', value: avg.toFixed(1), bar: avg / 11 * 100 },
            { key: 'progress', icon: 'fa-list-check', label: 'Postęp', value: `${progress}%`, bar: progress },
            { key: 'streak', icon: 'fa-fire', label: 'Streak', value: U.days(streak), sub: `rekord: ${U.days(longest.length)}`,
              title: longest.start ? `Najdłuższy: ${U.fmtDate(longest.start)} – ${U.fmtDate(longest.end)}` : '' },
            { key: 'watching', icon: 'fa-eye', label: 'Oglądane', value: count('watching') },
            { key: 'completed', icon: 'fa-circle-check', label: 'Obejrzane', value: count('completed') },
            { key: 'upcoming', icon: 'fa-bookmark', label: 'W planerze', value: Store.state.planner.length }
        ];

        U.$('profile-stats').innerHTML = tiles.map(t => `
            <button class="stat ${t.wide ? 'stat-wide' : ''}" data-stat="${t.key}" ${t.title ? `title="${t.title}"` : ''}>
                <span class="stat-label"><i class="fas ${t.icon}"></i> ${t.label}</span>
                <strong class="stat-value">${t.value}</strong>
                ${t.sub ? `<span class="stat-sub">${t.sub}</span>` : ''}
                ${t.bar !== undefined ? UI.bar(t.bar) : ''}
            </button>`).join('');
    }

    /* ---------- panele ---------- */

    function listPanel(type) {
        const labels = { completed: 'Obejrzane', watching: 'Oglądane', all: 'Wszystkie anime' };
        if (type === 'upcoming') {
            const rows = Store.state.planner;
            const prio = { 'duży': 1, 'średni': 2, 'niski': 3 };
            return UI.showPanel('Planowane', '<div data-t></div>', p => UI.sortableTable(p.querySelector('[data-t]'), {
                rows,
                state: sortState('upcoming', 'prio', 'asc'),
                columns: [
                    { key: 'title', label: 'Tytuł', sort: r => r.title, html: r => U.esc(r.title) },
                    { key: 'prio', label: 'Priorytet', sort: r => prio[r.priority] || 9, html: r => U.esc(r.priority) },
                    { key: 'notes', label: 'Notatki', html: r => `<span class="muted">${U.esc(r.notes || '–')}</span>` }
                ]
            }));
        }
        const rows = type === 'all' ? Store.state.anime : Store.state.anime.filter(a => a.status === type);
        const cols = [titleCol, statusCol, avgCol];
        if (type === 'completed') cols.push({ key: 'done', label: 'Ukończono', sort: r => r.completedDate || '', html: r => r.completedDate ? U.fmtDate(r.completedDate) : '<span class="muted">brak daty</span>' });
        UI.showPanel(labels[type], rows.length ? '<div data-t></div>' : '<div class="empty">Brak anime w tej kategorii.</div>',
            p => rows.length && UI.sortableTable(p.querySelector('[data-t]'), { rows, columns: cols, state: sortState(type, 'title', 'asc') }));
    }

    function ratingPanel() {
        const rated = Store.state.anime.filter(a => a.averageRating > 0);
        if (!rated.length) return UI.showPanel('Oceny', '<div class="empty">Brak ocenionych anime.</div>');
        const rows = Calc.RATING_KEYS.map(k => {
            const avg = rated.reduce((s, a) => s + a.ratings[k], 0) / rated.length;
            const best = rated.reduce((b, a) => a.ratings[k] > b.ratings[k] ? a : b);
            return { k, avg, best };
        }).sort((a, b) => b.avg - a.avg);
        UI.showPanel('Oceny według kategorii', `
            <div class="rating-overview">${rows.map(r => `
                <div class="ro-row">
                    <span>${Calc.RATING_NAMES[r.k]}</span>
                    ${UI.bar(r.avg / 11 * 100)}
                    <b>${r.avg.toFixed(2)}</b>
                    <span class="muted">najlepsze: <button class="link" data-open="${r.best.id}">${U.esc(r.best.title)}</button> (${r.best.ratings[r.k]})</span>
                </div>`).join('')}
            </div>`);
    }

    function progressPanel() {
        const rows = Store.state.anime;
        UI.showPanel('Postęp oglądania', '<div data-t></div>', p => UI.sortableTable(p.querySelector('[data-t]'), {
            rows,
            state: sortState('progress', 'progress', 'desc'),
            columns: [titleCol, statusCol,
                { key: 'eps', label: 'Odcinki', sort: r => r.watchedEpisodes, html: r => `${r.watchedEpisodes}/${r.totalEpisodes}` },
                { key: 'progress', label: 'Postęp', sort: r => Calc.progress(r), html: r => `<div class="cell-bar">${UI.bar(Calc.progress(r))}<span>${Calc.progress(r)}%</span></div>` }]
        }));
    }

    function timePanel() {
        const rows = Store.state.anime;
        const sum = rows.reduce((s, a) => s + Calc.totalMinutes(a), 0) || 1;
        const formats = [['hours', 'godziny'], ['days', 'dni'], ['months', 'miesiące'], ['years', 'lata']];
        const current = Store.pref('timeFormat', 'hours');
        UI.showPanel('Czas oglądania', `
            <div class="chips" data-format>${formats.map(([f, l]) => `<button class="chip ${f === current ? 'active' : ''}" data-f="${f}">Pokazuj w: ${l}</button>`).join('')}</div>
            <div data-t></div>`, p => {
            p.querySelector('[data-format]').onclick = (e) => {
                const f = e.target.closest('[data-f]')?.dataset.f;
                if (!f) return;
                Store.setPref('timeFormat', f);
                renderStats();
                timePanel();
            };
            UI.sortableTable(p.querySelector('[data-t]'), {
                rows,
                state: sortState('time', 'total', 'desc'),
                columns: [titleCol, statusCol,
                    { key: 'total', label: 'Obejrzany czas', sort: r => Calc.totalMinutes(r), html: r => `${U.fmtDuration(Calc.totalMinutes(r))}${Calc.rewatchMinutes(r) ? ` <small class="muted">(+${U.fmtDuration(Calc.rewatchMinutes(r))} powt.)</small>` : ''}` },
                    { key: 'full', label: 'Pełna długość', sort: r => Calc.fullMinutes(r), html: r => U.fmtDuration(Calc.fullMinutes(r)) },
                    { key: 'share', label: '% całości', sort: r => Calc.totalMinutes(r), html: r => `${(Calc.totalMinutes(r) / sum * 100).toFixed(1)}%` }]
            });
        });
    }

    /* ---------- tagi ---------- */

    function renderTags() {
        const map = {};
        Store.state.anime.forEach(a => {
            // każdy tag liczony raz na anime, bez względu na wielkość liter
            new Set(a.tags.map(U.tagKey)).forEach(k => {
                const shown = a.tags.find(t => U.tagKey(t) === k);
                map[k] = map[k] || { tag: shown, count: 0, minutes: 0, ratings: [] };
                map[k].count++;
                map[k].minutes += Calc.totalMinutes(a);
                map[k].ratings.push(a.averageRating);
            });
        });
        const rows = Object.values(map).map(r => ({ ...r, avg: r.ratings.reduce((s, x) => s + x, 0) / r.ratings.length }));
        const box = U.$('profile-tags-stats');
        if (!rows.length) {
            box.innerHTML = '<h3><i class="fas fa-tags"></i> Tagi</h3><div class="empty">Dodaj tagi do anime, żeby zobaczyć tu statystyki.</div>';
            return;
        }
        box.innerHTML = '<h3><i class="fas fa-tags"></i> Tagi</h3><div data-t></div>';
        UI.sortableTable(box.querySelector('[data-t]'), {
            rows,
            state: sortState('tags', 'count', 'desc'),
            columns: [
                { key: 'tag', label: 'Tag', sort: r => r.tag, html: r => `<button class="tag" data-tag="${U.esc(r.tag)}">${U.esc(r.tag)}</button>` },
                { key: 'count', label: 'Anime', sort: r => r.count, html: r => r.count },
                { key: 'minutes', label: 'Czas', sort: r => r.minutes, html: r => U.fmtDuration(r.minutes) },
                { key: 'avg', label: 'Średnia', sort: r => r.avg, html: r => r.avg.toFixed(2) }
            ]
        });
    }

    function render() {
        renderStats();
        renderTags();
    }

    function init() {
        U.$('profile-stats').addEventListener('click', (e) => {
            const key = e.target.closest('[data-stat]')?.dataset.stat;
            if (!key) return;
            if (key === 'rating') ratingPanel();
            else if (key === 'time') timePanel();
            else if (key === 'progress') progressPanel();
            else if (key === 'streak') {
                const l = Calc.longestStreak();
                UI.showPanel('Streak', `<p>Obecny streak: <b>${U.days(Calc.currentStreak())}</b>. Najdłuższy: <b>${U.days(l.length)}</b>${l.start ? ` (${U.fmtDate(l.start)} – ${U.fmtDate(l.end)})` : ''}.</p><p class="muted">Streak to kolejne dni, w których dodałeś choć jeden odcinek.</p>`);
            } else listPanel(key);
        });
        U.$('profil').addEventListener('click', (e) => {
            const open = e.target.closest('[data-open]');
            if (open) return Details.open(open.dataset.open);
            const tag = e.target.closest('[data-tag]');
            if (tag) Collection.searchTag(tag.dataset.tag);
        });
    }

    return { init, render };
})();
