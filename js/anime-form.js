/* =========================================================
   anime-form.js – jeden formularz anime, używany dwa razy:
   w zakładce „Dodaj” i w oknie edycji.
   ========================================================= */
const AnimeForm = (() => {
    const RATING_ICONS = { graphics: 'fa-paintbrush', music: 'fa-music', characters: 'fa-users', story: 'fa-book', fun: 'fa-face-laugh' };

    function template() {
        return `
        <div class="form-grid">
            <div class="form-col">
                <div class="field">
                    <label>Tytuł</label>
                    <input type="text" name="title" required placeholder="np. Kusuriya no Hitorigoto">
                </div>
                <div class="field">
                    <label>Tagi <small>oddziel średnikiem</small></label>
                    <input type="text" name="tags" placeholder="isekai; komedia; sport">
                </div>
                <div class="field">
                    <label>Status</label>
                    <div class="seg seg-status">
                        <label><input type="radio" name="status" value="watching" checked> Oglądane</label>
                        <label><input type="radio" name="status" value="completed"> Obejrzane</label>
                        <label><input type="radio" name="status" value="upcoming"> Nadchodzące</label>
                    </div>
                </div>
                <div class="row-3">
                    <div class="field">
                        <label>Sezony</label>
                        <input type="number" name="seasonCount" min="1" value="1">
                    </div>
                    <div class="field">
                        <label>Odcinki łącznie</label>
                        <input type="number" name="totalEpisodes" min="1" value="12">
                    </div>
                    <div class="field">
                        <label>Min/odcinek</label>
                        <input type="number" name="episodeLength" min="1" value="24">
                    </div>
                </div>
                <div class="seasons" data-seasons hidden></div>
                <div class="row-2">
                    <div class="field">
                        <label>Obejrzane odcinki</label>
                        <input type="number" name="watchedEpisodes" min="0" value="0">
                    </div>
                    <div class="field" data-single-rewatch>
                        <label>Powtórki <small>ile razy całość</small></label>
                        <input type="number" name="rewatch" min="0" value="0">
                    </div>
                </div>
                <div class="field" data-completed hidden>
                    <label>Data ukończenia <small>zostaw puste, jeśli nie pamiętasz</small></label>
                    <input type="date" name="completedDate">
                </div>

                <fieldset class="fieldset">
                    <legend><i class="fas fa-tower-broadcast"></i> Emisja</legend>
                    <div data-airing></div>
                </fieldset>
            </div>

            <div class="form-col">
                <div class="field">
                    <label>Okładka</label>
                    <div class="image-drop" data-image tabindex="0" role="button" aria-label="Wybierz obrazek">
                        <span class="image-empty"><i class="fas fa-image"></i> Kliknij, aby wybrać obrazek</span>
                    </div>
                    <input type="file" accept="image/*" data-file hidden>
                    <button type="button" class="btn btn-ghost btn-sm" data-remove-image hidden><i class="fas fa-trash"></i> Usuń obrazek</button>
                </div>

                <div class="field">
                    <label>Oceny <small>1–11</small></label>
                    <div class="ratings">
                        ${Calc.RATING_KEYS.map(k => `
                        <label class="rating-row">
                            <span><i class="fas ${RATING_ICONS[k]}"></i> ${Calc.RATING_NAMES[k]}</span>
                            <input type="range" name="${k}" min="1" max="11" step="1" value="5">
                            <output data-out="${k}">5</output>
                        </label>`).join('')}
                    </div>
                    <p class="avg-line">Średnia: <strong data-avg>5.0</strong></p>
                </div>
            </div>
        </div>
        <div class="form-actions">
            <button type="submit" class="btn btn-accent" data-submit><i class="fas fa-plus"></i> Dodaj anime</button>
            <button type="button" class="btn btn-ghost" data-cancel hidden>Anuluj</button>
        </div>`;
    }

    /**
     * @param {HTMLFormElement} form
     * @param {'add'|'edit'} mode
     */
    function create(form, mode) {
        form.innerHTML = template();
        const f = (name) => form.elements[name];
        const q = (sel) => form.querySelector(sel);
        let editing = null;
        let image = null;
        let airingEd = null;

        const seasons = Seasons.create(q('[data-seasons]'), f('seasonCount'), f('totalEpisodes'), { full: true, lengthInput: f('episodeLength') });

        if (mode === 'edit') {
            q('[data-submit]').innerHTML = '<i class="fas fa-floppy-disk"></i> Zapisz zmiany';
            q('[data-cancel]').hidden = false;
            q('[data-cancel]').onclick = () => UI.close('edit-anime-modal');
        }

        /* --- status / sezony --- */
        function syncStatus() {
            q('[data-completed]').hidden = f('status').value !== 'completed';
        }
        function syncSeasonMode() {
            q('[data-single-rewatch]').hidden = U.int(f('seasonCount').value, 1) > 1;
        }
        form.addEventListener('change', (e) => {
            if (e.target.name === 'status') syncStatus();
        });
        f('seasonCount').addEventListener('input', syncSeasonMode);
        f('totalEpisodes').addEventListener('input', () => airingEd && airingEd.preview());

        /* --- oceny --- */
        function syncRatings() {
            const r = {};
            Calc.RATING_KEYS.forEach(k => {
                r[k] = U.int(f(k).value, 5);
                q(`[data-out="${k}"]`).textContent = r[k];
            });
            q('[data-avg]').textContent = Calc.average(r).toFixed(1);
        }
        Calc.RATING_KEYS.forEach(k => f(k).addEventListener('input', syncRatings));

        /* --- obrazek --- */
        const drop = q('[data-image]');
        const fileInput = q('[data-file]');
        function showImage() {
            drop.innerHTML = image
                ? `<img src="${image}" alt="Okładka">`
                : '<span class="image-empty"><i class="fas fa-image"></i> Kliknij, aby wybrać obrazek</span>';
            q('[data-remove-image]').hidden = !image;
        }
        drop.onclick = () => fileInput.click();
        drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } };
        fileInput.onchange = async () => {
            const file = fileInput.files[0];
            fileInput.value = '';
            if (!file) return;
            if (!file.type.startsWith('image/')) return UI.toast('Wybierz plik obrazu', 'danger');
            image = await U.readImageFile(file);
            showImage();
        };
        q('[data-remove-image]').onclick = () => { image = null; showImage(); };

        /* --- wypełnianie / reset --- */
        function fill(a) {
            editing = a;
            f('title').value = a ? a.title : '';
            f('tags').value = a ? (a.tags || []).join('; ') : '';
            form.querySelector(`input[name="status"][value="${a ? a.status : 'watching'}"]`).checked = true;
            f('totalEpisodes').value = a ? a.totalEpisodes : 12;
            f('episodeLength').value = a ? a.episodeLength : 24;
            f('watchedEpisodes').value = a ? a.watchedEpisodes : 0;
            f('completedDate').value = a && a.completedDate ? a.completedDate : '';
            f('rewatch').value = a && a.seasonRewatches && !Calc.multiSeason(a) ? a.seasonRewatches[0] || 0 : 0;
            if (a) seasons.load(a); else seasons.reset();
            Calc.RATING_KEYS.forEach(k => { f(k).value = a ? a.ratings[k] : 5; });
            image = a ? a.image || null : null;
            airingEd = Airing.editor(q('[data-airing]'), a, { withToggle: true });
            showImage();
            syncRatings();
            syncStatus();
            syncSeasonMode();
        }

        /* --- zapis --- */
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const title = f('title').value.trim();
            if (!title) {
                f('title').focus();
                return UI.toast('Wpisz tytuł anime', 'warning');
            }
            const episodeLength = U.int(f('episodeLength').value, 24);
            const s = seasons.read(episodeLength);
            const totalEpisodes = U.int(f('totalEpisodes').value, 12) || 12;
            const ratings = {};
            Calc.RATING_KEYS.forEach(k => { ratings[k] = U.int(f(k).value, 5); });
            const status = f('status').value;

            const a = editing || { id: Store.newId(), createdAt: new Date().toISOString() };
            Object.assign(a, {
                title,
                status,
                tags: U.parseTags(f('tags').value),
                totalEpisodes,
                episodeLength,
                watchedEpisodes: Math.min(U.int(f('watchedEpisodes').value), totalEpisodes),
                ratings,
                averageRating: Calc.average(ratings),
                image: image || null,
                completedDate: status === 'completed' ? (f('completedDate').value || null) : null
            });

            if (s.count > 1) {
                Object.assign(a, {
                    seasons: s.seasons,
                    seasonEpisodeLengths: s.seasonEpisodeLengths,
                    seasonRewatches: s.seasonRewatches,
                    seasonCompletedDates: s.seasonCompletedDates
                });
            } else {
                const rewatch = U.int(f('rewatch').value);
                if (rewatch > 0 || Calc.hasSeasons(a)) {
                    // Jeden sezon – zapisujemy w tej samej strukturze, żeby liczyć powtórki
                    a.seasons = [totalEpisodes];
                    a.seasonEpisodeLengths = [episodeLength];
                    a.seasonRewatches = [rewatch];
                    a.seasonCompletedDates = [a.completedDate || null];
                }
            }

            const airing = airingEd.read();
            if (airing) a.airing = airing; else delete a.airing;

            if (!editing) Store.state.anime.push(a);
            Store.state.anime.sort((x, y) => x.title.localeCompare(y.title, 'pl'));
            if (!Store.saveAnime()) return;
            App.refresh();

            if (mode === 'edit') {
                UI.close('edit-anime-modal');
                UI.toast('Zmiany zapisane', 'success');
            } else {
                UI.toast(`Dodano „${title}”`, 'success');
                fill(null);
            }
        });

        fill(null);
        return { fill };
    }

    /* --- dwie instancje --- */
    let addForm, editForm;
    function init() {
        addForm = create(U.$('add-anime-form'), 'add');
        editForm = create(U.$('edit-anime-form'), 'edit');
    }
    function openEdit(id) {
        const a = Store.find(id);
        if (!a) return;
        editForm.fill(a);
        UI.open('edit-anime-modal');
    }

    return { init, openEdit };
})();
