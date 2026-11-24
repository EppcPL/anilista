/* =========================================================
   tierlist.js – tier lista wg wybranej kategorii ocen
   ========================================================= */
const TierList = (() => {
    const TIERS = [
        { id: 'SSS', min: 11 },
        { id: 'SS', min: 10 },
        { id: 'S', min: 8.5 },
        { id: 'A', min: 7.5 },
        { id: 'B', min: 6.5 },
        { id: 'C', min: 5.5 },
        { id: 'D', min: 3.5 },
        { id: 'F', min: 0 }
    ];
    let category = 'average';

    const tierOf = (rating) => TIERS.find(t => rating >= t.min).id;

    function render() {
        const groups = Object.fromEntries(TIERS.map(t => [t.id, []]));
        Store.state.anime.forEach(a => {
            const r = Number(Calc.ratingFor(a, category)) || 0;
            groups[tierOf(r)].push({ a, r });
        });
        U.$('tier-list-container').innerHTML = TIERS.map(t => `
            <div class="tier-row">
                <div class="tier-label tier-${t.id}">${t.id}</div>
                <div class="tier-items">
                    ${groups[t.id].sort((x, y) => y.r - x.r).map(({ a, r }) => `
                        <button class="tier-item" data-tier="${t.id}" data-id="${a.id}" title="${U.esc(a.title)}: ${r}">
                            ${a.image ? `<img src="${a.image}" alt="">` : ''}<span>${U.esc(a.title)}</span>
                        </button>`).join('') || '<span class="tier-empty">—</span>'}
                </div>
            </div>`).join('');
    }

    function init() {
        U.$('tier-controls').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-category]');
            if (!btn) return;
            category = btn.dataset.category;
            U.qsa('#tier-controls .chip').forEach(c => c.classList.toggle('active', c === btn));
            render();
        });
        U.$('tier-list-container').addEventListener('click', (e) => {
            const item = e.target.closest('.tier-item');
            if (item) Details.open(item.dataset.id);
        });
    }

    return { init, render };
})();
