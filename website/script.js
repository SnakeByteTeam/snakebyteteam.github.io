const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// per chiudere tutte le tab
function closeAllTabs() {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
}

closeAllTabs();

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
            return;
        }

        // altrimenti apro solo quella
        closeAllTabs();
        button.classList.add('active');
        if (targetPanel) targetPanel.classList.add('active');
    });
});

// chiudo le tab se si clicca fuoru
document.addEventListener('click', (e) => {
    const isInsideButton = e.target.closest('.tab-button');
    const isInsideContent = e.target.closest('.tab-content');
    if (!isInsideButton && !isInsideContent) {
        closeAllTabs();
    }
});

// previene la chiusura se all'interno del contenuto
tabContents.forEach(content => {
    content.addEventListener('click', (e) => e.stopPropagation());
});

// comportamento dinamico della navbar
const header = document.querySelector('header');
let lastKnownScrollY = 0;
let ticking = false;

function onScroll() {
    lastKnownScrollY = window.scrollY || window.pageYOffset;
    requestTick();
}

function requestTick() {
    if (!ticking) {
        requestAnimationFrame(updateHeaderOnScroll);
        ticking = true;
    }
}

function updateHeaderOnScroll() {
    const threshold = 40; // affinchè non venga eseguito con scroll minimi
    if (!header) return;

    if (lastKnownScrollY > threshold) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }

    ticking = false;
}

window.addEventListener('scroll', onScroll, { passive: true });
