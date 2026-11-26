/* =========================================================
   details.js – okno ze szczegółami jednego anime
   ========================================================= */
const Details = (() => {
    function ratingColor(r) {
        if (r >= 11) return 'var(--gold)';
        if (r >= 9) return 'var(--ok)';
        if (r >= 7) return '#9be28f';
        if (r >= 5) return 'var(--onair)';
        if (r >= 3) return '#ff9a5c';
        return 'var(--danger)';
    }

    /** Powiązane anime z tej samej serii */
    function seriesBlock(a) {
        const g = a.series ? Series.get(a.series) : null;
        if (!g) return '';
        const s = Series.stats(g);
        return `
            <div class="details-series">
                <div class="details-series-head">
                    <h4><i class="fas fa-link"></i> Seria: ${U.esc(g.name)}</h4>
                    <button class="btn btn-ghost btn-sm" data-series="${U.esc(g.name)}">Cała seria · ocena ${s.average}</button>
                </div>
                <div class="related">${g.items.map((x, i) => `
                    <button class="related-item ${x === a ? 'is-current' : ''}" ${x === a ? 'disabled' : `data-related="${x.id}"`}>
                        ${x.image ? `<img src="${x.image}" alt="">` : `<span class="rank-letter">${U.esc(x.title.charAt(0).toUpperCase())}</span>`}
                        <span><small>${i + 1}.</small> ${U.esc(x.title)}</span>
                        <b>${x.averageRating}</b>
                    </button>`).join('')}
                </div>
            </div>`;
    }

    function open(id) {
        const a = Store.find(id);
        if (!a) return;
        U.$('anime-details-modal-title').textContent = a.title;
        const main = Calc.mainMinutes(a);
        const rewatch = Calc.rewatchMinutes(a);
        const air = Airing.info(a);
        const seasons = Calc.multiSeason(a) ? Calc.seasonBreakdown(a) : [];

        U.$('anime-details-content').innerHTML = `
            <div class="details">
                ${a.image ? `<img class="details-cover" src="${a.image}" alt="">` : ''}
                <div class="details-meta">
                    <div class="card-top">${UI.statusChip(a.status)} ${Airing.badge(a)}</div>
                    <div class="mini-stats">
                        <div><strong>${a.watchedEpisodes}/${a.totalEpisodes}</strong><span>odcinki (${Calc.progress(a)}%)</span></div>
                        <div><strong>${U.fmtDuration(main + rewatch)}</strong><span>czas${rewatch ? `, w tym powtórki ${U.fmtDuration(rewatch)}` : ''}</span></div>
                        <div><strong style="color:${ratingColor(a.averageRating)}">${a.averageRating}</strong><span>średnia / 11</span></div>
                    </div>
                    ${a.tags.length ? `<div class="tags">${a.tags.map(t => `<button class="tag" data-tag="${U.esc(t)}">${U.esc(t)}</button>`).join('')}</div>` : ''}
                </div>
            </div>

            <div class="details-ratings">
                ${Calc.RATING_KEYS.map(k => `
                <div class="details-rating">
                    <span>${Calc.RATING_NAMES[k]}</span>
                    <div class="bar"><span style="width:${a.ratings[k] / 11 * 100}%;background:${ratingColor(a.ratings[k])}"></span></div>
                    <b style="color:${ratingColor(a.ratings[k])}">${a.ratings[k]}</b>
                </div>`).join('')}
            </div>

            ${seasons.length ? `
            <h4>Sezony</h4>
            <ul class="season-list">${seasons.map(s => `
                <li>Sezon ${s.index + 1}: ${s.watched}/${s.count} odc. · ${s.length} min${s.rewatch ? ` · ${s.rewatch}× powtórka` : ''}${s.completedDate ? ` · ukończono ${U.fmtDate(s.completedDate)}` : ''}</li>`).join('')}
            </ul>` : ''}

            ${seriesBlock(a)}

            ${air ? `
            <h4>Emisja</h4>
            <p>Wydane: <b>${air.aired}</b>${air.next ? ` · odcinek ${air.next.ep}: ${Airing.relTime(air.next.at)}` : ''}${air.behind ? ` · <b class="warn">zaległe: ${air.behind}</b>` : ''}</p>` : ''}

            <p class="muted">
                ${a.completedDate ? `<i class="fas fa-flag-checkered"></i> Ukończono ${U.fmtDate(a.completedDate)}<br>` : ''}
                ${a.lastWatchedDate ? `<i class="fas fa-eye"></i> Ostatnio oglądane ${U.fmtDate(a.lastWatchedDate)}` : ''}
            </p>

            <div class="form-actions">
                <button class="btn btn-accent" data-d="episodes"><i class="fas fa-plus"></i> Dodaj odcinki</button>
                <button class="btn btn-ghost" data-d="airing"><i class="fas fa-calendar-plus"></i> Emisja</button>
                <button class="btn btn-ghost" data-d="series"><i class="fas fa-link"></i> ${a.series ? 'Zmień serię' : 'Dodaj do serii'}</button>
                <button class="btn btn-ghost" data-d="edit"><i class="fas fa-pen"></i> Edytuj</button>
            </div>`;

        U.$('anime-details-content').onclick = (e) => {
            const tag = e.target.closest('[data-tag]');
            if (tag) { UI.close('anime-details-modal'); Collection.searchTag(tag.dataset.tag); return; }
            const rel = e.target.closest('[data-related]');
            if (rel) return open(rel.dataset.related);
            const act = e.target.closest('[data-d]')?.dataset.d;
            if (!act) return;
            UI.close('anime-details-modal');
            if (act === 'episodes') Episodes.openModal(a.id);
            if (act === 'airing') Airing.openEditor(a.id);
            if (act === 'edit') AnimeForm.openEdit(a.id);
            if (act === 'series') Series.openPicker(a.id);
        };
        UI.open('anime-details-modal');
    }

    return { open };
})();
