document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('glossary-search');
    const glossaryContainer = document.querySelector('.glossary-container');
    const noResultsMessage = document.getElementById('no-results');
    
    // salva tutti gli elementi originali (escluso no-results)
    const originalElements = Array.from(glossaryContainer.children).filter(el => el.id !== 'no-results');

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();

        // se la ricerca è vuota, ripristina tutto
        if (searchTerm === '') {
            // rimuovi tutto tranne "no-results"
            Array.from(glossaryContainer.children).forEach(el => {
                if (el.id !== 'no-results') el.remove();
            });
            // aggiungi gli elementi originali prima di "no-results"
            originalElements.forEach(el => {
                glossaryContainer.insertBefore(el.cloneNode(true), noResultsMessage);
            });
            if (noResultsMessage) noResultsMessage.style.display = 'none';
            return;
        }

        // raccogli tutti gli elementi con la loro priorità (top priorità ai titoli)
        const allEntries = [];
        
        // usa gli elementi originali salvati per cercare
        const tempDiv = document.createElement('div');
        originalElements.forEach(el => tempDiv.appendChild(el.cloneNode(true)));
        
        const letterHeaders = tempDiv.querySelectorAll('.glossary-letter-header');

        letterHeaders.forEach(header => {
            let nextElement = header.nextElementSibling;

            while (nextElement && !nextElement.classList.contains('glossary-letter-header')) {
                if (nextElement.classList.contains('glossary-entry')) {
                    const term = nextElement.querySelector('dt').textContent.toLowerCase();
                    const definition = nextElement.querySelector('dd').textContent.toLowerCase();

                    const titleMatch = term.includes(searchTerm);
                    const definitionMatch = definition.includes(searchTerm);

                    if (titleMatch || definitionMatch) {
                        allEntries.push({
                            header: header,
                            element: nextElement.cloneNode(true),
                            priority: titleMatch ? 1 : 2,
                            letter: header.textContent.trim()
                        });
                    }
                }
                nextElement = nextElement.nextElementSibling;
            }
        });

        // rimuovi tutti gli elementi tranne "no-results"
        Array.from(glossaryContainer.children).forEach(el => {
            if (el.id !== 'no-results') el.remove();
        });

        // se non ci sono risultati
        if (allEntries.length === 0) {
            if (noResultsMessage) noResultsMessage.style.display = 'block';
            return;
        }

        if (noResultsMessage) noResultsMessage.style.display = 'none';

        // ordina: prima per priorità (titoli prima), poi per lettera
        allEntries.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.letter.localeCompare(b.letter);
        });

        // aggiungi i risultati prima di no-results
        let lastLetter = null;

        allEntries.forEach(entry => {
            if (entry.letter !== lastLetter) {
                const headerClone = entry.header.cloneNode(true);
                glossaryContainer.insertBefore(headerClone, noResultsMessage);
                lastLetter = entry.letter;
            }
            glossaryContainer.insertBefore(entry.element, noResultsMessage);
        });
    });
});
