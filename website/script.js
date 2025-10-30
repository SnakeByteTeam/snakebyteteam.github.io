const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// per chiudere tutte le tab
function closeAllTabs() {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
}

// per mostrare/nascondere il placeholder quando non ci sono tab attive
function updateEmptyState() {
    const empty = document.querySelector('.tab-empty');
    const anyActive = !!document.querySelector('.tab-button.active');
    if (!empty) return;
    // fade del placeholder in/out senza toccare il layout
    const contentArea = document.querySelector('.tab-content-area');
    if (anyActive) {
        // se visibile, parti con il fade-out e togli dopo la transizione
        if (!empty.classList.contains('hidden')) {
            empty.classList.add('hidden');
            const onEnd = (e) => {
                if (e.target === empty) {
                    empty.style.display = 'none';
                    if (contentArea) contentArea.classList.remove('empty-visible');
                    empty.removeEventListener('transitionend', onEnd);
                }
            };
            empty.addEventListener('transitionend', onEnd);
        }
    } else {
        // mostra il placeholder: il container dovrà essere della minima altezza poi applica fade-in
        if (contentArea) contentArea.classList.add('empty-visible');
        empty.style.display = 'flex';
        // forza il reflow e poi rimuovi l'hidden per far avvenire il fade-in
        requestAnimationFrame(() => empty.classList.remove('hidden'));
    }
}

// stato iniziale: apri la tab 'candidatura' di default (mostra contenuti corrispondenti)
// se la tab non esiste, ricadi nel comportamento di placeholder
const defaultButton = document.querySelector('.tab-button[data-tab="candidatura"]');
const defaultPanel = document.getElementById('candidatura');
if (defaultButton) defaultButton.classList.add('active');
if (defaultPanel) defaultPanel.classList.add('active');
updateEmptyState();

// utile nel click-handler
tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        e.stopPropagation(); // evita che il click salga al document e chiuda subito

        const targetTabId = button.dataset.tab;
        const targetPanel = document.getElementById(targetTabId);

        const isActive = button.classList.contains('active');

        // se la tab è attiva la chiudo
        if (isActive) {
            button.classList.remove('active');
            if (targetPanel) targetPanel.classList.remove('active');
            updateEmptyState();
            return;
        }

        // altrimenti apro solo quella
        const prevActive = document.querySelector('.tab-button.active');
        const prevPanel = prevActive ? document.getElementById(prevActive.dataset.tab) : null;

        // se lo switch avviene tra tabs differenti applica uno swap istantaneo
        if (prevPanel && prevActive && prevActive !== button) {
            prevActive.classList.remove('active');
            prevPanel.classList.remove('active');
            button.classList.add('active');
            if (targetPanel) targetPanel.classList.add('active');
            // pulisci i rimanenti stili inline
            try {
                [prevPanel, targetPanel].forEach(p => { if (!p) return; p.style.transition = ''; p.style.opacity = ''; p.style.zIndex = ''; });
                const contentAreaEl = document.querySelector('.tab-card .tab-content-area') || document.querySelector('.tab-content-area');
                if (contentAreaEl) { contentAreaEl.style.height = ''; contentAreaEl.classList.remove('crossfade'); }
            } catch (e) { /* ignora */ }
            try { button.blur(); } catch (err) { }
            updateEmptyState();
            return;
        }

        // comportamento di default
        closeAllTabs();
        button.classList.add('active');
        if (targetPanel) targetPanel.classList.add('active');
        updateEmptyState();
    });
});

// chiudo le tab se si clicca fuoru
document.addEventListener('click', (e) => {
    const isInsideButton = e.target.closest('.tab-button');
    const isInsideContent = e.target.closest('.tab-content');
    if (!isInsideButton && !isInsideContent) {
        closeAllTabs();
        updateEmptyState();
    }
});

// header dinamico
const header = document.querySelector('header');
let ticking = false;
function onScroll() {
    if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
            if (!header) { ticking = false; return; }
            const threshold = 40;
            if ((window.scrollY || window.pageYOffset) > threshold) header.classList.add('scrolled'); else header.classList.remove('scrolled');
            ticking = false;
        });
    }
}
window.addEventListener('scroll', onScroll, { passive: true });

// aiuta ad effettuare il resize in modo smooth
let _resizeTimer = null;
window.addEventListener('resize', () => {
    document.body.classList.add('is-resizing');
    if (_resizeTimer) clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
        document.body.classList.remove('is-resizing');
        _resizeTimer = null;
    }, 220);
}, { passive: true });
