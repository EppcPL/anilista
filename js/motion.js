/* =========================================================
   motion.js – animacje i płynne przejścia
   (wejścia elementów, liczniki, przechylanie kart, fale,
    konfetti, animowane zamykanie okien, wskaźnik w menu)
   Wszystko wyłącza się samo przy „ogranicz ruch” w systemie.
   ========================================================= */
const FX = (() => {
    const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = () => window.matchMedia('(pointer: fine)').matches;

    /* ---------- wejście elementów „jeden po drugim” ---------- */
    const STAGGER = [
        '.stats > *', '.wrapped > *', '.anime-grid > .anime-card', '.anime-grid > .series-card', '.series-list > li', '.related > *', '.overdue-list > *', '.schedule > .day-col',
        '.planner-list > *', '.tier-row', '.rewatch-grid > *', '.data-grid > *', '.now-row > *',
        '.sum-tiles > *', '.rank > li', '.facts > li', '.podium > li', '.form-grid > .form-col', '.chips > .chip'
    ];

    function stagger(root, selectors = STAGGER) {
        if (reduced() || !root) return;
        const groups = new Map();
        selectors.forEach(sel => root.querySelectorAll(sel).forEach(el => {
            const parent = el.parentElement;
            if (!groups.has(parent)) groups.set(parent, []);
            if (!groups.get(parent).includes(el)) groups.get(parent).push(el);
        }));
        groups.forEach(list => list.forEach((el, i) => {
            el.classList.remove('fx-in');
            el.style.setProperty('--i', Math.min(i, 14));
            void el.offsetWidth; // restart animacji
            el.classList.add('fx-in');
            el.addEventListener('animationend', () => el.classList.remove('fx-in'), { once: true });
        }));
    }

    /* ---------- liczniki od zera ---------- */
    function countUp(root) {
        if (reduced() || !root) return;
        root.querySelectorAll('[data-count], .stat-value, .sum-big, .overdue-count').forEach(el => {
            const text = el.dataset.countText || el.innerHTML;
            el.dataset.countText = text;
            const m = text.match(/^([^0-9-]*)(-?\d+(?:[.,]\d+)?)(.*)$/s);
            if (!m) return;
            const [, pre, num, post] = m;
            const target = parseFloat(num.replace(',', '.'));
            const decimals = (num.split(/[.,]/)[1] || '').length;
            const start = performance.now();
            const dur = 900 + Math.min(600, target * 2);
            const step = (now) => {
                const t = Math.min(1, (now - start) / dur);
                const e = 1 - Math.pow(1 - t, 3);
                el.innerHTML = `${pre}${(target * e).toFixed(decimals)}${post}`;
                if (t < 1) requestAnimationFrame(step);
                else el.innerHTML = text;
            };
            requestAnimationFrame(step);
        });
    }

    /* ---------- elementy pojawiające się przy przewijaniu ---------- */
    let observer = null;
    function reveal(root) {
        if (reduced() || !root || !('IntersectionObserver' in window)) return;
        observer = observer || new IntersectionObserver((entries) => {
            entries.forEach(en => {
                if (en.isIntersecting) {
                    en.target.classList.add('fx-visible');
                    observer.unobserve(en.target);
                }
            });
        }, { rootMargin: '0px 0px -8% 0px' });
        root.querySelectorAll('.block, .sum-section, .unscheduled, .schedule, .best-worst').forEach(el => {
            if (el.classList.contains('fx-visible')) return;
            el.classList.add('fx-reveal');
            observer.observe(el);
        });
    }

    /* ---------- fala w kalendarzu ---------- */
    function wave(root) {
        if (reduced() || !root) return;
        root.querySelectorAll('.heatmap, .month-grid, .month-bars, .chart').forEach(el => {
            el.classList.remove('fx-wave');
            void el.offsetWidth;
            el.classList.add('fx-wave');
            setTimeout(() => el.classList.remove('fx-wave'), 1600);
        });
    }

    /** Wszystko naraz – przy wejściu do zakładki albo otwarciu okna */
    function enter(root) {
        if (!root) return;
        stagger(root);
        countUp(root);
        reveal(root);
        wave(root);
    }

    /* ---------- przechylanie kart za kursorem ---------- */
    const TILT = '.anime-card, .series-card, .wrapped-card, .rewatch-card, .now-card, .stat';
    function initTilt() {
        if (!finePointer()) return;
        let current = null;
        document.addEventListener('pointermove', (e) => {
            if (reduced()) return;
            const card = e.target.closest(TILT);
            if (current && current !== card) resetTilt(current);
            current = card;
            if (!card) return;
            const r = card.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
            const strength = card.classList.contains('stat') ? 4 : 6;
            card.style.setProperty('--rx', `${(0.5 - y) * strength}deg`);
            card.style.setProperty('--ry', `${(x - 0.5) * strength}deg`);
            card.style.setProperty('--mx', `${x * 100}%`);
            card.style.setProperty('--my', `${y * 100}%`);
            card.classList.add('fx-tilt');
        }, { passive: true });
        document.addEventListener('pointerleave', () => current && resetTilt(current));
    }
    function resetTilt(card) {
        card.classList.remove('fx-tilt');
        card.style.removeProperty('--rx');
        card.style.removeProperty('--ry');
    }

    /* ---------- fala po kliknięciu (ripple) ---------- */
    function initRipple() {
        document.addEventListener('pointerdown', (e) => {
            if (reduced()) return;
            const el = e.target.closest('.btn, .chip, .nav-item, .btn-icon, .slot, .month-bar, .cal-mode button');
            if (!el || el.disabled) return;
            const r = el.getBoundingClientRect();
            const size = Math.max(r.width, r.height) * 2;
            const span = document.createElement('span');
            span.className = 'ripple';
            span.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
            el.appendChild(span);
            span.addEventListener('animationend', () => span.remove(), { once: true });
        }, { passive: true });
    }

    /* ---------- przesuwany wskaźnik w menu ---------- */
    function movePill() {
        const nav = document.querySelector('.nav');
        if (!nav) return;
        let pill = nav.querySelector('.nav-pill');
        if (!pill) {
            pill = document.createElement('span');
            pill.className = 'nav-pill';
            nav.prepend(pill);
        }
        const active = nav.querySelector('.nav-item.active');
        if (!active) { pill.style.opacity = 0; return; }
        pill.style.opacity = 1;
        pill.style.width = `${active.offsetWidth}px`;
        pill.style.height = `${active.offsetHeight}px`;
        pill.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
    }

    /* ---------- płynna zmiana zakładki ---------- */
    let first = true;
    function switchView(apply, root) {
        const done = () => { movePill(); enter(root()); };
        if (first || reduced() || !document.startViewTransition) {
            first = false;
            apply();
            done();
            return;
        }
        const t = document.startViewTransition(() => apply());
        t.updateCallbackDone.then(done);
    }

    /* ---------- animowane zamykanie okien ---------- */
    function closeDialog(d) {
        if (!d || !d.open || d.classList.contains('closing')) return;
        if (reduced()) { d.close(); return; }
        d.classList.add('closing');
        // jeśli okno zostanie ponownie otwarte w trakcie animacji, nie zamykamy go
        const finish = () => {
            if (!d.classList.contains('closing')) return;
            d.classList.remove('closing');
            if (d.open) d.close();
        };
        d.addEventListener('animationend', (e) => { if (e.target === d) finish(); }, { once: true });
        setTimeout(finish, 320);
    }

    /* ---------- konfetti ---------- */
    function confetti({ x = 0.5, y = 0.35, count = 140 } = {}) {
        if (reduced()) return;
        const canvas = document.createElement('canvas');
        canvas.className = 'confetti';
        const dpr = window.devicePixelRatio || 1;
        canvas.width = innerWidth * dpr;
        canvas.height = innerHeight * dpr;
        document.body.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        const colors = ['#6c5ce7', '#a29bfe', '#00cec9', '#fd79a8', '#fdcb6e', '#ffffff'];
        const parts = Array.from({ length: count }, () => {
            const angle = Math.random() * Math.PI * 2;
            const speed = 6 + Math.random() * 9;
            return {
                x: innerWidth * x, y: innerHeight * y,
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 6,
                w: 6 + Math.random() * 6, h: 4 + Math.random() * 6,
                rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
                color: colors[Math.floor(Math.random() * colors.length)]
            };
        });
        const start = performance.now();
        const frame = (now) => {
            const t = (now - start) / 1000;
            ctx.clearRect(0, 0, innerWidth, innerHeight);
            parts.forEach(p => {
                p.vy += 0.35; p.vx *= 0.985; p.vy *= 0.985;
                p.x += p.vx; p.y += p.vy; p.rot += p.vr;
                ctx.save();
                ctx.globalAlpha = Math.max(0, 1 - t / 2.2);
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            });
            if (t < 2.2) requestAnimationFrame(frame);
            else canvas.remove();
        };
        requestAnimationFrame(frame);
    }

    /* ---------- delikatny „puls” elementu ---------- */
    function pulse(el) {
        if (!el || reduced()) return;
        el.classList.remove('fx-pulse');
        void el.offsetWidth;
        el.classList.add('fx-pulse');
    }

    function init() {
        initTilt();
        initRipple();
        window.addEventListener('resize', movePill);
        // płynne przewijanie do kotwic
        document.documentElement.classList.add('fx-ready');
    }

    return { init, enter, stagger, countUp, reveal, wave, switchView, closeDialog, confetti, pulse, movePill };
})();
