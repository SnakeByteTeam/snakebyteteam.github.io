document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('glossary-search');
    const glossaryContainer = document.querySelector('.glossary-container');
    const noResultsMessage = document.getElementById('no-results');
    
    // salva tutti gli elementi originali (escluso no-results)
    const originalElements = Array.from(glossaryContainer.children).filter(el => el.id !== 'no-results');

    // funzione per sanitizzare testo: elimina eventuali tag o codice malevolo (per evitare XSS)
    const sanitizeText = (text) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.textContent.trim();
    };

    // per evidenziare il testo cercato 
    const highlightText = (element, searchTerm) => {
        const text = element.textContent;
        const lowerText = text.toLowerCase();
        const index = lowerText.indexOf(searchTerm.toLowerCase());

        if (index === -1 || searchTerm === '') return; // nessun match o campo vuoto

        // svuota il nodo e ricostruisce in modo sicuro
        element.textContent = '';
        
        const before = document.createTextNode(text.slice(0, index));
        const match = document.createElement('mark');
        match.textContent = text.slice(index, index + searchTerm.length);
        const after = document.createTextNode(text.slice(index + searchTerm.length));

        element.appendChild(before);
        element.appendChild(match);
        element.appendChild(after);
    };

    searchInput.addEventListener('input', (e) => {
        const searchTerm = sanitizeText(e.target.value.toLowerCase().trim());

        // se la ricerca è vuota, ripristina tutto
        if (searchTerm === '') {
            Array.from(glossaryContainer.children).forEach(el => {
                if (el.id !== 'no-results') el.remove();
            });
            originalElements.forEach(el => {
                glossaryContainer.insertBefore(el.cloneNode(true), noResultsMessage);
            });
            if (noResultsMessage) noResultsMessage.style.display = 'none';
            return;
        }

        const allEntries = [];
        const tempDiv = document.createElement('div');
        originalElements.forEach(el => tempDiv.appendChild(el.cloneNode(true)));

        const letterHeaders = tempDiv.querySelectorAll('.glossary-letter-header');

        letterHeaders.forEach(header => {
            let nextElement = header.nextElementSibling;

            while (nextElement && !nextElement.classList.contains('glossary-letter-header')) {
                if (nextElement.classList.contains('glossary-entry')) {
                    const dt = nextElement.querySelector('dt');
                    const dd = nextElement.querySelector('dd');

                    if (!dt || !dd) {
                        nextElement = nextElement.nextElementSibling;
                        continue;
                    }

                    const term = sanitizeText(dt.textContent.toLowerCase());
                    const definition = sanitizeText(dd.textContent.toLowerCase());

                    const titleMatch = term.includes(searchTerm);
                    const definitionMatch = definition.includes(searchTerm);

                    if (titleMatch || definitionMatch) {
                        const entryClone = nextElement.cloneNode(true);
                        const dtClone = entryClone.querySelector('dt');
                        const ddClone = entryClone.querySelector('dd');

                        // evidenziazione
                        if (titleMatch) highlightText(dtClone, searchTerm);
                        if (definitionMatch) highlightText(ddClone, searchTerm);

                        allEntries.push({
                            header: header,
                            element: entryClone,
                            priority: titleMatch ? 1 : 2,
                            letter: sanitizeText(header.textContent)
                        });
                    }
                }
                nextElement = nextElement.nextElementSibling;
            }
        });

        // pulisci il container
        Array.from(glossaryContainer.children).forEach(el => {
            if (el.id !== 'no-results') el.remove();
        });

        if (allEntries.length === 0) {
            if (noResultsMessage) noResultsMessage.style.display = 'block';
            return;
        }

        if (noResultsMessage) noResultsMessage.style.display = 'none';

        // ordina per priorità e lettera
        allEntries.sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.letter.localeCompare(b.letter);
        });

        // ricostruisci DOM in sicurezza
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
