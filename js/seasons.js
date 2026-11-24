/* =========================================================
   seasons.js – edytor sezonów używany w formularzu dodawania,
   w oknie edycji i w planerze (bez powtórek i dat).
   ========================================================= */
const Seasons = (() => {
    /**
     * @param {HTMLElement} box       kontener na wiersze sezonów
     * @param {HTMLInputElement} countInput  pole "liczba sezonów"
     * @param {HTMLInputElement} totalInput  pole "odcinki łącznie"
     * @param {{full:boolean, lengthInput?:HTMLInputElement}} opts
     *        full = pokaż powtórki i daty ukończenia sezonów
     */
    function create(box, countInput, totalInput, opts = {}) {
        const full = !!opts.full;

        function rowHTML(i, v = {}) {
            return `
                <div class="season-row" data-i="${i}">
                    <span class="season-name">Sezon ${i + 1}</span>
                    <label>Odcinki <input type="number" class="s-eps" min="0" value="${v.eps ?? ''}"></label>
                    <label>Min/odc. <input type="number" class="s-len" min="1" value="${v.len ?? ''}" placeholder="${opts.lengthInput ? opts.lengthInput.value || 24 : 24}"></label>
                    ${full ? `
                    <label>Powtórki <input type="number" class="s-rew" min="0" value="${v.rew ?? 0}"></label>
                    <label class="s-date-label">Ukończono <input type="date" class="s-date" value="${v.date || ''}"></label>` : ''}
                </div>`;
        }

        function readRows() {
            return U.qsa('.season-row', box).map(r => ({
                eps: r.querySelector('.s-eps').value,
                len: r.querySelector('.s-len').value,
                rew: full ? r.querySelector('.s-rew').value : 0,
                date: full ? r.querySelector('.s-date').value : ''
            }));
        }

        function render(count, values) {
            values = values || readRows();
            if (count > 1) {
                box.innerHTML = Array.from({ length: count }, (_, i) => rowHTML(i, values[i])).join('');
                box.hidden = false;
                totalInput.readOnly = true;
                syncTotal();
            } else {
                box.innerHTML = '';
                box.hidden = true;
                totalInput.readOnly = false;
            }
        }

        function syncTotal() {
            if (box.hidden) return;
            const sum = readRows().reduce((s, r) => s + U.int(r.eps), 0);
            totalInput.value = sum || '';
        }

        countInput.addEventListener('input', () => render(Math.max(1, U.int(countInput.value, 1))));
        box.addEventListener('input', (e) => {
            if (e.target.classList.contains('s-eps')) syncTotal();
        });

        return {
            /** Wypełnij na podstawie obiektu anime / planera */
            load(item) {
                const n = Array.isArray(item.seasons) && item.seasons.length > 1 ? item.seasons.length : 1;
                countInput.value = n;
                const values = (item.seasons || []).map((eps, i) => ({
                    eps,
                    len: item.seasonEpisodeLengths ? item.seasonEpisodeLengths[i] : '',
                    rew: item.seasonRewatches ? item.seasonRewatches[i] || 0 : 0,
                    date: item.seasonCompletedDates ? item.seasonCompletedDates[i] || '' : ''
                }));
                render(n, values);
            },
            reset() {
                countInput.value = 1;
                render(1, []);
            },
            /** Liczba sezonów + tablice danych (tylko gdy > 1 sezon) */
            read(defaultLength = 24) {
                const count = Math.max(1, U.int(countInput.value, 1));
                if (count < 2) return { count: 1 };
                const rows = readRows();
                return {
                    count,
                    seasons: rows.map(r => U.int(r.eps)),
                    seasonEpisodeLengths: rows.map(r => U.int(r.len, defaultLength)),
                    seasonRewatches: rows.map(r => U.int(r.rew)),
                    seasonCompletedDates: rows.map(r => r.date || null)
                };
            }
        };
    }

    return { create };
})();
