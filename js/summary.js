/* =========================================================
   summary.js – podsumowania dnia, miesiąca i roku
   (na co poszło najwięcej czasu, wykresy, ciekawostki)
   ========================================================= */
const Summary = (() => {

    /* ---------------- zbieranie danych ---------------- */

    /** Statystyki dla listy dni (klucze YYYY-MM-DD) */
    function collect(keys) {
        const { activity, details } = Store.state;
        let episodes = 0, minutes = 0, activeDays = 0;
        const perAnime = {}, perTag = {}, perDay = {};
        const weekdays = Array(7).fill(0); // od poniedziałku
        let topDay = null;

        keys.forEach(key => {
            const n = activity[key] || 0;
            if (!n) return;
            episodes += n;
            activeDays++;
            weekdays[U.weekdayIndex(U.parseDate(key))] += n;
            if (!topDay || n > topDay.n) topDay = { key, n };
            let dayMin = 0;
            (details[key] || []).forEach(d => {
                const min = Calc.detailMinutes(d);
                dayMin += min;
                minutes += min;
                const a = Store.find(d.animeId);
                const id = a ? a.id : d.title;
                perAnime[id] = perAnime[id] || { id, title: a ? a.title : d.title, image: a ? a.image : null, episodes: 0, minutes: 0, days: new Set() };
                perAnime[id].episodes += d.episodes;
                perAnime[id].minutes += min;
                perAnime[id].days.add(key);
                new Set((a ? a.tags : []).map(U.tagKey)).forEach(k => {
                    perTag[k] = perTag[k] || { name: a.tags.find(t => U.tagKey(t) === k), episodes: 0, minutes: 0 };
                    perTag[k].episodes += d.episodes;
                    perTag[k].minutes += min;
                });
            });
            // dni bez szczegółów (stare wpisy) – szacujemy po 24 min
            if (!dayMin) { dayMin = n * 24; minutes += dayMin; }
            perDay[key] = { n, minutes: dayMin };
        });

        return {
            keys, episodes, minutes, activeDays, weekdays, topDay, perDay,
            perAnime: Object.values(perAnime).sort((a, b) => b.minutes - a.minutes || b.episodes - a.episodes),
            perTag: Object.values(perTag).sort((a, b) => b.minutes - a.minutes),
            streak: Calc.longestStreak(keys.filter(k => activity[k] > 0)).length
        };
    }

    const monthKeys = (y, m) => Array.from({ length: new Date(y, m + 1, 0).getDate() }, (_, i) => U.dateKey(new Date(y, m, i + 1)));
    const yearKeys = (y) => {
        const out = [];
        for (let d = new Date(y, 0, 1); d.getFullYear() === y; d = U.addDays(d, 1)) out.push(U.dateKey(d));
        return out;
    };

    /** Anime ukończone w okresie (wg daty ukończenia) */
    const completedIn = (prefix) => Store.state.anime.filter(a => a.completedDate && a.completedDate.startsWith(prefix));

    /** Anime, które pierwszy raz pojawiły się w aktywności w tym okresie */
    function startedIn(keys) {
        const first = {};
        Object.keys(Store.state.details).sort().forEach(k => (Store.state.details[k] || []).forEach(d => {
            if (d.animeId != null && !first[d.animeId]) first[d.animeId] = k;
        }));
        const set = new Set(keys);
        return Object.entries(first).filter(([, k]) => set.has(k)).map(([id]) => Store.find(id)).filter(Boolean);
    }

    /* ---------------- elementy HTML ---------------- */

    const hours = (min) => Math.round(min / 6) / 10;

    function cover(item, cls = 'rank-cover') {
        return item.image
            ? `<img class="${cls}" src="${item.image}" alt="">`
            : `<span class="${cls} rank-letter">${U.esc((item.title || '?').charAt(0).toUpperCase())}</span>`;
    }

    function hero(s, label, compare) {
        const h = hours(s.minutes);
        let diff = '';
        if (compare && compare.episodes > 0) {
            const pct = Math.round((s.episodes - compare.episodes) / compare.episodes * 100);
            diff = pct === 0
                ? `<span class="trend">Tyle samo odcinków, co ${compare.label}</span>`
                : `<span class="trend ${pct > 0 ? 'up' : 'down'}"><i class="fas fa-arrow-${pct > 0 ? 'up' : 'down'}"></i> ${Math.abs(pct)}% ${pct > 0 ? 'więcej' : 'mniej'} odcinków niż ${compare.label}</span>`;
        } else if (compare && s.episodes > 0) {
            diff = `<span class="trend up"><i class="fas fa-arrow-up"></i> więcej niż ${compare.label}</span>`;
        }
        return `
            <div class="sum-hero">
                <div class="sum-hero-main">
                    <span class="sum-kicker">${label}</span>
                    <strong class="sum-big">${h}<small>h</small></strong>
                    <span class="sum-hero-sub">${U.eps(s.episodes)} · ${s.perAnime.length} ${U.plural(s.perAnime.length, 'tytuł', 'tytuły', 'tytułów')} · ${U.days(s.activeDays)} z oglądaniem</span>
                    ${diff}
                </div>
                ${viewerType(s)}
            </div>`;
    }

    /** Zabawna „etykieta widza” na podstawie nawyków */
    function viewerType(s) {
        if (!s.episodes) return '';
        const perDay = s.episodes / Math.max(1, s.activeDays);
        const weekend = (s.weekdays[5] + s.weekdays[6]) / s.episodes;
        const ratio = s.activeDays / Math.max(1, s.keys.length);
        let t;
        if (perDay >= 5) t = { icon: 'fa-person-running', name: 'Maratończyk', desc: `Średnio ${perDay.toFixed(1)} odc. w dzień oglądania – nie oglądasz, Ty pochłaniasz.` };
        else if (ratio >= 0.5) t = { icon: 'fa-calendar-check', name: 'Codzienny widz', desc: `Anime było w ${Math.round(ratio * 100)}% dni. Rutyna godna podziwu.` };
        else if (weekend >= 0.55) t = { icon: 'fa-couch', name: 'Weekendowy widz', desc: `${Math.round(weekend * 100)}% odcinków w sobotę i niedzielę.` };
        else if (s.perAnime.length >= 6) t = { icon: 'fa-shuffle', name: 'Odkrywca', desc: `${s.perAnime.length} różnych tytułów – lubisz próbować nowych rzeczy.` };
        else t = { icon: 'fa-mug-hot', name: 'Spokojny widz', desc: 'Oglądasz w swoim tempie, bez pośpiechu.' };
        return `
            <div class="viewer-type">
                <i class="fas ${t.icon}"></i>
                <div><span>${Store.readonly ? 'Styl oglądania' : 'Twój styl'}</span><strong>${t.name}</strong><p>${t.desc}</p></div>
            </div>`;
    }

    function tiles(list) {
        return `<div class="sum-tiles">${list.map(t => `
            <${t.action ? 'button' : 'div'} class="sum-tile ${t.action ? 'sum-tile-click' : ''}" ${t.action ? `data-ys="${t.action}"` : ''}>
                <i class="fas ${t.icon}"></i>
                <strong>${t.value}</strong>
                <span>${t.label}</span>
                ${t.sub ? `<small>${t.sub}</small>` : ''}
            </${t.action ? 'button' : 'div'}>`).join('')}</div>`;
    }

    /** Ranking: na co poszło najwięcej czasu */
    function ranking(s, limit = 5) {
        if (!s.perAnime.length) return '';
        const max = s.perAnime[0].minutes || 1;
        const total = s.minutes || 1;
        const medals = ['gold', 'silver', 'bronze'];
        return `
            <section class="sum-section">
                <h4><i class="fas fa-hourglass-half"></i> ${Store.readonly ? 'Na co poszło najwięcej czasu' : 'Na co poświęciłeś najwięcej czasu'}</h4>
                <ol class="rank">${s.perAnime.slice(0, limit).map((a, i) => `
                    <li class="${medals[i] || ''}" ${Store.find(a.id) ? `data-open="${a.id}"` : ''}>
                        <span class="rank-pos">${i + 1}</span>
                        ${cover(a)}
                        <div class="rank-main">
                            <div class="rank-line"><b>${U.esc(a.title)}</b><span>${U.fmtDuration(a.minutes)}</span></div>
                            <div class="rank-bar"><span style="width:${Math.max(3, a.minutes / max * 100)}%"></span></div>
                            <small>${U.eps(a.episodes)} · ${U.days(a.days.size)} · ${Math.round(a.minutes / total * 100)}% czasu</small>
                        </div>
                    </li>`).join('')}
                </ol>
                ${s.perAnime.length > limit ? `<details class="rank-more"><summary>Pokaż wszystkie (${s.perAnime.length})</summary>
                    <ul class="sum-list">${s.perAnime.slice(limit).map(a => `<li><span>${U.esc(a.title)}</span><span>${U.eps(a.episodes)} · ${U.fmtDuration(a.minutes)}</span></li>`).join('')}</ul>
                </details>` : ''}
            </section>`;
    }

    /** Pionowy wykres słupkowy */
    function chart(title, icon, bars, { highlight = -1, small = false } = {}) {
        const max = Math.max(1, ...bars.map(b => b.value));
        return `
            <section class="sum-section">
                <h4><i class="fas ${icon}"></i> ${title}</h4>
                <div class="chart ${small ? 'chart-dense' : ''}">${bars.map((b, i) => `
                    <div class="chart-col ${i === highlight ? 'is-top' : ''}" style="--w:${i}" ${b.month !== undefined ? `data-month-summary="${b.month}"` : ''} ${b.date ? `data-date="${b.date}"` : ''} data-tip="${b.tip}">
                        <span class="chart-val">${b.value && !small ? b.value : ''}</span>
                        <span class="chart-bar"><span style="height:${b.value / max * 100}%"></span></span>
                        <span class="chart-label">${b.label}</span>
                    </div>`).join('')}
                </div>
            </section>`;
    }

    function weekdayChart(s) {
        const top = s.weekdays.indexOf(Math.max(...s.weekdays));
        return chart('Dni tygodnia', 'fa-calendar-week', s.weekdays.map((v, i) => ({ value: v, label: U.DAYS_SHORT[i], tip: `${U.DAYS_LONG[i]}: ${U.eps(v)}` })), { highlight: s.episodes ? top : -1 });
    }

    function tagCloud(s) {
        if (!s.perTag.length) return '';
        const max = s.perTag[0].minutes || 1;
        return `
            <section class="sum-section">
                <h4><i class="fas fa-tags"></i> Ulubione gatunki</h4>
                <div class="tag-bars">${s.perTag.slice(0, 8).map(t => `
                    <div class="tag-bar">
                        <span class="tag">${U.esc(t.name)}</span>
                        <div class="rank-bar"><span style="width:${Math.max(4, t.minutes / max * 100)}%"></span></div>
                        <small>${U.fmtDuration(t.minutes)}</small>
                    </div>`).join('')}
                </div>
            </section>`;
    }

    /** Ciekawostki */
    function facts(s, { completed = [], started = [], periodName }) {
        const list = [];
        const h = s.minutes / 60;
        if (h >= 2) list.push({ icon: 'fa-film', text: `To tyle, co <b>${Math.round(h / 2)}</b> ${U.plural(Math.round(h / 2), 'film', 'filmy', 'filmów')} pełnometrażowych.` });
        if (h >= 24) list.push({ icon: 'fa-bed', text: `Albo <b>${(h / 24).toFixed(1)}</b> doby oglądania bez snu.` });
        if (s.topDay) {
            const d = U.parseDate(s.topDay.key);
            list.push({ icon: 'fa-bolt', text: `Największy maraton: <b>${U.eps(s.topDay.n)}</b> – ${d.getDate()} ${U.MONTHS_GEN[d.getMonth()]} (${U.DAY_NAMES[d.getDay()]}).` });
        }
        if (s.streak > 1) list.push({ icon: 'fa-fire', text: `Najdłuższa seria: <b>${U.days(s.streak)}</b> z rzędu.` });
        if (s.activeDays) list.push({ icon: 'fa-gauge', text: `Średnio <b>${(s.episodes / s.activeDays).toFixed(1)}</b> odc. w dzień, w którym coś oglądałeś.` });
        const fav = s.perAnime.reduce((b, a) => (!b || a.days.size > b.days.size ? a : b), null);
        if (fav && fav.days.size > 1) list.push({ icon: 'fa-heart', text: `Najczęściej wracałeś do <b>${U.esc(fav.title)}</b> – ${U.days(fav.days.size)}.` });
        if (started.length) list.push({ icon: 'fa-seedling', text: `Nowe tytuły ${periodName}: <b>${started.length}</b> (${started.slice(0, 3).map(a => U.esc(a.title)).join(', ')}${started.length > 3 ? '…' : ''}).` });
        if (completed.length) list.push({ icon: 'fa-flag-checkered', text: `Ukończone ${periodName}: <b>${completed.length}</b> (${completed.slice(0, 3).map(a => U.esc(a.title)).join(', ')}${completed.length > 3 ? '…' : ''}).` });
        if (!list.length) return '';
        return `
            <section class="sum-section">
                <h4><i class="fas fa-lightbulb"></i> Ciekawostki</h4>
                <ul class="facts">${list.map(f => `<li><i class="fas ${f.icon}"></i><span>${f.text}</span></li>`).join('')}</ul>
            </section>`;
    }

    function emptyState(text) {
        return `<div class="sum-empty"><i class="fas fa-calendar-xmark"></i><p>${text}</p>${Store.readonly ? '' : '<small>Dodawaj odcinki przyciskiem „+ Odcinki” przy anime, a tutaj pojawią się statystyki.</small>'}</div>`;
    }

    function openWide(title, html, onClick) {
        U.$('yearly-summary-title').textContent = title;
        const box = U.$('yearly-summary-content');
        box.innerHTML = html;
        box.onclick = (e) => {
            const open = e.target.closest('[data-open]');
            if (open) { UI.close('yearly-summary-modal'); return Details.open(open.dataset.open); }
            const ms = e.target.closest('[data-month-summary]');
            if (ms) return month(U.int(ms.dataset.monthSummary), U.int(box.dataset.year));
            const day = e.target.closest('[data-date]');
            if (day) return dayView(day.dataset.date);
            if (onClick) onClick(e);
        };
        U.$('yearly-summary-modal').scrollTop = 0;
        box.classList.remove('fx-swap');
        void box.offsetWidth;
        box.classList.add('fx-swap');
        UI.open('yearly-summary-modal');
    }

    /* ---------------- dzień ---------------- */

    function dayView(key) {
        const s = collect([key]);
        const d = U.parseDate(key);
        U.$('day-summary-date').textContent = d.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
        U.$('day-summary-stats').innerHTML = `
            <div><strong>${s.episodes}</strong><span>odcinki</span></div>
            <div><strong>${U.fmtDuration(s.minutes)}</strong><span>czas</span></div>
            <div><strong>${s.perAnime.length}</strong><span>anime</span></div>`;
        U.$('day-summary-anime-list').innerHTML = s.episodes
            ? `<ol class="rank rank-compact">${s.perAnime.map((a, i) => `
                <li ${Store.find(a.id) ? `data-open="${a.id}"` : ''}>
                    ${cover(a)}
                    <div class="rank-main">
                        <div class="rank-line"><b>${U.esc(a.title)}</b><span>${U.fmtDuration(a.minutes)}</span></div>
                        <small>${U.eps(a.episodes)}</small>
                    </div>
                </li>`).join('')}</ol>`
            : '<div class="sum-empty"><i class="fas fa-moon"></i><p>Tego dnia było spokojnie.</p></div>';
        U.$('day-summary-anime-list').onclick = (e) => {
            const open = e.target.closest('[data-open]');
            if (open) { UI.close('day-summary-modal'); Details.open(open.dataset.open); }
        };
        UI.open('day-summary-modal');
    }

    /* ---------------- miesiąc ---------------- */

    function month(m, y) {
        const keys = monthKeys(y, m);
        const s = collect(keys);
        const pm = m === 0 ? 11 : m - 1, py = m === 0 ? y - 1 : y;
        const prev = collect(monthKeys(py, pm));
        const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
        const title = `${U.MONTHS[m]} ${y}`;
        U.$('yearly-summary-content').dataset.year = y;

        if (!s.episodes) return openWide(title, emptyState(`W tym miesiącu nie ma zapisanej aktywności.`));

        const dayBars = keys.map(k => {
            const d = U.parseDate(k);
            const v = (s.perDay[k] || {}).n || 0;
            return { value: v, label: d.getDate() % 5 === 0 || d.getDate() === 1 ? d.getDate() : '', date: k, tip: `${d.getDate()} ${U.MONTHS_GEN[m]}: ${U.eps(v)}` };
        });

        openWide(title, `
            ${hero(s, title, { episodes: prev.episodes, label: `w ${U.MONTHS_LOC[pm]}` })}
            ${tiles([
                { icon: 'fa-play', value: s.episodes, label: 'odcinków' },
                { icon: 'fa-clock', value: U.fmtDuration(s.minutes), label: 'czasu oglądania' },
                { icon: 'fa-calendar-day', value: `${s.activeDays}/${keys.length}`, label: 'dni z anime' },
                { icon: 'fa-fire', value: U.days(s.streak), label: 'najdłuższa seria' }
            ])}
            ${ranking(s)}
            ${chart('Dzień po dniu', 'fa-chart-column', dayBars, { small: true, highlight: s.topDay ? keys.indexOf(s.topDay.key) : -1 })}
            <div class="sum-2col">
                ${weekdayChart(s)}
                ${tagCloud(s)}
            </div>
            ${facts(s, { completed: completedIn(prefix), started: startedIn(keys), periodName: 'w tym miesiącu' })}
            <div class="sum-nav">
                <button class="btn btn-ghost btn-sm" data-sum-month="${pm}" data-sum-year="${py}"><i class="fas fa-chevron-left"></i> ${U.MONTHS[pm]}</button>
                <button class="btn btn-ghost btn-sm" data-sum-year-view="${y}"><i class="fas fa-chart-pie"></i> Cały rok ${y}</button>
                <button class="btn btn-ghost btn-sm" data-sum-month="${(m + 1) % 12}" data-sum-year="${m === 11 ? y + 1 : y}">${U.MONTHS[(m + 1) % 12]} <i class="fas fa-chevron-right"></i></button>
            </div>`, navClick);
    }

    function navClick(e) {
        const mb = e.target.closest('[data-sum-month]');
        if (mb) return month(U.int(mb.dataset.sumMonth), U.int(mb.dataset.sumYear));
        const yb = e.target.closest('[data-sum-year-view]');
        if (yb) return year(U.int(yb.dataset.sumYearView));
    }

    /* ---------------- rok ---------------- */

    function podium(items, unit = '') {
        if (!items.length) return '<div class="sum-empty-sm">Brak danych</div>';
        const medals = ['gold', 'silver', 'bronze'];
        return `<ol class="podium">${items.map((x, i) => `
            <li class="${medals[i]}" ${x.id ? `data-open="${x.id}"` : ''}><span class="rank-pos">${i + 1}</span><span class="podium-name">${U.esc(x.name)}${x.sub ? `<small>${x.sub}</small>` : ''}</span><b>${x.value}${unit}</b></li>`).join('')}</ol>`;
    }

    function year(y) {
        const keys = yearKeys(y);
        const s = collect(keys);
        const prev = collect(yearKeys(y - 1));
        const title = `${Store.readonly ? 'Rok' : 'Twój rok'} ${y}`;
        U.$('yearly-summary-content').dataset.year = y;
        if (!s.episodes) return openWide(title, emptyState(`W ${y} roku nie ma zapisanej aktywności.`));

        const months = Array(12).fill(0);
        Object.entries(s.perDay).forEach(([k, v]) => { months[U.int(k.slice(5, 7)) - 1] += v.n; });
        const topMonth = months.indexOf(Math.max(...months));
        const watched = s.perAnime.map(a => Store.find(a.id)).filter(Boolean);
        const rated = [...watched].sort((a, b) => b.averageRating - a.averageRating);
        const avg = rated.length ? (rated.reduce((x, a) => x + a.averageRating, 0) / rated.length).toFixed(1) : '–';
        const top3 = (k) => [...watched].sort((a, b) => b.ratings[k] - a.ratings[k]).slice(0, 3).map(a => ({ id: a.id, name: a.title, value: a.ratings[k] }));

        openWide(title, `
            ${hero(s, `Rok ${y}`, { episodes: prev.episodes, label: `w ${y - 1}` })}
            ${tiles([
                { icon: 'fa-play', value: s.episodes, label: 'odcinków' },
                { icon: 'fa-clock', value: U.fmtDuration(s.minutes), label: 'czasu oglądania' },
                { icon: 'fa-calendar-day', value: s.activeDays, label: 'dni z anime' },
                { icon: 'fa-fire', value: U.days(s.streak), label: 'najdłuższa seria' },
                { icon: 'fa-star', value: avg, label: 'średnia ocena obejrzanych' },
                { icon: 'fa-trophy', value: U.MONTHS[topMonth], label: 'najlepszy miesiąc', sub: U.eps(months[topMonth]) }
            ])}
            ${ranking(s, 5)}
            ${chart('Miesiąc po miesiącu', 'fa-chart-column', months.map((v, i) => ({ value: v, label: U.MONTHS_SHORT[i], month: i, tip: `${U.MONTHS[i]}: ${U.eps(v)} – kliknij po szczegóły` })), { highlight: topMonth })}
            <div class="sum-2col">
                ${weekdayChart(s)}
                ${tagCloud(s)}
            </div>
            ${rated.length > 1 ? `
            <section class="sum-section">
                <h4><i class="fas fa-scale-balanced"></i> Najlepsze i najsłabsze</h4>
                <div class="best-worst">
                    <div class="bw bw-best" data-open="${rated[0].id}">${cover(rated[0], 'bw-cover')}<div><span>Najlepsze w ${y}</span><strong>${U.esc(rated[0].title)}</strong><b>${rated[0].averageRating}</b></div></div>
                    <div class="bw bw-worst" data-open="${rated[rated.length - 1].id}">${cover(rated[rated.length - 1], 'bw-cover')}<div><span>Najsłabsze w ${y}</span><strong>${U.esc(rated[rated.length - 1].title)}</strong><b>${rated[rated.length - 1].averageRating}</b></div></div>
                </div>
            </section>` : ''}
            <section class="sum-section">
                <h4><i class="fas fa-ranking-star"></i> Top 3 w kategoriach</h4>
                <div class="chips" data-top3>
                    ${Calc.RATING_KEYS.map((k, i) => `<button class="chip ${i === 0 ? 'active' : ''}" data-k="${k}">${Calc.RATING_NAMES[k]}</button>`).join('')}
                </div>
                <div data-top3-out>${podium(top3('graphics'))}</div>
            </section>
            ${facts(s, { completed: completedIn(`${y}-`), started: startedIn(keys), periodName: `w ${y}` })}
            <div class="sum-nav">
                <button class="btn btn-ghost btn-sm" data-sum-year-view="${y - 1}"><i class="fas fa-chevron-left"></i> ${y - 1}</button>
                <button class="btn btn-ghost btn-sm" data-sum-year-view="${y + 1}">${y + 1} <i class="fas fa-chevron-right"></i></button>
            </div>`, (e) => {
            const chip = e.target.closest('[data-k]');
            if (chip) {
                const box = U.$('yearly-summary-content');
                box.querySelectorAll('[data-top3] .chip').forEach(c => c.classList.toggle('active', c === chip));
                box.querySelector('[data-top3-out]').innerHTML = podium(top3(chip.dataset.k));
                return;
            }
            navClick(e);
        });
    }

    return { collect, day: dayView, month, year };
})();
