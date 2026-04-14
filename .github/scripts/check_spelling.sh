#!/bin/bash

# Script per controllare l'ortografia dei file LaTeX con Hunspell
# Filtra i comandi LaTeX per evitare falsi positivi

set -e

ERRORS_FOUND=0
ERROR_FILE="spelling_errors.txt"
WORDLIST_FILE=".github/wordlist.txt"

# Crea file per gli errori
> "$ERROR_FILE"

# Funzione per processare un file LaTeX
check_file() {
    local file="$1"
    
    echo "Controllando: $file"
    
    # Filtra i comandi LaTeX e controlla l'ortografia
    # Rimuove:
    # - Comandi LaTeX (\comando)
    # - Parametri tra parentesi graffe {}
    # - Commenti %
    # - Riferimenti \ref, \cite, \label
    # - Equazioni matematiche (tra $ $)
    
    cat "$file" | \
        sed 's/%.*$//' | \
        sed 's/\\[a-zA-Z]*{[^}]*}//g' | \
        sed 's/\\[a-zA-Z]*//g' | \
        sed 's/\$[^$]*\$//g' | \
        hunspell -d it_IT,en_US -l -p "$WORDLIST_FILE" | \
        sort -u > temp_errors.txt
    
    if [ -s temp_errors.txt ]; then
        echo "=== Errori in $file ===" >> "$ERROR_FILE"
        cat temp_errors.txt >> "$ERROR_FILE"
        echo "" >> "$ERROR_FILE"
        ERRORS_FOUND=1
    fi
    
    rm -f temp_errors.txt
}

# Crea wordlist personalizzata se non esiste
if [ ! -f "$WORDLIST_FILE" ]; then
    echo "Creando wordlist vuota..."
    touch "$WORDLIST_FILE"
fi

# Controlla se ci sono file da verificare
if [ ! -f changed_files.txt ] || [ ! -s changed_files.txt ]; then
    echo "Nessun file LaTeX modificato in questa PR"
    exit 0
fi

# Processa ogni file modificato
while IFS= read -r file; do
    if [ -f "$file" ]; then
        check_file "$file"
    fi
done < changed_files.txt

# Mostra risultati
if [ $ERRORS_FOUND -eq 1 ]; then
    echo "Errori ortografici trovati:"
    cat "$ERROR_FILE"
    exit 1
else
    echo "Nessun errore ortografico trovato!"
    exit 0
fi
