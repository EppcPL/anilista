/* =========================================================
   collection.js – lista anime: szukanie, sortowanie, filtry, karty
   ========================================================= */
const Collection = (() => {
    const PAGE = 12;
    const view = { sort: 'title', search: '', status: 'all', shown: PAGE };

    function filtered() {
        let list = [...Store.state.anime];
        if (view.status === 'airing') list = list.filter(a => a.airing && a.status !== 'completed');
        else if (view.status !== 'all') list = list.filter(a => a.status === view.status);

        const q = view.search.trim().toLowerCase();
        if (q) {
            const tagQ = q.match(/^tag:(.+)$/);
            list = tagQ
                ? list.filter(a => a.tags.some(t => t.toLowerCase().includes(tagQ[1].trim())))
                : list.filter(a => a.title.toLowerCase().includes(q) || a.tags.some(t => t.toLowerCase().includes(q)));
        }

        const byTitle = (a, b) => a.title.localeCompare(b.title, 'pl');
        switch (view.sort) {
            case 'averageRating': list.sort((a, b) => b.averageRating - a.averageRating || byTitle(a, b)); break;
            case 'lastWatched': list.sort((a, b) => (b.lastWatchedDate || '').localeCompare(a.lastWatchedDate || '') || byTitle(a, b)); break;
            case 'title': list.sort(byTitle); break;
            default: list.sort((a, b) => b.ratings[view.sort] - a.ratings[view.sort] || byTitle(a, b));
        }
        return list;
    }

    function card(a) {
        const progress = Calc.progress(a);
        const main = Calc.mainMinutes(a);
        const rewatch = Calc.rewatchMinutes(a);
        const seasons = Calc.multiSeason(a) ? Calc.seasonBreakdown(a) : [];

        return `
        <article class="anime-card is-${U.esc(a.status)}" data-id="${a.id}">
            <button class="card-cover" data-act="details" aria-label="Szczegóły: ${U.esc(a.title)}">
                ${a.image ? `<img src="${a.image}" alt="" loading="lazy">` : `<span class="cover-letter">${U.esc(a.title.charAt(0).toUpperCase())}</span>`}
                <span class="card-score" title="Średnia ocena">${a.averageRating}</span>
            </button>
            <div class="card-body">
                <div class="card-top">
                    ${UI.statusChip(a.status)}
                    ${Airing.badge(a)}
                </div>
                <h3 class="card-title"><button class="link" data-act="details">${U.esc(a.title)}</button></h3>
                ${a.tags.length ? `<div class="tags">${a.tags.map(t => `<span class="tag">${U.esc(t)}</span>`).join('')}</div>` : ''}

                <div class="card-progress">
                    <div class="card-progress-line">
                        <span>${a.watchedEpisodes}/${a.totalEpisodes} odc.</span>
                        <span title="Pierwsze oglądanie: ${U.fmtDuration(main)}${rewatch ? `, powtórki: ${U.fmtDuration(rewatch)}` : ''}">
                            <i class="far fa-clock"></i> ${U.fmtHours(main + rewatch)}
                        </span>
                    </div>
                    ${UI.bar(progress)}
                </div>

                ${seasons.length ? `
                <details class="card-seasons">
                    <summary>${seasons.length} ${U.plural(seasons.length, 'sezon', 'sezony', 'sezonów')}</summary>
                    <ul>${seasons.map(s => `
                        <li>
                            <span>S${s.index + 1}</span>
                            <span>${s.watched}/${s.count} · ${s.length} min${s.rewatch ? ` · ${s.rewatch}× powtórka` : ''}</span>
                            ${s.completedDate ? `<span class="ok"><i class="fas fa-check"></i> ${U.fmtDateRelative(s.completedDate)}</span>` : s.done ? '<span class="ok"><i class="fas fa-check"></i></span>' : ''}
                        </li>`).join('')}
                    </ul>
                </details>` : ''}

                <dl class="mini-ratings">
                    ${Calc.RATING_KEYS.map(k => `
                    <div title="${Calc.RATING_NAMES[k]}: ${a.ratings[k]}/11">
                        <dt>${Calc.RATING_NAMES[k]}</dt>
                        <dd>${UI.bar(a.ratings[k] / 11 * 100, 'bar-thin')}<span>${a.ratings[k]}</span></dd>
                    </div>`).join('')}
                </dl>

                ${a.completedDate || a.lastWatchedDate ? `
                <p class="card-dates">
                    ${a.completedDate ? `<span><i class="fas fa-flag-checkered"></i> ${U.fmtDateRelative(a.completedDate)}</span>` : ''}
                    ${a.lastWatchedDate ? `<span><i class="fas fa-eye"></i> ${U.fmtDateRelative(a.lastWatchedDate)}</span>` : ''}
                </p>` : ''}

                <div class="card-actions">
                    <button class="btn btn-accent btn-sm" data-act="episodes" title="Dodaj obejrzane odcinki"><i class="fas fa-plus"></i> Odcinki</button>
                    <button class="btn-icon" data-act="airing" title="Harmonogram emisji"><i class="fas fa-calendar-plus"></i></button>
                    <button class="btn-icon" data-act="edit" title="Edytuj"><i class="fas fa-pen"></i></button>
                    <button class="btn-icon btn-danger-text" data-act="delete" title="Usuń"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </article>`;
    }

    function render() {
        const box = U.$('anime-list');
        const list = filtered();
        const controls = U.$('collection-controls');
        if (!list.length) {
            box.innerHTML = `<div class="empty">${Store.state.anime.length
                ? 'Nic nie pasuje do wyszukiwania. Spróbuj innego hasła lub filtra.'
                : 'Kolekcja jest pusta. <a href="#dodaj">Dodaj pierwsze anime</a>.'}</div>`;
            controls.innerHTML = '';
            return;
        }
        box.innerHTML = list.slice(0, view.shown).map(card).join('');
        const rest = list.length - view.shown;
        controls.innerHTML = rest > 0
            ? `<button class="btn btn-ghost" id="load-more-btn">Pokaż więcej (${rest})</button>`
            : '';
        const more = U.$('load-more-btn');
        if (more) more.onclick = () => { view.shown += PAGE; render(); };
    }

    function remove(id) {
        const a = Store.find(id);
        if (!a || !confirm(`Usunąć „${a.title}” z kolekcji?`)) return;
        Store.state.anime = Store.state.anime.filter(x => !U.sameId(x.id, id));
        Store.saveAnime();
        App.refresh();
        UI.toast('Anime usunięte', 'danger');
    }

    function init() {
        U.$('search-input').addEventListener('input', (e) => { view.search = e.target.value; view.shown = PAGE; render(); });
        U.$('sort-select').addEventListener('change', (e) => { view.sort = e.target.value; view.shown = PAGE; render(); });
        U.$('status-filter').addEventListener('click', (e) => {
            const chip = e.target.closest('[data-status]');
            if (!chip) return;
            U.qsa('#status-filter .chip').forEach(c => c.classList.toggle('active', c === chip));
            view.status = chip.dataset.status;
            view.shown = PAGE;
            render();
        });
        // Jeden nasłuch dla wszystkich kart
        U.$('anime-list').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-act]');
            if (!btn) return;
            const id = btn.closest('.anime-card').dataset.id;
            switch (btn.dataset.act) {
                case 'details': Details.open(id); break;
                case 'episodes': Episodes.openModal(id); break;
                case 'airing': Airing.openEditor(id); break;
                case 'edit': AnimeForm.openEdit(id); break;
                case 'delete': remove(id); break;
            }
        });
    }

    /** Ustaw wyszukiwanie z zewnątrz (np. klik w tag) */
    function searchTag(tag) {
        view.search = `tag:${tag}`;
        view.status = 'all';
        U.$('search-input').value = view.search;
        U.qsa('#status-filter .chip').forEach(c => c.classList.toggle('active', c.dataset.status === 'all'));
        location.hash = '#lista';
        render();
    }

    return { init, render, searchTag };
})();
