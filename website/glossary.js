document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('glossary-search');
    const letterHeaders = document.querySelectorAll('.glossary-letter-header');
    const noResultsMessage = document.getElementById('no-results');

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        let totalVisibleEntries = 0;

        letterHeaders.forEach(header => {
            let entriesUnderThisHeader = 0;
            let nextElement = header.nextElementSibling;

            // itera su tutti gli elementi fino alla prossima intestazione
            while (nextElement && !nextElement.classList.contains('glossary-letter-header')) {
                if (nextElement.classList.contains('glossary-entry')) {
                    const term = nextElement.querySelector('dt').textContent.toLowerCase();
                    const definition = nextElement.querySelector('dd').textContent.toLowerCase();

                    const isVisible = term.includes(searchTerm) || definition.includes(searchTerm);

                    nextElement.style.display = isVisible ? 'block' : 'none';

                    if (isVisible) {
                        entriesUnderThisHeader++;
                    }
                }
                nextElement = nextElement.nextElementSibling;
            }

            // mostra l'intestazione della lettera solo se ha voci visibili sotto di sè oppure O se la ricerca è vuota => (mostra tutto)
            header.style.display = (entriesUnderThisHeader > 0 || searchTerm === '') ? 'block' : 'none';
            totalVisibleEntries += entriesUnderThisHeader;
        });

        // mostra "nessun risultato" se non ci sono corrispondenze e se la barra di ricerca non è vuota
        if (totalVisibleEntries === 0 && searchTerm !== '') {
            noResultsMessage.style.display = 'block';
        } else {
            noResultsMessage.style.display = 'none';
        }
    });
});