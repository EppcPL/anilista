/* =========================================================
   calendar.js – kalendarz aktywności (rok / miesiąc),
   podsumowania dnia, miesiąca i roku
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

    function dayCell(date, extraCls = '') {
        const key = U.dateKey(date);
        const n = Store.state.activity[key] || 0;
        const today = key === U.todayKey() ? ' is-today' : '';
        return { key, n, cls: `lvl-${Calc.activityLevel(n)}${today} ${extraCls}`, tip: `${U.fmtDate(key)}: ${n ? U.eps(n) : 'brak aktywności'}` };
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
                if (date.getFullYear() !== y) {
                    cells += `<span class="hm-day hm-out" style="grid-column:${w + 2};grid-row:${d + 2}"></span>`;
                    continue;
                }
                if (date.getDate() === 1) monthCols[date.getMonth()] = w + 2;
                const c = dayCell(date);
                cells += `<button class="hm-day ${c.cls}" style="grid-column:${w + 2};grid-row:${d + 2}" data-date="${c.key}" data-m="${date.getMonth()}" data-wd="${d}" title="${c.tip}"></button>`;
            }
        }
        const months = monthCols.map((col, m) => `<button class="hm-month" style="grid-column:${col} / span 4" data-month="${m}">${U.MONTHS_SHORT[m]}</button>`).join('');
        const labels = U.DAYS_SHORT.map((d, i) => `<span class="hm-wd" style="grid-row:${i + 2}" data-wd-label="${i}">${i % 2 === 0 ? d : ''}</span>`).join('');
        const yearTotal = Object.keys(Store.state.activity).filter(k => k.startsWith(`${y}-`)).reduce((s, k) => s + Store.state.activity[k], 0);

        return `
            <div class="cal-head">
                <div class="cal-title">${y} <small>${U.eps(yearTotal)}</small></div>
                <div class="cal-nav">
                    <button class="btn-icon" data-cal="prev-year" aria-label="Poprzedni rok"><i class="fas fa-chevron-left"></i></button>
                    <button class="btn btn-ghost btn-sm" data-cal="summary"><i class="fas fa-chart-pie"></i> Podsumowanie roku</button>
                    <button class="btn-icon" data-cal="next-year" aria-label="Następny rok"><i class="fas fa-chevron-right"></i></button>
                </div>
            </div>
            <div class="heatmap" style="grid-template-columns: 2.2rem repeat(${weeks}, minmax(0, 1fr))">
                ${months}${labels}${cells}
            </div>
            <div class="hm-legend">Mniej ${[0, 1, 2, 3, 4, 5].map(l => `<span class="hm-day lvl-${l}"></span>`).join('')} Więcej</div>`;
    }

    function monthHTML() {
        const { year: y, month: m } = cal;
        const first = new Date(y, m, 1);
        const offset = U.weekdayIndex(first);
        const daysIn = new Date(y, m + 1, 0).getDate();
        let cells = '';
        for (let i = 0; i < offset; i++) cells += '<span class="md-day md-out"></span>';
        for (let d = 1; d <= daysIn; d++) {
            const c = dayCell(new Date(y, m, d));
            cells += `<button class="md-day ${c.cls}" data-date="${c.key}" title="${c.tip}"><span>${d}</span>${c.n ? `<small>${c.n}</small>` : ''}</button>`;
        }
        return `
            <div class="cal-head">
                <div class="cal-title">${U.MONTHS[m]} ${y}</div>
                <div class="cal-nav">
                    <button class="btn-icon" data-cal="prev-month" aria-label="Poprzedni miesiąc"><i class="fas fa-chevron-left"></i></button>
                    <button class="btn btn-ghost btn-sm" data-cal="month-summary"><i class="fas fa-chart-column"></i> Podsumowanie</button>
                    ${isMobile() ? '' : '<button class="btn btn-ghost btn-sm" data-cal="to-year">Cały rok</button>'}
                    <button class="btn-icon" data-cal="next-month" aria-label="Następny miesiąc"><i class="fas fa-chevron-right"></i></button>
                </div>
            </div>
            <div class="month-grid">
                ${U.DAYS_SHORT.map(d => `<span class="md-label">${d}</span>`).join('')}
                ${cells}
            </div>`;
    }

    /* ---------------- podsumowania ---------------- */

    function collect(keys) {
        const { activity, details } = Store.state;
        let episodes = 0, minutes = 0;
        const perAnime = {}, perTag = {};
        let topDay = null;
        keys.forEach(key => {
            const n = activity[key] || 0;
            if (!n) return;
            episodes += n;
            if (!topDay || n > topDay.n) topDay = { key, n };
            (details[key] || []).forEach(d => {
                const min = Calc.detailMinutes(d);
                minutes += min;
                const id = d.animeId ?? d.title;
                perAnime[id] = perAnime[id] || { title: d.title, episodes: 0, minutes: 0 };
                perAnime[id].episodes += d.episodes;
                perAnime[id].minutes += min;
                const a = Store.find(d.animeId);
                (a ? a.tags : []).forEach(t => {
                    perTag[t] = perTag[t] || { name: t, episodes: 0, minutes: 0, ids: new Set() };
                    perTag[t].episodes += d.episodes;
                    perTag[t].minutes += min;
                    perTag[t].ids.add(a.id);
                });
            });
        });
        return { episodes, minutes, perAnime: Object.values(perAnime), perTag: Object.values(perTag), topDay };
    }

    function summaryHTML(s, { withTopDay = false, emptyText }) {
        const stats = [
            `<div><strong>${s.episodes}</strong><span>odcinki</span></div>`,
            `<div><strong>${U.fmtDuration(s.minutes)}</strong><span>czas oglądania</span></div>`,
            `<div><strong>${s.perAnime.length}</strong><span>anime</span></div>`
        ];
        if (withTopDay) {
            const d = s.topDay && U.parseDate(s.topDay.key);
            stats.push(d
                ? `<div><strong>${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}</strong><span>najaktywniejszy dzień (${U.eps(s.topDay.n)})</span></div>`
                : '<div><strong>–</strong><span>najaktywniejszy dzień</span></div>');
        }
        U.$('day-summary-stats').innerHTML = stats.join('');
        const list = s.perAnime.sort((a, b) => b.episodes - a.episodes);
        let html = list.length
            ? `<ul class="sum-list">${list.map(x => `<li><span>${U.esc(x.title)}</span><span>${U.eps(x.episodes)} · ${U.fmtDuration(x.minutes)}</span></li>`).join('')}</ul>`
            : `<div class="empty">${emptyText}</div>`;
        if (s.perTag.length > 1 || (withTopDay && s.perTag.length)) {
            html += `<h4>Najczęstsze tagi</h4><div class="tags">${s.perTag.sort((a, b) => b.episodes - a.episodes)
                .map(t => `<span class="tag">${U.esc(t.name)} · ${t.episodes} odc. · ${U.fmtDuration(t.minutes)}</span>`).join('')}</div>`;
        }
        U.$('day-summary-anime-list').innerHTML = html;
    }

    function showDay(key) {
        const d = U.parseDate(key);
        U.$('day-summary-date').textContent = d.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        summaryHTML(collect([key]), { emptyText: 'Brak aktywności tego dnia.' });
        UI.open('day-summary-modal');
    }

    function showMonth(m, y = cal.year) {
        const keys = Array.from({ length: new Date(y, m + 1, 0).getDate() }, (_, i) => U.dateKey(new Date(y, m, i + 1)));
        U.$('day-summary-date').textContent = `${U.MONTHS[m]} ${y}`;
        summaryHTML(collect(keys), { withTopDay: true, emptyText: 'Brak aktywności w tym miesiącu.' });
        UI.open('day-summary-modal');
    }

    /* ---------------- podsumowanie roku ---------------- */

    function yearStats(y) {
        const { activity, details } = Store.state;
        const keys = Object.keys(activity).filter(k => k.startsWith(`${y}-`) && activity[k] > 0).sort();
        const months = U.MONTHS.map(name => ({ name, episodes: 0 }));
        const weekdays = U.DAY_NAMES.map(name => ({ name, episodes: 0 }));
        const daysList = [];
        const watched = new Map();
        keys.forEach(k => {
            const d = U.parseDate(k);
            months[d.getMonth()].episodes += activity[k];
            weekdays[d.getDay()].episodes += activity[k];
            daysList.push({ name: `${d.getDate()} ${U.MONTHS[d.getMonth()].toLowerCase()} (${U.DAY_NAMES[d.getDay()]})`, episodes: activity[k] });
            (details[k] || []).forEach(det => {
                const a = Store.find(det.animeId);
                if (a && !watched.has(a.id)) watched.set(a.id, a);
            });
        });
        const s = collect(keys);
        const anime = [...watched.values()].sort((a, b) => b.averageRating - a.averageRating);
        const maxBy = (arr) => arr.reduce((m, x) => x.episodes > m.episodes ? x : m, { name: 'Brak', episodes: 0 });
        const top3 = (key) => [...anime].sort((a, b) => b.ratings[key] - a.ratings[key]).slice(0, 3)
            .map(a => ({ name: a.title, value: a.ratings[key], sub: a.completedDate ? U.fmtDate(a.completedDate) : '' }));
        return {
            s, anime, months, weekdays, daysList,
            topMonth: maxBy(months), topWeekday: maxBy(weekdays), topDay: maxBy(daysList),
            favTag: maxBy(s.perTag.map(t => ({ name: t.name, episodes: t.episodes }))),
            streak: Calc.longestStreak(keys).length,
            avg: anime.length ? (anime.reduce((x, a) => x + a.averageRating, 0) / anime.length).toFixed(2) : '–',
            top3: { graphics: top3('graphics'), music: top3('music'), story: top3('story'), fun: top3('fun') }
        };
    }

    function podium(items, valueLabel = '') {
        if (!items.length) return '<div class="empty">Brak danych</div>';
        const medals = ['🥇', '🥈', '🥉'];
        return `<ol class="podium">${items.map((x, i) => `
            <li><span>${medals[i] || ''} ${U.esc(x.name)}${x.sub ? `<small>${x.sub}</small>` : ''}</span><b>${x.value}${valueLabel}</b></li>`).join('')}</ol>`;
    }

    function showYear(y) {
        const st = yearStats(y);
        U.$('yearly-summary-title').textContent = `Podsumowanie roku ${y}`;
        const tile = (value, label, sub = '', type = '') => `
            <${type ? 'button' : 'div'} class="tile ${type ? 'tile-click' : ''}" ${type ? `data-ys="${type}"` : ''}>
                <strong>${value}</strong><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}
            </${type ? 'button' : 'div'}>`;
        const best = st.anime[0], worst = st.anime[st.anime.length - 1];

        U.$('yearly-summary-content').innerHTML = `
            <div class="tiles">
                ${tile(st.s.episodes, 'obejrzane odcinki')}
                ${tile(U.fmtDuration(st.s.minutes), 'czas oglądania')}
                ${tile(st.anime.length, 'tytuły')}
                ${tile(U.days(st.streak), 'najdłuższy streak')}
                ${tile(st.topMonth.name, 'najaktywniejszy miesiąc', U.eps(st.topMonth.episodes), 'months')}
                ${tile(st.topWeekday.name, 'ulubiony dzień tygodnia', U.eps(st.topWeekday.episodes), 'weekdays')}
                ${tile(st.topDay.name, 'rekordowy dzień', U.eps(st.topDay.episodes), 'days')}
                ${tile(U.esc(st.favTag.name), 'ulubiony tag', U.eps(st.favTag.episodes))}
                ${tile(st.avg, 'średnia ocena')}
            </div>
            ${best ? `
            <div class="best-worst">
                <div class="bw bw-best"><span>Najlepsze</span><strong>${U.esc(best.title)}</strong><b>${best.averageRating}</b></div>
                <div class="bw bw-worst"><span>Najsłabsze</span><strong>${U.esc(worst.title)}</strong><b>${worst.averageRating}</b></div>
            </div>` : ''}
            <h4>Top 3</h4>
            <div class="chips" data-top3>
                ${['graphics', 'music', 'story', 'fun'].map((k, i) => `<button class="chip ${i === 0 ? 'active' : ''}" data-k="${k}">${Calc.RATING_NAMES[k]}</button>`).join('')}
            </div>
            <div data-top3-out>${podium(st.top3.graphics)}</div>
            <h4>Obejrzane w ${y}</h4>
            <ul class="sum-list scroll">${st.anime.map(a => `<li><span>${U.esc(a.title)}</span><b>${a.averageRating}</b></li>`).join('') || '<li>Brak</li>'}</ul>`;

        const content = U.$('yearly-summary-content');
        content.onclick = (e) => {
            const chip = e.target.closest('[data-k]');
            if (chip) {
                content.querySelectorAll('[data-top3] .chip').forEach(c => c.classList.toggle('active', c === chip));
                content.querySelector('[data-top3-out]').innerHTML = podium(st.top3[chip.dataset.k]);
            }
            const ys = e.target.closest('[data-ys]')?.dataset.ys;
            if (ys) {
                const titles = { months: 'Najaktywniejsze miesiące', weekdays: 'Najaktywniejsze dni tygodnia', days: 'Rekordowe dni' };
                const items = [...st[ys === 'days' ? 'daysList' : ys]].sort((a, b) => b.episodes - a.episodes).slice(0, 3)
                    .map(x => ({ name: x.name, value: x.episodes }));
                U.$('stat-detail-title').textContent = titles[ys];
                U.$('stat-detail-content').innerHTML = podium(items, ' odc.');
                UI.open('stat-detail-modal');
            }
        };
        UI.open('yearly-summary-modal');
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
            if (act === 'prev-year' || act === 'prev-month') return step(-1);
            if (act === 'next-year' || act === 'next-month') return step(1);
            if (act === 'summary') return showYear(cal.year);
            if (act === 'month-summary') return showMonth(cal.month);
            if (act === 'to-year') { cal.mode = 'year'; return render(); }
            const month = e.target.closest('[data-month]');
            if (month) { cal.mode = 'month'; cal.month = U.int(month.dataset.month); return render(); }
            const day = e.target.closest('[data-date]');
            if (day) showDay(day.dataset.date);
        });
        // Podświetlanie dnia tygodnia / miesiąca w widoku roku
        box.addEventListener('mouseover', (e) => {
            const hm = box.querySelector('.heatmap');
            if (!hm) return;
            const wd = e.target.closest('[data-wd-label]');
            const mo = e.target.closest('.hm-month');
            hm.querySelectorAll('.hm-day[data-date]').forEach(c => {
                const dim = (wd && c.dataset.wd !== wd.dataset.wdLabel) || (mo && c.dataset.m !== mo.dataset.month);
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
