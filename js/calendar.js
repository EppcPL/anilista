/* =========================================================
   calendar.js – kalendarz aktywności (rok / miesiąc),
   (podsumowania są w summary.js)
   ========================================================= */
const Calendar = (() => {
    const now = new Date();
    const cal = { year: now.getFullYear(), month: now.getMonth(), mode: 'year' };
    const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
    const visible = () => isMobile() || Store.pref('calendarShown', 'true') !== 'false';

    /* ---------------- rysowanie ---------------- */

    function render() {
        const box = U.$('calendar-container');
        const btn = U.$('toggle-calendar-btn');
        btn.hidden = isMobile();
        btn.innerHTML = visible() ? '<i class="fas fa-eye-slash"></i> Ukryj' : '<i class="fas fa-eye"></i> Pokaż';
        box.hidden = !visible();
        if (!visible()) return;
        const mode = isMobile() ? 'month' : cal.mode;
        box.innerHTML = mode === 'year' ? yearHTML() : monthHTML();
    }

    function dayCell(date) {
        const key = U.dateKey(date);
        const n = Store.state.activity[key] || 0;
        const today = key === U.todayKey() ? ' is-today' : '';
        const tip = `${date.getDate()} ${U.MONTHS_GEN[date.getMonth()]}: ${n ? U.eps(n) : 'brak aktywności'}`;
        return { key, n, cls: `lvl-${Calc.activityLevel(n)}${today}`, tip };
    }

    /** Przełącznik Rok / Miesiąc (tylko komputer) */
    function modeSwitch(mode) {
        if (isMobile()) return '';
        return `<div class="cal-mode">
            <button class="${mode === 'year' ? 'active' : ''}" data-cal="to-year">Rok</button>
            <button class="${mode === 'month' ? 'active' : ''}" data-cal="to-month">Miesiąc</button>
        </div>`;
    }

    function monthTotals(y) {
        const totals = Array(12).fill(0);
        Object.entries(Store.state.activity).forEach(([k, n]) => {
            if (k.startsWith(`${y}-`)) totals[U.int(k.slice(5, 7)) - 1] += n;
        });
        return totals;
    }

    function yearHTML() {
        const y = cal.year;
        const first = U.startOfWeek(new Date(y, 0, 1));
        const last = new Date(y, 11, 31);
        const weeks = Math.ceil(((last - first) / 864e5 + 1) / 7);
        let cells = '';
        const monthCols = [];
        for (let w = 0; w < weeks; w++) {
            for (let d = 0; d < 7; d++) {
                const date = U.addDays(first, w * 7 + d);
                const pos = `grid-column:${w + 2};grid-row:${d + 2}`;
                if (date.getFullYear() !== y) {
                    cells += `<span class="hm-day hm-out" style="${pos}"></span>`;
                    continue;
                }
                if (date.getDate() === 1) monthCols[date.getMonth()] = w + 2;
                const c = dayCell(date);
                const edge = w < 4 ? ' tip-left' : w > weeks - 5 ? ' tip-right' : '';
                cells += `<button class="hm-day ${c.cls}${edge}" style="${pos}" data-date="${c.key}" data-m="${date.getMonth()}" data-wd="${d}" data-tip="${c.tip}" aria-label="${c.tip}"></button>`;
            }
        }
        const months = monthCols.map((col, m) => `<button class="hm-month" style="grid-column:${col} / span 4" data-month-summary="${m}" title="Statystyki: ${U.MONTHS[m]}">${U.MONTHS_SHORT[m]}</button>`).join('');
        const labels = U.DAYS_SHORT.map((d, i) => `<span class="hm-wd" style="grid-row:${i + 2}" data-wd-label="${i}">${d}</span>`).join('');
        const totals = monthTotals(y);
        const yearTotal = totals.reduce((a, b) => a + b, 0);
        const max = Math.max(1, ...totals);
        const thisMonth = y === new Date().getFullYear() ? new Date().getMonth() : -1;

        return `
            <div class="cal-head">
                <div class="cal-nav">
                    <button class="btn-icon" data-cal="prev" aria-label="Poprzedni rok"><i class="fas fa-chevron-left"></i></button>
                    <div class="cal-title">${y}</div>
                    <button class="btn-icon" data-cal="next" aria-label="Następny rok"><i class="fas fa-chevron-right"></i></button>
                    <span class="cal-total">${U.eps(yearTotal)}</span>
                </div>
                <div class="cal-nav">
                    ${modeSwitch('year')}
                    <button class="btn btn-accent btn-sm" data-cal="summary"><i class="fas fa-chart-pie"></i> Podsumowanie roku</button>
                </div>
            </div>
            <div class="heatmap" style="grid-template-columns: 2.4rem repeat(${weeks}, minmax(0, 1fr))">
                ${months}${labels}${cells}
            </div>
            <div class="hm-legend">Mniej ${[0, 1, 2, 3, 4, 5].map(l => `<span class="hm-day lvl-${l}"></span>`).join('')} Więcej</div>

            <h4 class="cal-sub">Miesiące <small>kliknij, aby zobaczyć statystyki</small></h4>
            <div class="month-bars">
                ${totals.map((n, m) => `
                <button class="month-bar ${m === thisMonth ? 'is-now' : ''}" data-month-summary="${m}" title="${U.MONTHS[m]}: ${U.eps(n)}">
                    <span class="mb-val">${n || ''}</span>
                    <span class="mb-col"><span style="height:${Math.round(n / max * 100)}%"></span></span>
                    <span class="mb-name">${U.MONTHS_SHORT[m]}</span>
                </button>`).join('')}
            </div>`;
    }

    function monthHTML() {
        const { year: y, month: m } = cal;
        const first = new Date(y, m, 1);
        const offset = U.weekdayIndex(first);
        const daysIn = new Date(y, m + 1, 0).getDate();
        const keys = [];
        let cells = '';
        for (let i = 0; i < offset; i++) cells += '<span class="md-day md-out"></span>';
        for (let d = 1; d <= daysIn; d++) {
            const c = dayCell(new Date(y, m, d));
            keys.push(c.key);
            cells += `<button class="md-day ${c.cls}" data-date="${c.key}" data-tip="${c.tip}" aria-label="${c.tip}"><span>${d}</span>${c.n ? `<small>${c.n} odc.</small>` : ''}</button>`;
        }
        const s = Summary.collect(keys);
        const top = s.topDay ? U.parseDate(s.topDay.key) : null;

        return `
            <div class="cal-head">
                <div class="cal-nav">
                    <button class="btn-icon" data-cal="prev" aria-label="Poprzedni miesiąc"><i class="fas fa-chevron-left"></i></button>
                    <div class="cal-title">${U.MONTHS[m]} <span class="muted">${y}</span></div>
                    <button class="btn-icon" data-cal="next" aria-label="Następny miesiąc"><i class="fas fa-chevron-right"></i></button>
                </div>
                <div class="cal-nav">${modeSwitch('month')}</div>
            </div>
            <div class="month-layout">
                <div class="month-grid">
                    ${U.DAYS_SHORT.map(d => `<span class="md-label">${d}</span>`).join('')}
                    ${cells}
                </div>
                <aside class="month-stats">
                    <div class="ms-item"><strong>${s.episodes}</strong><span>odcinków</span></div>
                    <div class="ms-item"><strong>${U.fmtDuration(s.minutes)}</strong><span>czasu oglądania</span></div>
                    <div class="ms-item"><strong>${s.perAnime.length}</strong><span>anime</span></div>
                    <div class="ms-item"><strong>${top ? `${top.getDate()}.${String(top.getMonth() + 1).padStart(2, '0')}` : '–'}</strong><span>${top ? `najaktywniejszy dzień (${U.eps(s.topDay.n)})` : 'najaktywniejszy dzień'}</span></div>
                    <button class="btn btn-accent btn-sm" data-month-summary="${m}"><i class="fas fa-chart-column"></i> Szczegóły miesiąca</button>
                </aside>
            </div>`;
    }

    /* ---------------- obsługa zdarzeń ---------------- */

    function step(delta) {
        if ((isMobile() ? 'month' : cal.mode) === 'year') {
            cal.year += delta;
        } else {
            cal.month += delta;
            if (cal.month < 0) { cal.month = 11; cal.year--; }
            if (cal.month > 11) { cal.month = 0; cal.year++; }
        }
        render();
    }

    function init() {
        const box = U.$('calendar-container');
        U.$('toggle-calendar-btn').onclick = () => {
            Store.setPref('calendarShown', !visible());
            render();
        };
        box.addEventListener('click', (e) => {
            const act = e.target.closest('[data-cal]')?.dataset.cal;
            if (act === 'prev') return step(-1);
            if (act === 'next') return step(1);
            if (act === 'summary') return Summary.year(cal.year);
            if (act === 'to-year') { cal.mode = 'year'; return render(); }
            if (act === 'to-month') {
                cal.mode = 'month';
                if (cal.year === new Date().getFullYear()) cal.month = new Date().getMonth();
                return render();
            }
            const ms = e.target.closest('[data-month-summary]');
            if (ms) return Summary.month(U.int(ms.dataset.monthSummary), cal.year);
            const day = e.target.closest('[data-date]');
            if (day) Summary.day(day.dataset.date);
        });
        // Podświetlanie dnia tygodnia / miesiąca w widoku roku
        box.addEventListener('mouseover', (e) => {
            const hm = box.querySelector('.heatmap');
            if (!hm) return;
            const wd = e.target.closest('[data-wd-label]');
            const mo = e.target.closest('.hm-month, .month-bar');
            hm.querySelectorAll('.hm-day[data-date]').forEach(c => {
                const dim = (wd && c.dataset.wd !== wd.dataset.wdLabel) || (mo && c.dataset.m !== mo.dataset.monthSummary);
                c.classList.toggle('dimmed', !!dim);
            });
        });
        // Przesuwanie palcem
        let sx = 0, sy = 0;
        box.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
        box.addEventListener('touchend', (e) => {
            const dx = sx - e.changedTouches[0].clientX, dy = sy - e.changedTouches[0].clientY;
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) step(dx > 0 ? 1 : -1);
        }, { passive: true });
        window.matchMedia('(max-width: 760px)').addEventListener('change', render);
    }

    return { init, render };
})();
