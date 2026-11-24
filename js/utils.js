/* =========================================================
   utils.js – małe funkcje pomocnicze: daty, formatowanie, DOM
   ========================================================= */
const U = (() => {
    const MONTHS = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
        'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
    const MONTHS_SHORT = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
    // Tydzień od poniedziałku
    const DAYS_SHORT = ['Pon', 'Wto', 'Śro', 'Czw', 'Pią', 'Sob', 'Nie'];
    const DAYS_LONG = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'];
    // Kolejność jak Date.getDay() (0 = niedziela)
    const DAY_NAMES = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];

    const $ = (id) => document.getElementById(id);
    const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    /** Bezpieczne wstawianie tekstu do HTML */
    function esc(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /** Klucz daty w LOKALNEJ strefie (YYYY-MM-DD) – bez przesunięć UTC */
    function dateKey(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    const todayKey = () => dateKey(new Date());

    /** 'YYYY-MM-DD' -> Date o północy czasu lokalnego */
    function parseDate(str, time = '') {
        if (!str) return null;
        const [y, m, d] = str.split('-').map(Number);
        const [hh, mm] = (time || '0:0').split(':').map(Number);
        return new Date(y, m - 1, d, hh || 0, mm || 0);
    }

    function addDays(date, n) {
        const d = new Date(date);
        d.setDate(d.getDate() + n);
        return d;
    }

    /** Poniedziałek tygodnia, w którym jest data */
    function startOfWeek(date) {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const shift = (d.getDay() + 6) % 7;
        return addDays(d, -shift);
    }

    /** Indeks dnia tygodnia od poniedziałku (0..6) */
    const weekdayIndex = (date) => (date.getDay() + 6) % 7;

    function fmtDate(str) {
        const d = typeof str === 'string' ? parseDate(str) : str;
        if (!d) return 'Data nieznana';
        return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    /** "Dzisiaj", "Wczoraj" albo krótka data */
    function fmtDateRelative(str) {
        if (!str) return '';
        const key = typeof str === 'string' ? str.slice(0, 10) : dateKey(str);
        if (key === todayKey()) return 'Dzisiaj';
        if (key === dateKey(addDays(new Date(), -1))) return 'Wczoraj';
        return parseDate(key).toLocaleDateString('pl-PL');
    }

    function fmtClock(date) {
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    /** Czas w minutach -> "12.5h", "3d" itd. */
    function fmtHours(minutes, format = 'hours') {
        const hours = minutes / 60;
        switch (format) {
            case 'days': return `${Math.round(hours / 24 * 10) / 10}d`;
            case 'months': return `${Math.round(hours / 24 / 30 * 10) / 10}m`;
            case 'years': return `${Math.round(hours / 24 / 365 * 10) / 10}y`;
            default: return `${Math.round(hours * 10) / 10}h`;
        }
    }

    /** Czas w minutach -> "2h 15m" / "1d 3h" */
    function fmtDuration(minutes) {
        minutes = Math.round(minutes);
        const d = Math.floor(minutes / 1440);
        const h = Math.floor((minutes % 1440) / 60);
        const m = minutes % 60;
        if (d > 0) return `${d}d ${h}h`;
        if (h > 0) return m ? `${h}h ${m}m` : `${h}h`;
        return `${m}m`;
    }

    /** Polska odmiana: 1 odcinek, 2 odcinki, 5 odcinków */
    function plural(n, one, few, many) {
        if (n === 1) return one;
        const l10 = n % 10, l100 = n % 100;
        if (l10 >= 2 && l10 <= 4 && (l100 < 12 || l100 > 14)) return few;
        return many;
    }
    const eps = (n) => `${n} ${plural(n, 'odcinek', 'odcinki', 'odcinków')}`;
    const days = (n) => `${n} ${n === 1 ? 'dzień' : 'dni'}`;

    /** Klucz tagu bez względu na wielkość liter ("Isekai" = "isekai") */
    const tagKey = (t) => String(t || '').trim().toLocaleLowerCase('pl');

    /** Tekst z pola -> lista tagów bez duplikatów (wielkość liter nie ma znaczenia) */
    function parseTags(raw) {
        const seen = new Set();
        return (raw || '').split(/;|\n/).map(t => t.trim()).filter(t => {
            const k = tagKey(t);
            if (!k || seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    }

    const int = (v, fallback = 0) => {
        const n = parseInt(v, 10);
        return Number.isNaN(n) ? fallback : n;
    };

    /** Porównanie ID niezależne od typu (stare importy mają ID z ułamkiem) */
    const sameId = (a, b) => String(a) === String(b);

    function copyText(text) {
        if (navigator.clipboard) return navigator.clipboard.writeText(text);
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        return Promise.resolve();
    }

    /** Zmniejsza obrazek przed zapisem, żeby nie zapchać localStorage */
    function readImageFile(file, maxSize = 640) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => resolve(reader.result);
                img.onload = () => {
                    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/jpeg', 0.82));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    return {
        MONTHS, MONTHS_SHORT, DAYS_SHORT, DAYS_LONG, DAY_NAMES,
        $, qsa, esc, dateKey, todayKey, parseDate, addDays, startOfWeek, weekdayIndex,
        fmtDate, fmtDateRelative, fmtClock, fmtHours, fmtDuration, plural, eps, days,
        parseTags, tagKey, int, sameId, copyText, readImageFile
    };
})();
