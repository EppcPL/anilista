/* =========================================================
   calc.js – obliczenia: czas oglądania, postęp, sezony, streaki
   ========================================================= */
const Calc = (() => {
    const RATING_KEYS = ['graphics', 'music', 'characters', 'story', 'fun'];
    const RATING_NAMES = { graphics: 'Grafika', music: 'Muzyka', characters: 'Postacie', story: 'Fabuła', fun: 'Śmieszność' };
    const STATUS = {
        watching: { label: 'Oglądane', cls: 'st-watching' },
        completed: { label: 'Obejrzane', cls: 'st-completed' },
        upcoming: { label: 'Nadchodzące', cls: 'st-upcoming' }
    };

    const hasSeasons = (a) => Array.isArray(a.seasons) && a.seasons.length > 0;
    const multiSeason = (a) => Array.isArray(a.seasons) && a.seasons.length > 1;

    function seasonLength(a, i) {
        return (a.seasonEpisodeLengths && a.seasonEpisodeLengths[i]) || a.episodeLength || 24;
    }

    /** Ile odcinków liczymy jako obejrzane */
    function watchedCount(a) {
        return a.status === 'completed' ? a.totalEpisodes : a.watchedEpisodes;
    }

    /** Rozkład obejrzanych odcinków na sezony */
    function seasonBreakdown(a) {
        if (!hasSeasons(a)) return [];
        let left = a.watchedEpisodes;
        return a.seasons.map((count, i) => {
            const watched = Math.max(0, Math.min(left, count));
            left -= watched;
            return {
                index: i,
                count,
                watched,
                length: seasonLength(a, i),
                rewatch: (a.seasonRewatches && a.seasonRewatches[i]) || 0,
                completedDate: (a.seasonCompletedDates && a.seasonCompletedDates[i]) || null,
                done: count > 0 && watched >= count
            };
        });
    }

    /** Minuty pierwszego oglądania */
    function mainMinutes(a) {
        let watched = watchedCount(a);
        if (!hasSeasons(a)) return watched * (a.episodeLength || 24);
        let total = 0;
        a.seasons.forEach((count, i) => {
            const w = Math.max(0, Math.min(watched, count));
            total += w * seasonLength(a, i);
            watched -= w;
        });
        return total;
    }

    /** Minuty powtórek: pełne sezony (seasonRewatches) + pojedyncze odcinki (rewatchCount) */
    function rewatchMinutes(a) {
        let total = 0;
        if (Array.isArray(a.seasonRewatches) && hasSeasons(a)) {
            a.seasonRewatches.forEach((times, i) => {
                if (times > 0 && a.seasons[i]) total += times * a.seasons[i] * seasonLength(a, i);
            });
        }
        if (a.rewatchCount) total += a.rewatchCount * (a.episodeLength || 24);
        return total;
    }

    function rewatchTimes(a) {
        return (a.seasonRewatches || []).reduce((s, n) => s + (n || 0), 0);
    }

    /** Pełna długość anime w minutach */
    function fullMinutes(a) {
        if (!hasSeasons(a)) return a.totalEpisodes * (a.episodeLength || 24);
        return a.seasons.reduce((s, count, i) => s + count * seasonLength(a, i), 0);
    }

    const totalMinutes = (a) => mainMinutes(a) + rewatchMinutes(a);

    /** Ile razy (w przybliżeniu) obejrzano całość – 1 = raz, 2.5 = półtora powtórki */
    function viewCount(a) {
        const full = fullMinutes(a);
        if (!full) return 1;
        return 1 + rewatchMinutes(a) / full;
    }
    const isRewatched = (a) => rewatchMinutes(a) > 0;

    function progress(a) {
        if (a.status === 'completed') return 100;
        if (!a.totalEpisodes) return 0;
        return Math.min(100, Math.round(a.watchedEpisodes / a.totalEpisodes * 100));
    }

    function isComplete(a) {
        const total = multiSeason(a) ? a.seasons.reduce((s, n) => s + n, 0) : a.totalEpisodes;
        return total > 0 && a.watchedEpisodes >= total;
    }

    function average(ratings) {
        const sum = RATING_KEYS.reduce((s, k) => s + (Number(ratings[k]) || 0), 0);
        return Math.round(sum / RATING_KEYS.length * 10) / 10;
    }

    /** Ocena wg kategorii tier listy */
    const ratingFor = (a, category) => category === 'average' ? a.averageRating : a.ratings[category];

    /* ---------- aktywność ---------- */
    function activityLevel(episodes) {
        if (!episodes) return 0;
        if (episodes <= 2) return 1;
        if (episodes <= 4) return 2;
        if (episodes <= 6) return 3;
        if (episodes <= 8) return 4;
        return 5;
    }

    /** Minuty dla wpisu aktywności */
    function detailMinutes(detail) {
        const a = Store.find(detail.animeId);
        return detail.episodes * (a ? a.episodeLength || 24 : 24);
    }

    function currentStreak() {
        const act = Store.state.activity;
        let d = new Date();
        // Jeśli dziś jeszcze nic, streak liczy się od wczoraj
        if (!(act[U.dateKey(d)] > 0)) d = U.addDays(d, -1);
        let streak = 0;
        while (act[U.dateKey(d)] > 0) {
            streak++;
            d = U.addDays(d, -1);
        }
        return streak;
    }

    /** Najdłuższy streak z listy posortowanych dat */
    function longestStreak(dates) {
        dates = dates || Object.keys(Store.state.activity).filter(k => Store.state.activity[k] > 0).sort();
        if (!dates.length) return { length: 0, start: null, end: null };
        let best = { length: 1, start: dates[0], end: dates[0] };
        let cur = { length: 1, start: dates[0] };
        for (let i = 1; i < dates.length; i++) {
            const next = U.dateKey(U.addDays(U.parseDate(dates[i - 1]), 1));
            if (dates[i] === next) {
                cur.length++;
            } else {
                cur = { length: 1, start: dates[i] };
            }
            if (cur.length > best.length) best = { length: cur.length, start: cur.start, end: dates[i] };
        }
        return best;
    }

    return {
        RATING_KEYS, RATING_NAMES, STATUS,
        hasSeasons, multiSeason, seasonLength, watchedCount, seasonBreakdown,
        mainMinutes, rewatchMinutes, rewatchTimes, fullMinutes, totalMinutes, viewCount, isRewatched,
        progress, isComplete, average, ratingFor,
        activityLevel, detailMinutes, currentStreak, longestStreak
    };
})();
