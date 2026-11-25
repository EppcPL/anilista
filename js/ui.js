/* =========================================================
   ui.js – powiadomienia, okna dialogowe, tabele
   ========================================================= */
const UI = (() => {
    function toast(message, type = 'info', onClick = null) {
        const box = U.$('toasts');
        const el = document.createElement('div');
        el.className = `toast toast-${type}`;
        el.textContent = message;
        if (onClick) {
            el.classList.add('clickable');
            el.addEventListener('click', onClick);
        }
        box.appendChild(el);
        requestAnimationFrame(() => el.classList.add('show'));
        setTimeout(() => {
            el.classList.remove('show');
            setTimeout(() => el.remove(), 300);
        }, 3500);
    }

    /* ---------- okna <dialog> ---------- */
    function open(id) {
        const d = U.$(id);
        if (!d) return d;
        if (d.classList.contains('closing')) { d.classList.remove('closing'); }
        if (!d.open) d.showModal();
        if (typeof FX !== 'undefined') FX.enter(d);
        return d;
    }
    function close(id) {
        const d = U.$(id);
        if (!d || !d.open) return;
        if (typeof FX !== 'undefined') FX.closeDialog(d); else d.close();
    }

    function initDialogs() {
        U.qsa('dialog.modal').forEach(d => {
            // Klik w tło zamyka okno
            d.addEventListener('click', (e) => {
                if (e.target === d || e.target.closest('[data-close]')) close(d.id);
            });
            // Esc – też z animacją
            d.addEventListener('cancel', (e) => { e.preventDefault(); close(d.id); });
        });
    }

    /* ---------- panel w profilu ---------- */
    function showPanel(title, html, after) {
        const panel = U.$('profile-panel');
        panel.innerHTML = `
            <div class="panel-head">
                <h3>${title}</h3>
                <button class="btn-icon" data-panel-close aria-label="Zamknij"><i class="fas fa-xmark"></i></button>
            </div>
            <div class="panel-body">${html}</div>`;
        panel.hidden = false;
        panel.querySelector('[data-panel-close]').onclick = () => { panel.hidden = true; };
        if (after) after(panel);
        if (typeof FX !== 'undefined') FX.stagger(panel, ['tbody > tr', '.ro-row']);
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /**
     * Tabela z sortowaniem po kliknięciu w nagłówek.
     * columns: [{ key, label, sort?: (row)=>value, html: (row)=>string }]
     */
    function sortableTable(container, { columns, rows, state }) {
        const col = columns.find(c => c.key === state.by);
        const sorted = [...rows];
        if (col && col.sort) {
            sorted.sort((a, b) => {
                const va = col.sort(a), vb = col.sort(b);
                const cmp = typeof va === 'string' ? va.localeCompare(vb, 'pl') : va - vb;
                return state.dir === 'asc' ? cmp : -cmp;
            });
        }
        const arrow = (c) => c.key === state.by ? (state.dir === 'asc' ? ' ▲' : ' ▼') : '';
        container.innerHTML = `
            <div class="table-wrap"><table class="table">
                <thead><tr>${columns.map(c => c.sort
                    ? `<th><button class="th-sort" data-key="${c.key}">${c.label}${arrow(c)}</button></th>`
                    : `<th>${c.label}</th>`).join('')}</tr></thead>
                <tbody>${sorted.map(r => `<tr>${columns.map(c => `<td>${c.html(r)}</td>`).join('')}</tr>`).join('')}</tbody>
            </table></div>`;
        container.querySelectorAll('.th-sort').forEach(btn => {
            btn.onclick = () => {
                const key = btn.dataset.key;
                if (state.by === key) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
                else { state.by = key; state.dir = key === 'title' ? 'asc' : 'desc'; }
                sortableTable(container, { columns, rows, state });
            };
        });
    }

    function statusChip(status) {
        const s = Calc.STATUS[status] || Calc.STATUS.watching;
        return `<span class="status ${s.cls}">${s.label}</span>`;
    }

    function bar(percent, cls = '') {
        return `<div class="bar ${cls}"><span style="width:${Math.max(0, Math.min(100, percent))}%"></span></div>`;
    }

    return { toast, open, close, initDialogs, showPanel, sortableTable, statusChip, bar };
})();
