/* =========================================================
   planner.js – lista anime do obejrzenia
   ========================================================= */
const Planner = (() => {
    const PRIORITY = { 'duży': 1, 'średni': 2, 'niski': 3 };
    let editId = null;
    let seasons;

    const el = (id) => U.$(id);

    function resetForm() {
        editId = null;
        el('planner-form').reset();
        el('planner-priority').value = 'średni';
        el('planner-total-episodes').value = 12;
        seasons.reset();
        el('planner-form-title').textContent = 'Dodaj do planera';
        el('add-to-planner').innerHTML = '<i class="fas fa-plus"></i> Dodaj do planera';
        el('planner-cancel').hidden = true;
    }

    function submit(e) {
        e.preventDefault();
        const title = el('planner-title').value.trim();
        if (!title) return UI.toast('Wpisz tytuł anime', 'warning');
        const s = seasons.read(24);
        const data = {
            title,
            priority: el('planner-priority').value,
            notes: el('planner-notes').value.trim(),
            tags: U.parseTags(el('planner-tags').value),
            seasonCount: s.count,
            seasons: s.count > 1 ? s.seasons : undefined,
            seasonEpisodeLengths: s.count > 1 ? s.seasonEpisodeLengths : undefined,
            totalEpisodes: U.int(el('planner-total-episodes').value, 12) || 12
        };
        if (editId) {
            Object.assign(Store.findPlanner(editId), data);
            UI.toast('Planer zaktualizowany', 'success');
        } else {
            Store.state.planner.push({ id: Store.newId(), createdAt: new Date().toISOString(), ...data });
            UI.toast(`„${title}” w planerze`, 'success');
        }
        Store.savePlanner();
        resetForm();
        App.refresh();
    }

    function startWatching(item) {
        const len = item.seasonEpisodeLengths && item.seasonEpisodeLengths[0] || 24;
        const ratings = { graphics: 5, music: 5, characters: 5, story: 5, fun: 5 };
        const anime = {
            id: Store.newId(),
            title: item.title,
            status: 'watching',
            totalEpisodes: item.seasons && item.seasons.length > 1 ? item.seasons.reduce((a, b) => a + b, 0) : (item.totalEpisodes || 12),
            episodeLength: len,
            watchedEpisodes: 0,
            rewatchCount: 0,
            ratings,
            averageRating: Calc.average(ratings),
            tags: item.tags || [],
            createdAt: new Date().toISOString()
        };
        if (item.seasons && item.seasons.length > 1) {
            anime.seasons = item.seasons;
            anime.seasonEpisodeLengths = item.seasonEpisodeLengths;
        }
        Store.state.anime.push(anime);
        Store.state.planner = Store.state.planner.filter(p => p !== item);
        Store.saveAnime();
        Store.savePlanner();
        App.refresh();
        UI.toast(`„${item.title}” przeniesione do oglądanych`, 'success');
    }

    function edit(item) {
        editId = item.id;
        el('planner-title').value = item.title;
        el('planner-priority').value = item.priority;
        el('planner-notes').value = item.notes || '';
        el('planner-tags').value = (item.tags || []).join('; ');
        el('planner-total-episodes').value = item.totalEpisodes || 12;
        seasons.load(item);
        el('planner-form-title').textContent = 'Edytuj pozycję';
        el('add-to-planner').innerHTML = '<i class="fas fa-floppy-disk"></i> Zapisz zmiany';
        el('planner-cancel').hidden = false;
        el('planner-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function render() {
        const box = el('planner-list');
        const list = [...Store.state.planner].sort((a, b) => (PRIORITY[a.priority] || 9) - (PRIORITY[b.priority] || 9));
        if (!list.length) {
            box.innerHTML = '<div class="empty">Planer jest pusty. Dodaj tytuł, który chcesz obejrzeć.</div>';
            return;
        }
        box.innerHTML = list.map(p => `
            <article class="planner-item prio-${p.priority === 'duży' ? 'high' : p.priority === 'niski' ? 'low' : 'mid'}" data-id="${p.id}">
                <div class="planner-main">
                    <h3>${U.esc(p.title)}</h3>
                    <p class="muted">
                        Priorytet: ${U.esc(p.priority)}
                        ${p.seasonCount > 1 ? ` · ${p.seasonCount} sezony` : ''} · ${U.eps(p.totalEpisodes || 0)}
                    </p>
                    ${p.tags && p.tags.length ? `<div class="tags">${p.tags.map(t => `<span class="tag">${U.esc(t)}</span>`).join('')}</div>` : ''}
                    ${p.notes ? `<p class="planner-notes">${U.esc(p.notes)}</p>` : ''}
                </div>
                <div class="planner-actions">
                    <button class="btn btn-accent btn-sm" data-p="start"><i class="fas fa-play"></i> Zacznij oglądać</button>
                    <button class="btn-icon" data-p="edit" title="Edytuj"><i class="fas fa-pen"></i></button>
                    <button class="btn-icon btn-danger-text" data-p="delete" title="Usuń"><i class="fas fa-trash"></i></button>
                </div>
            </article>`).join('');
    }

    function init() {
        seasons = Seasons.create(el('planner-seasons-container'), el('planner-season-count'), el('planner-total-episodes'));
        el('planner-form').addEventListener('submit', submit);
        el('planner-cancel').onclick = resetForm;
        el('planner-list').addEventListener('click', (e) => {
            const act = e.target.closest('[data-p]')?.dataset.p;
            if (!act) return;
            const item = Store.findPlanner(e.target.closest('.planner-item').dataset.id);
            if (!item) return;
            if (act === 'start') startWatching(item);
            if (act === 'edit') edit(item);
            if (act === 'delete' && confirm(`Usunąć „${item.title}” z planera?`)) {
                Store.state.planner = Store.state.planner.filter(p => p !== item);
                Store.savePlanner();
                App.refresh();
                UI.toast('Usunięto z planera', 'danger');
            }
        });
    }

    return { init, render };
})();
