/* =========================================================
   airing.js – NOWE: harmonogram emisji i zaległe odcinki.

   Każde anime może mieć pole `airing`:
     {
       date: 'YYYY-MM-DD',   // dzień emisji odcinka nr `episode`
       time: 'HH:MM',        // godzina (opcjonalnie)
       episode: 7,           // numer odcinka (licząc wszystkie sezony)
       interval: 7,          // co ile dni wychodzi nowy odcinek
       skipped: ['YYYY-MM-DD'] // tygodnie przerwy
     }
   Liczba wydanych odcinków = odcinki przed `episode` + terminy, które już minęły.
   Zaległe = wydane − obejrzane.
   ========================================================= */
const Airing = (() => {
    let weekOffset = 0;
    let lastBehindTotal = null;

    /* ---------------- logika ---------------- */

    /** Wszystkie terminy emisji od punktu odniesienia */
    function schedule(anime) {
        const a = anime.airing;
        if (!a || !a.date) return [];
        const interval = Math.max(1, U.int(a.interval, 7));
        const skipped = new Set(a.skipped || []);
        const total = anime.totalEpisodes || 0;
        const horizon = U.addDays(new Date(), 120);
        const out = [];
        let ep = Math.max(1, U.int(a.episode, 1));
        let d = U.parseDate(a.date, a.time);
        for (let guard = 0; guard < 1500; guard++) {
            if (total && ep > total) break;
            if (!total && d > horizon) break;
            const key = U.dateKey(d);
            if (skipped.has(key)) {
                d = U.addDays(d, interval);
                continue;
            }
            out.push({ ep, at: new Date(d), key });
            ep++;
            d = U.addDays(d, interval);
        }
        return out;
    }

    /** Stan emisji dla jednego anime */
    function info(anime, now = new Date()) {
        if (!anime || !anime.airing || !anime.airing.date) return null;
        const list = schedule(anime);
        const before = Math.max(0, U.int(anime.airing.episode, 1) - 1);
        let aired = before + list.filter(r => r.at <= now).length;
        if (anime.totalEpisodes) aired = Math.min(aired, anime.totalEpisodes);
        const watched = Calc.watchedCount(anime);
        const behind = Math.max(0, aired - watched);
        const next = list.find(r => r.at > now) || null;
        const firstMissing = list.find(r => r.ep === watched + 1 && r.at <= now) || null;
        const finished = !next && anime.totalEpisodes > 0 && aired >= anime.totalEpisodes;
        return { list, aired, watched, behind, next, firstMissing, finished };
    }

    /** Anime z harmonogramem, których nie skończyłeś */
    function tracked() {
        return Store.state.anime.filter(a => a.airing && a.airing.date && a.status !== 'completed');
    }

    function overdue() {
        return tracked()
            .map(a => ({ anime: a, info: info(a) }))
            .filter(x => x.info && x.info.behind > 0)
            .sort((x, y) => (x.info.firstMissing?.at || 0) - (y.info.firstMissing?.at || 0));
    }

    const totalBehind = () => overdue().reduce((s, x) => s + x.info.behind, 0);

    /** "za 3 godz.", "jutro 18:00", "piątek 18:00" */
    function relTime(date, now = new Date()) {
        const diff = date - now;
        const clock = U.fmtClock(date);
        const hasTime = clock !== '00:00';
        if (diff <= 0) return 'już jest';
        if (diff < 3600e3) return `za ${Math.max(1, Math.round(diff / 60e3))} min`;
        const dayDiff = Math.round((U.parseDate(U.dateKey(date)) - U.parseDate(U.dateKey(now))) / 864e5);
        if (dayDiff === 0) return hasTime ? `dziś o ${clock}` : 'dziś';
        if (dayDiff === 1) return hasTime ? `jutro o ${clock}` : 'jutro';
        if (dayDiff < 7) return `${U.DAY_NAMES[date.getDay()]}${hasTime ? ' ' + clock : ''}`;
        return `${date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}${hasTime ? ' ' + clock : ''}`;
    }

    /** Krótka plakietka na kartę w kolekcji */
    function badge(anime) {
        const i = info(anime);
        if (!i || anime.status === 'completed') return '';
        if (i.behind > 0) {
            return `<span class="air-badge air-behind" title="Wyszło ${i.aired}, obejrzane ${i.watched}"><i class="fas fa-bell"></i> Zaległe: ${U.eps(i.behind)}</span>`;
        }
        if (i.next) {
            return `<span class="air-badge air-next"><i class="fas fa-tower-broadcast"></i> Odc. ${i.next.ep} ${relTime(i.next.at)}</span>`;
        }
        if (i.finished) return `<span class="air-badge air-done"><i class="fas fa-flag-checkered"></i> Emisja zakończona</span>`;
        return '';
    }

    /* ---------------- edytor harmonogramu ---------------- */

    /** Ostatnie wystąpienie dnia tygodnia (o danej godzinie) nie później niż teraz */
    function lastWeekday(weekday, time, now = new Date()) {
        let d = U.parseDate(U.dateKey(now), time);
        while (U.weekdayIndex(d) !== weekday || d > now) d = U.addDays(d, -1);
        return d;
    }

    /**
     * Komponent formularza harmonogramu.
     * mode 'week': dzień tygodnia + godzina + najnowszy wydany odcinek (najprostsze)
     * mode 'date': dokładna data konkretnego odcinka
     */
    function editor(container, anime, { withToggle = false } = {}) {
        const a = anime && anime.airing;
        const i = anime ? info(anime) : null;
        const uid = 'air' + Math.random().toString(36).slice(2, 7);
        const anchor = a ? U.parseDate(a.date, a.time) : null;
        const weekday = anchor ? U.weekdayIndex(anchor) : U.weekdayIndex(new Date());
        const latest = i ? i.aired : (anime ? anime.watchedEpisodes : 0);
        const interval = a ? U.int(a.interval, 7) : 7;

        container.innerHTML = `
            ${withToggle ? `<label class="check"><input type="checkbox" class="air-on" ${a ? 'checked' : ''}> Anime jest w trakcie emisji – pokazuj zaległe odcinki</label>` : ''}
            <div class="air-fields" ${withToggle && !a ? 'hidden' : ''}>
                <div class="seg" role="radiogroup">
                    <label><input type="radio" name="${uid}-mode" value="week" checked> Co tydzień w dniu…</label>
                    <label><input type="radio" name="${uid}-mode" value="date"> Od konkretnej daty</label>
                </div>
                <div class="air-week">
                    <div class="weekday-pick">${U.DAYS_SHORT.map((d, n) => `
                        <label><input type="radio" name="${uid}-wd" value="${n}" ${n === weekday ? 'checked' : ''}><span>${d}</span></label>`).join('')}
                    </div>
                    <div class="row-2">
                        <div class="field">
                            <label>Godzina <small>opcjonalnie</small></label>
                            <input type="time" class="air-time" value="${a ? a.time || '' : ''}">
                        </div>
                        <div class="field">
                            <label>Najnowszy wydany odcinek <small>0 = przed premierą</small></label>
                            <input type="number" class="air-latest" min="0" value="${latest}">
                        </div>
                    </div>
                </div>
                <div class="air-date" hidden>
                    <div class="row-2">
                        <div class="field">
                            <label>Data emisji odcinka</label>
                            <input type="date" class="air-anchor-date" value="${a ? a.date : U.todayKey()}">
                        </div>
                        <div class="field">
                            <label>Numer tego odcinka</label>
                            <input type="number" class="air-anchor-ep" min="1" value="${a ? a.episode : Math.max(1, latest + 1)}">
                        </div>
                    </div>
                    <div class="field">
                        <label>Godzina</label>
                        <input type="time" class="air-time2" value="${a ? a.time || '' : ''}">
                    </div>
                </div>
                <div class="field">
                    <label>Jak często</label>
                    <select class="air-interval">
                        <option value="7" ${interval === 7 ? 'selected' : ''}>Co tydzień</option>
                        <option value="14" ${interval === 14 ? 'selected' : ''}>Co dwa tygodnie</option>
                        <option value="1" ${interval === 1 ? 'selected' : ''}>Codziennie</option>
                    </select>
                </div>
                <p class="air-preview note"></p>
            </div>`;

        const $ = (sel) => container.querySelector(sel);
        const mode = () => container.querySelector(`input[name="${uid}-mode"]:checked`).value;

        function syncMode() {
            $('.air-week').hidden = mode() !== 'week';
            $('.air-date').hidden = mode() !== 'date';
        }

        /** Zbuduj obiekt airing z pól (bez zapisu) */
        function build() {
            const intervalVal = U.int($('.air-interval').value, 7);
            const skipped = (a && a.skipped) || [];
            if (mode() === 'date') {
                return {
                    date: $('.air-anchor-date').value || U.todayKey(),
                    time: $('.air-time2').value || '',
                    episode: Math.max(1, U.int($('.air-anchor-ep').value, 1)),
                    interval: intervalVal,
                    skipped
                };
            }
            const wd = U.int(container.querySelector(`input[name="${uid}-wd"]:checked`).value);
            const time = $('.air-time').value || '';
            const latestEp = Math.max(0, U.int($('.air-latest').value));
            let date;
            let episode;
            if (latestEp >= 1) {
                date = lastWeekday(wd, time);
                episode = latestEp;
            } else {
                // premiera jeszcze przed nami – najbliższy taki dzień
                date = lastWeekday(wd, time);
                date = U.addDays(date, 7);
                episode = 1;
            }
            const key = U.dateKey(date);
            return { date: key, time, episode, interval: intervalVal, skipped: skipped.filter(s => s > key) };
        }

        function preview() {
            if (withToggle && !$('.air-on').checked) return;
            const tmp = { ...(anime || { watchedEpisodes: 0, status: 'watching' }), airing: build() };
            const total = U.int((container.closest('form')?.querySelector('[name="totalEpisodes"]') || {}).value, 0);
            if (total) tmp.totalEpisodes = total;
            const inf = info(tmp);
            const parts = [`Wydane odcinki: <b>${inf.aired}</b>`];
            if (inf.next) parts.push(`następny: <b>odc. ${inf.next.ep}</b> – ${relTime(inf.next.at)}`);
            else if (inf.finished) parts.push('emisja zakończona');
            if (anime) parts.push(inf.behind > 0 ? `zaległe: <b>${inf.behind}</b>` : 'jesteś na bieżąco');
            $('.air-preview').innerHTML = parts.join(' · ');
        }

        container.addEventListener('input', preview);
        container.addEventListener('change', (e) => {
            if (e.target.name === `${uid}-mode`) syncMode();
            if (e.target.classList.contains('air-on')) $('.air-fields').hidden = !e.target.checked;
            preview();
        });
        syncMode();
        preview();

        return {
            /** null = brak harmonogramu */
            read() {
                if (withToggle && !$('.air-on').checked) return null;
                return build();
            },
            preview
        };
    }

    /* ---------------- okno harmonogramu ---------------- */

    function openEditor(animeId) {
        const anime = Store.find(animeId);
        if (!anime) return;
        U.$('airing-modal-title').textContent = anime.title;
        const body = U.$('airing-modal-body');
        body.innerHTML = `<div class="air-editor"></div>
            <div class="air-skips"></div>
            <div class="form-actions">
                <button class="btn btn-accent" data-act="save"><i class="fas fa-check"></i> Zapisz harmonogram</button>
                ${anime.airing ? `
                <button class="btn btn-ghost" data-act="skip" title="Następny odcinek wyjdzie tydzień później"><i class="fas fa-mug-hot"></i> Przerwa w emisji</button>
                <button class="btn btn-ghost btn-danger-text" data-act="remove"><i class="fas fa-trash"></i> Usuń harmonogram</button>` : ''}
            </div>`;
        const ed = editor(body.querySelector('.air-editor'), anime);

        const skips = (anime.airing && anime.airing.skipped || []).filter(s => s >= U.todayKey());
        body.querySelector('.air-skips').innerHTML = skips.length
            ? `<p class="muted">Przerwy: ${skips.map(s => `<button class="chip chip-sm" data-unskip="${s}">${U.fmtDateRelative(s)} <i class="fas fa-xmark"></i></button>`).join(' ')}</p>`
            : '';

        body.onclick = (e) => {
            const act = e.target.closest('[data-act]')?.dataset.act;
            const unskip = e.target.closest('[data-unskip]')?.dataset.unskip;
            if (unskip) {
                anime.airing.skipped = anime.airing.skipped.filter(s => s !== unskip);
                saveAndRefresh('Przerwa usunięta');
                openEditor(animeId);
                return;
            }
            if (act === 'save') {
                anime.airing = ed.read();
                saveAndRefresh('Harmonogram zapisany');
                UI.close('airing-modal');
            } else if (act === 'skip') {
                const inf = info(anime);
                if (!inf.next) return UI.toast('Brak kolejnego terminu do przesunięcia', 'warning');
                anime.airing.skipped = [...(anime.airing.skipped || []), inf.next.key];
                saveAndRefresh(`Odcinek ${inf.next.ep} przesunięty o ${anime.airing.interval === 1 ? 'dzień' : 'tydzień'}`);
                openEditor(animeId);
            } else if (act === 'remove') {
                if (!confirm('Usunąć harmonogram emisji tego anime?')) return;
                delete anime.airing;
                saveAndRefresh('Harmonogram usunięty');
                UI.close('airing-modal');
            }
        };
        UI.open('airing-modal');
    }

    function saveAndRefresh(msg) {
        Store.saveAnime();
        App.refresh();
        if (msg) UI.toast(msg, 'success');
    }

    /* ---------------- widok „Emisje” ---------------- */

    function cover(anime, cls = 'thumb') {
        return anime.image
            ? `<img class="${cls}" src="${anime.image}" alt="">`
            : `<span class="${cls} thumb-empty">${U.esc(anime.title.charAt(0).toUpperCase())}</span>`;
    }

    function renderHead(list) {
        const behind = list.reduce((s, x) => s + x.info.behind, 0);
        const head = U.$('onair-headline');
        const sub = U.$('onair-subline');
        const all = tracked();
        if (!all.length) {
            head.textContent = 'Ramówka';
            sub.innerHTML = 'Ustaw dzień emisji dla oglądanego anime, a tutaj zobaczysz, kiedy wychodzą nowe odcinki i co masz do nadrobienia.';
            return;
        }
        head.textContent = behind > 0
            ? `${behind} ${U.plural(behind, 'odcinek czeka', 'odcinki czekają', 'odcinków czeka')} na Ciebie`
            : 'Jesteś na bieżąco';
        const upcoming = all.map(a => ({ a, i: info(a) })).filter(x => x.i && x.i.next)
            .sort((x, y) => x.i.next.at - y.i.next.at)[0];
        sub.innerHTML = upcoming
            ? `Następny: <b>${U.esc(upcoming.a.title)}</b>, odcinek ${upcoming.i.next.ep} – ${relTime(upcoming.i.next.at)}`
            : 'Brak zaplanowanych odcinków.';
    }

    function renderOverdue(list) {
        const box = U.$('overdue-list');
        if (!list.length) { box.innerHTML = ''; return; }
        box.innerHTML = list.map(({ anime, info: i }) => {
            const from = i.watched + 1, to = i.aired;
            const since = i.firstMissing ? U.fmtDateRelative(U.dateKey(i.firstMissing.at)).toLowerCase() : '';
            return `
            <article class="overdue" data-id="${anime.id}">
                ${cover(anime)}
                <div class="overdue-info">
                    <h3><button class="link" data-open="${anime.id}">${U.esc(anime.title)}</button></h3>
                    <p>${from === to ? `Odcinek ${from}` : `Odcinki ${from}–${to}`}${since ? `, czeka od: ${since}` : ''}</p>
                </div>
                <strong class="overdue-count" title="Zaległe odcinki">${i.behind}</strong>
                <div class="overdue-actions">
                    <button class="btn btn-accent btn-sm" data-watch="1" data-id="${anime.id}"><i class="fas fa-check"></i> Obejrzane +1</button>
                    ${i.behind > 1 ? `<button class="btn btn-ghost btn-sm" data-watch="${i.behind}" data-id="${anime.id}">Nadrobione (${i.behind})</button>` : ''}
                </div>
            </article>`;
        }).join('');
    }

    function renderSchedule() {
        const box = U.$('schedule');
        const start = U.addDays(U.startOfWeek(new Date()), weekOffset * 7);
        const end = U.addDays(start, 7);
        const now = new Date();
        const today = U.todayKey();
        const items = Array.from({ length: 7 }, () => []);

        Store.state.anime.filter(a => a.airing && a.airing.date).forEach(a => {
            schedule(a).forEach(r => {
                if (r.at >= start && r.at < end) {
                    const watched = Calc.watchedCount(a) >= r.ep;
                    const state = watched ? 'watched' : r.at <= now ? 'behind' : 'soon';
                    items[U.weekdayIndex(r.at)].push({ a, r, state });
                }
            });
        });

        const label = weekOffset === 0 ? 'Ten tydzień' : weekOffset === 1 ? 'Następny tydzień' : weekOffset === -1 ? 'Poprzedni tydzień'
            : `${start.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })} – ${U.addDays(end, -1).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}`;
        U.$('week-today').textContent = label;

        box.innerHTML = items.map((list, d) => {
            const day = U.addDays(start, d);
            const isToday = U.dateKey(day) === today;
            list.sort((x, y) => x.r.at - y.r.at);
            return `
            <div class="day-col ${isToday ? 'is-today' : ''}">
                <div class="day-head">
                    <span class="day-name">${U.DAYS_SHORT[d]}</span>
                    <span class="day-num">${day.getDate()}</span>
                </div>
                <div class="day-items">
                    ${list.map(({ a, r, state }) => {
                        const clock = U.fmtClock(r.at);
                        return `
                        <button class="slot slot-${state}" data-open="${a.id}" title="${U.esc(a.title)} – odcinek ${r.ep}">
                            <span class="slot-time">${clock === '00:00' ? '—' : clock}</span>
                            <span class="slot-title">${U.esc(a.title)}</span>
                            <span class="slot-ep">odc. ${r.ep}${state === 'watched' ? ' <i class="fas fa-check"></i>' : ''}</span>
                        </button>`;
                    }).join('')}
                </div>
            </div>`;
        }).join('');
    }

    function renderUnscheduled() {
        const box = U.$('unscheduled');
        const list = Store.state.anime.filter(a => a.status === 'watching' && !a.airing);
        if (!list.length) { box.innerHTML = ''; return; }
        box.innerHTML = `
            <h3>Oglądasz bez harmonogramu</h3>
            <p class="muted">Jeśli któreś z nich jeszcze wychodzi, ustaw dzień emisji.</p>
            <div class="chips">${list.map(a => `
                <button class="chip" data-schedule="${a.id}"><i class="fas fa-calendar-plus"></i> ${U.esc(a.title)}</button>`).join('')}
            </div>
            ${'Notification' in window && Notification.permission === 'default' ? `
            <p class="muted notif-hint"><button class="link" id="enable-notifications"><i class="fas fa-bell"></i> Włącz powiadomienia przeglądarki</button> – dostaniesz znak, gdy wyjdzie nowy odcinek, a strona będzie otwarta.</p>` : ''}`;
    }

    function updateBadge() {
        const n = totalBehind();
        const b = U.$('nav-airing-badge');
        b.hidden = n === 0;
        b.textContent = n > 99 ? '99+' : n;
        document.title = n > 0 ? `(${n}) anilista` : 'anilista';
        return n;
    }

    function render() {
        const list = overdue();
        renderHead(list);
        renderOverdue(list);
        renderSchedule();
        renderUnscheduled();
        updateBadge();
    }

    /** Co minutę sprawdzaj, czy nie wyszedł nowy odcinek */
    function tick() {
        const n = totalBehind();
        if (lastBehindTotal !== null && n > lastBehindTotal) {
            UI.toast('Wyszedł nowy odcinek! Zajrzyj do zakładki Emisje.', 'info', () => { location.hash = '#start'; });
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('anilista', { body: `Masz ${U.eps(n)} do nadrobienia.` });
            }
        }
        lastBehindTotal = n;
        render();
    }

    function init() {
        U.$('week-prev').onclick = () => { weekOffset--; renderSchedule(); };
        U.$('week-next').onclick = () => { weekOffset++; renderSchedule(); };
        U.$('week-today').onclick = () => { weekOffset = 0; renderSchedule(); };

        U.$('start').addEventListener('click', (e) => {
            const watch = e.target.closest('[data-watch]');
            if (watch) {
                Episodes.add(watch.dataset.id, U.int(watch.dataset.watch, 1), U.todayKey(), false);
                return;
            }
            const sched = e.target.closest('[data-schedule]');
            if (sched) return openEditor(sched.dataset.schedule);
            const open = e.target.closest('[data-open]');
            if (open) return Details.open(open.dataset.open);
            if (e.target.closest('#enable-notifications')) {
                Notification.requestPermission().then(() => render());
            }
        });

        lastBehindTotal = totalBehind();
        if (lastBehindTotal > 0) {
            setTimeout(() => UI.toast(`Masz ${U.eps(lastBehindTotal)} do nadrobienia`, 'info', () => { location.hash = '#start'; }), 600);
        }
        setInterval(tick, 60 * 1000);
    }

    return { schedule, info, overdue, totalBehind, badge, relTime, editor, openEditor, render, updateBadge, init };
})();
