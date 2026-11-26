/* =========================================================
   series.js – serie / powiązania między anime (np. całe „Fate”)

   Każde anime może mieć:
     series:      'Fate'   – nazwa serii (wielkość liter bez znaczenia)
     seriesOrder: 2        – kolejność w serii (opcjonalnie)
   Seria ma wspólne statystyki i jedną łączną ocenę.
   ========================================================= */
const Series = (() => {
    const key = (name) => String(name || '').trim().toLocaleLowerCase('pl');

    /** Wszystkie serie: Map(klucz -> { key, name, items[] }) */
    function groups() {
        const map = new Map();
        Store.state.anime.forEach(a => {
            const k = key(a.series);
            if (!k) return;
            if (!map.has(k)) map.set(k, { key: k, name: a.series.trim(), items: [] });
            map.get(k).items.push(a);
        });
        map.forEach(g => g.items.sort(byOrder));
        return map;
    }

    function byOrder(a, b) {
        const oa = a.seriesOrder || 999, ob = b.seriesOrder || 999;
        return oa - ob || (a.createdAt || '').localeCompare(b.createdAt || '') || a.title.localeCompare(b.title, 'pl');
    }

    const get = (name) => groups().get(key(name)) || null;
    const names = () => [...groups().values()].map(g => g.name).sort((a, b) => a.localeCompare(b, 'pl'));

    /** Łączne statystyki serii */
    function stats(g) {
        const rated = g.items.filter(a => a.averageRating > 0);
        const avgOf = (fn) => rated.length ? Math.round(rated.reduce((s, a) => s + fn(a), 0) / rated.length * 10) / 10 : 0;
        const ratings = {};
        Calc.RATING_KEYS.forEach(k => { ratings[k] = avgOf(a => a.ratings[k]); });
        const watched = g.items.reduce((s, a) => s + Calc.watchedCount(a), 0);
        const total = g.items.reduce((s, a) => s + (a.totalEpisodes || 0), 0);
        const best = [...rated].sort((a, b) => b.averageRating - a.averageRating)[0] || null;
        return {
            count: g.items.length,
            completed: g.items.filter(a => a.status === 'completed').length,
            watched, total,
            minutes: g.items.reduce((s, a) => s + Calc.totalMinutes(a), 0),
            average: avgOf(a => a.averageRating),
            ratings, best,
            cover: (g.items.find(a => a.image) || {}).image || null
        };
    }

    /** Plakietka na kartę anime */
    function badge(a) {
        const g = a.series ? get(a.series) : null;
        if (!g) return '';
        const pos = g.items.indexOf(a) + 1;
        return `<button class="series-badge" data-series="${U.esc(g.name)}" title="Seria: ${U.esc(g.name)} – ${pos}. z ${g.items.length}">
            <i class="fas fa-link"></i> ${U.esc(g.name)} <span>${pos}/${g.items.length}</span></button>`;
    }

    /* ---------------- okno serii ---------------- */

    function collage(g) {
        const imgs = g.items.filter(a => a.image).slice(0, 4);
        if (!imgs.length) return `<div class="series-collage is-empty"><span>${U.esc(g.name.charAt(0).toUpperCase())}</span></div>`;
        return `<div class="series-collage n${imgs.length}">${imgs.map(a => `<img src="${a.image}" alt="">`).join('')}</div>`;
    }

    function open(name) {
        const g = get(name);
        if (!g) return UI.toast('Ta seria już nie istnieje', 'warning');
        const s = stats(g);
        const ro = Store.readonly;
        const others = Store.state.anime.filter(a => key(a.series) !== g.key).sort((a, b) => a.title.localeCompare(b.title, 'pl'));

        U.$('series-modal-title').innerHTML = `<i class="fas fa-link"></i> ${U.esc(g.name)}`;
        U.$('series-modal-body').innerHTML = `
            <div class="series-hero">
                ${collage(g)}
                <div class="series-hero-info">
                    <div class="series-score"><strong>${s.average || '–'}</strong><span>ocena całej serii</span></div>
                    <div class="mini-stats">
                        <div><strong>${s.count}</strong><span>${U.plural(s.count, 'tytuł', 'tytuły', 'tytułów')}</span></div>
                        <div><strong>${s.completed}/${s.count}</strong><span>ukończone</span></div>
                        <div><strong>${s.watched}/${s.total}</strong><span>odcinki</span></div>
                        <div><strong>${U.fmtDuration(s.minutes)}</strong><span>czas oglądania</span></div>
                    </div>
                    ${UI.bar(s.total ? s.watched / s.total * 100 : 0)}
                </div>
            </div>

            <h4>Średnie oceny serii</h4>
            <div class="details-ratings">${Calc.RATING_KEYS.map(k => `
                <div class="details-rating">
                    <span>${Calc.RATING_NAMES[k]}</span>
                    ${UI.bar(s.ratings[k] / 11 * 100)}
                    <b>${s.ratings[k]}</b>
                </div>`).join('')}
            </div>

            <h4>Kolejność oglądania</h4>
            <ol class="series-list">${g.items.map((a, i) => `
                <li data-id="${a.id}">
                    <span class="rank-pos">${i + 1}</span>
                    ${a.image ? `<img class="rank-cover" src="${a.image}" alt="">` : `<span class="rank-cover rank-letter">${U.esc(a.title.charAt(0).toUpperCase())}</span>`}
                    <button class="series-item-main link" data-open="${a.id}">
                        <b>${U.esc(a.title)}</b>
                        <small>${Calc.STATUS[a.status]?.label || ''} · ${a.watchedEpisodes}/${a.totalEpisodes} odc.</small>
                    </button>
                    <b class="series-item-score">${a.averageRating}</b>
                    ${ro ? '' : `
                    <span class="series-item-actions">
                        <button class="btn-icon" data-move="-1" ${i === 0 ? 'disabled' : ''} title="Wyżej"><i class="fas fa-arrow-up"></i></button>
                        <button class="btn-icon" data-move="1" ${i === g.items.length - 1 ? 'disabled' : ''} title="Niżej"><i class="fas fa-arrow-down"></i></button>
                        <button class="btn-icon btn-danger-text" data-unlink title="Usuń z serii"><i class="fas fa-link-slash"></i></button>
                    </span>`}
                </li>`).join('')}
            </ol>

            ${ro ? '' : `
            <div class="series-add">
                <select id="series-add-select" aria-label="Anime do dodania">
                    <option value="">Dodaj anime do tej serii…</option>
                    ${others.map(a => `<option value="${a.id}">${U.esc(a.title)}${a.series ? ` (teraz: ${U.esc(a.series)})` : ''}</option>`).join('')}
                </select>
                <button class="btn btn-accent btn-sm" data-add><i class="fas fa-plus"></i> Dodaj</button>
            </div>
            <div class="form-actions">
                <button class="btn btn-ghost btn-sm" data-rename><i class="fas fa-pen"></i> Zmień nazwę serii</button>
                <button class="btn btn-ghost btn-sm btn-danger-text" data-dissolve><i class="fas fa-link-slash"></i> Rozłącz całą serię</button>
            </div>`}`;

        U.$('series-modal-body').onclick = (e) => onClick(e, g);
        UI.open('series-modal');
    }

    function save(msg, reopen) {
        Store.saveAnime();
        App.refresh();
        if (msg) UI.toast(msg, 'success');
        if (reopen && get(reopen)) open(reopen); else if (reopen) UI.close('series-modal');
    }

    /** Zapisz kolejność 1..n według aktualnej listy */
    function renumber(items) {
        items.forEach((a, i) => { a.seriesOrder = i + 1; });
    }

    function onClick(e, g) {
        const openBtn = e.target.closest('[data-open]');
        if (openBtn) { UI.close('series-modal'); return Details.open(openBtn.dataset.open); }
        const li = e.target.closest('li[data-id]');
        const items = [...g.items];

        const move = e.target.closest('[data-move]');
        if (move && li) {
            const i = items.findIndex(a => U.sameId(a.id, li.dataset.id));
            const j = i + U.int(move.dataset.move);
            if (j < 0 || j >= items.length) return;
            [items[i], items[j]] = [items[j], items[i]];
            renumber(items);
            return save(null, g.name);
        }
        if (e.target.closest('[data-unlink]') && li) {
            const a = Store.find(li.dataset.id);
            delete a.series; delete a.seriesOrder;
            renumber(items.filter(x => x !== a));
            return save(`„${a.title}” usunięte z serii`, g.name);
        }
        if (e.target.closest('[data-add]')) {
            const id = U.$('series-add-select').value;
            if (!id) return UI.toast('Wybierz anime z listy', 'warning');
            const a = Store.find(id);
            a.series = g.name;
            a.seriesOrder = items.length + 1;
            return save(`Dodano „${a.title}” do serii ${g.name}`, g.name);
        }
        if (e.target.closest('[data-rename]')) {
            const name = prompt('Nowa nazwa serii:', g.name);
            if (!name || !name.trim()) return;
            items.forEach(a => { a.series = name.trim(); });
            return save('Nazwa serii zmieniona', name.trim());
        }
        if (e.target.closest('[data-dissolve]')) {
            if (!confirm(`Rozłączyć serię „${g.name}”? Anime zostaną w kolekcji, znikną tylko powiązania.`)) return;
            items.forEach(a => { delete a.series; delete a.seriesOrder; });
            return save('Seria rozłączona', null);
        }
    }

    /* ---------------- szybkie łączenie z okna szczegółów ---------------- */

    function openPicker(animeId) {
        const a = Store.find(animeId);
        if (!a) return;
        const list = names();
        U.$('series-modal-title').innerHTML = `<i class="fas fa-link"></i> Seria dla „${U.esc(a.title)}”`;
        U.$('series-modal-body').innerHTML = `
            <p class="muted">Połącz anime w serię, np. wszystkie części „Fate”. Seria dostanie wspólne statystyki i łączną ocenę.</p>
            ${list.length ? `<div class="chips">${list.map(n => `<button class="chip ${key(n) === key(a.series) ? 'active' : ''}" data-pick="${U.esc(n)}">${U.esc(n)}</button>`).join('')}</div>` : ''}
            <div class="row-2">
                <div class="field">
                    <label for="series-pick-name">Nazwa serii</label>
                    <input type="text" id="series-pick-name" value="${U.esc(a.series || '')}" placeholder="np. Fate" list="series-names">
                </div>
                <div class="field">
                    <label for="series-pick-order">Kolejność <small>opcjonalnie</small></label>
                    <input type="number" id="series-pick-order" min="1" value="${a.seriesOrder || ''}">
                </div>
            </div>
            <div class="form-actions">
                <button class="btn btn-accent" data-pick-save><i class="fas fa-link"></i> Zapisz</button>
                ${a.series ? '<button class="btn btn-ghost btn-danger-text" data-pick-remove><i class="fas fa-link-slash"></i> Usuń z serii</button>' : ''}
            </div>`;
        U.$('series-modal-body').onclick = (e) => {
            const chip = e.target.closest('[data-pick]');
            if (chip) { U.$('series-pick-name').value = chip.dataset.pick; return; }
            if (e.target.closest('[data-pick-save]')) {
                const name = U.$('series-pick-name').value.trim();
                if (!name) return UI.toast('Wpisz nazwę serii', 'warning');
                const existing = get(name);
                a.series = existing ? existing.name : name;
                a.seriesOrder = U.int(U.$('series-pick-order').value) || (existing ? existing.items.filter(x => x !== a).length + 1 : 1);
                return save(`„${a.title}” w serii ${a.series}`, a.series);
            }
            if (e.target.closest('[data-pick-remove]')) {
                delete a.series; delete a.seriesOrder;
                save('Usunięto z serii', null);
            }
        };
        UI.open('series-modal');
    }

    /* ---------------- karty serii (kolekcja) ---------------- */

    function cardsHTML() {
        const list = [...groups().values()].map(g => ({ g, s: stats(g) })).sort((x, y) => y.s.average - x.s.average);
        if (!list.length) {
            return `<div class="empty">Nie masz jeszcze żadnych serii. Otwórz anime, kliknij <b>„Seria”</b> i wpisz nazwę, np. „Fate” – potem dodaj do niej kolejne części.</div>`;
        }
        return list.map(({ g, s }) => `
            <article class="series-card" data-series="${U.esc(g.name)}" tabindex="0">
                ${collage(g)}
                <span class="card-score">${s.average || '–'}</span>
                <div class="series-card-body">
                    <h3>${U.esc(g.name)}</h3>
                    <p class="muted">${s.count} ${U.plural(s.count, 'tytuł', 'tytuły', 'tytułów')} · ${s.completed} ukończone · ${U.fmtHours(s.minutes)}</p>
                    ${UI.bar(s.total ? s.watched / s.total * 100 : 0)}
                    <ul class="series-mini">${g.items.slice(0, 4).map(a => `<li><span>${U.esc(a.title)}</span><b>${a.averageRating}</b></li>`).join('')}
                        ${g.items.length > 4 ? `<li class="muted">i ${g.items.length - 4} więcej…</li>` : ''}
                    </ul>
                </div>
            </article>`).join('');
    }

    /** Lista podpowiedzi nazw w polach tekstowych */
    function renderDatalist() {
        let dl = U.$('series-names');
        if (!dl) {
            dl = document.createElement('datalist');
            dl.id = 'series-names';
            document.body.appendChild(dl);
        }
        dl.innerHTML = names().map(n => `<option value="${U.esc(n)}">`).join('');
    }

    function init() {
        // klik w plakietkę serii gdziekolwiek na stronie
        document.addEventListener('click', (e) => {
            const b = e.target.closest('[data-series]');
            if (!b || e.target.closest('#series-modal')) return;
            e.preventDefault();
            e.stopPropagation();
            if (b.closest('dialog')) UI.close(b.closest('dialog').id);
            open(b.dataset.series);
        }, true);
        document.addEventListener('keydown', (e) => {
            const card = e.target.closest && e.target.closest('.series-card');
            if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(card.dataset.series); }
        });
        renderDatalist();
    }

    return { key, groups, get, names, stats, badge, open, openPicker, cardsHTML, renderDatalist, init };
})();
