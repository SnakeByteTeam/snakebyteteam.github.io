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
    const anyActive = !!document.querySelector('.tab-button.active:not(#close-tabs-button)');
    if (!empty) return;
    
    if (anyActive) {
        // nascondi il placeholder con fade-out
        empty.classList.add('hidden');
    } else {
        // mostra il placeholder con fade-in
        empty.classList.remove('hidden');
    }
}

// stato iniziale: apri la tab 'candidatura' di default (mostra contenuti corrispondenti)
// se la tab non esiste, ricadi nel comportamento di placeholder
const defaultButton = document.querySelector('.tab-button[data-tab="candidatura"]');
const defaultPanel = document.getElementById('candidatura');
if (defaultButton) defaultButton.classList.add('active');
if (defaultPanel) defaultPanel.classList.add('active');
updateEmptyState();

// gestione dei click sui pulsanti delle tab
tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        e.stopPropagation(); // evita che il click salga al document e chiuda subito

        // ignora il pulsante di chiusura (gestito separatamente)
        if (button.id === 'close-tabs-button') {
            return;
        }

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
        const prevActive = document.querySelector('.tab-button.active:not(#close-tabs-button)');
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

// pulsante "x" per chiudere tutte le tab e mostrare il placeholder
const closeButton = document.getElementById('close-tabs-button');
if (closeButton) {
    closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllTabs();
        updateEmptyState();
    });
}

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
