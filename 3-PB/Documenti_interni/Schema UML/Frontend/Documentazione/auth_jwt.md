# Autenticazione in View4Life

**Versione:** 1.0.0
**Progetto:** View4Life — SPA Angular per la gestione di impianti IoT in residenze protette

---

## Indice

1. [Le due autenticazioni](#1-le-due-autenticazioni)
2. [Autenticazione Interna](#2-autenticazione-interna)
3. [Autenticazione Vimar (OAuth2)](#3-autenticazione-vimar-oauth2)
4. [Differenze tra le due autenticazioni](#4-differenze-tra-le-due-autenticazioni)
5. [JWT — Cos'è e come funziona](#5-jwt--cosè-e-come-funziona)
6. [Access Token e Refresh Token](#6-access-token-e-refresh-token)
7. [Il bug: perdita del JWT al redirect OAuth2](#7-il-bug-perdita-del-jwt-al-redirect-oauth2)
8. [Soluzioni: come persistere la sessione](#8-soluzioni-come-persistere-la-sessione)
9. [Soluzione adottata: httpOnly cookie + refresh token](#9-soluzione-adottata-httponly-cookie--refresh-token)
10. [Flusso completo con la soluzione adottata](#10-flusso-completo-con-la-soluzione-adottata)

---

## 1. Le due autenticazioni

In View4Life coesistono due meccanismi di autenticazione completamente distinti per scopo, attori e tecnologia. Comprenderli separatamente è fondamentale per capire l'architettura del sistema.

| | Autenticazione Interna | Autenticazione Vimar |
|---|---|---|
| **Chi la esegue** | Tutti gli utenti (Amministratore e Operatore Sanitario) | Solo l'Amministratore |
| **Scopo** | Accedere alle risorse del backend View4Life | Collegare un account MyVimar al sistema |
| **Quando** | All'avvio di ogni sessione di lavoro | Una tantum, per registrare l'impianto |
| **Tecnologia** | JWT emesso da View4Life | OAuth2 con redirect al portale Vimar |
| **UC coperti** | UC1, UC2 | UC3, UC4, UC5 |
| **Token prodotto** | JWT interno (in RAM + cookie) | Vimar access token (solo nel DB backend) |

---

## 2. Autenticazione Interna

### Cos'è

È l'autenticazione che ogni utente — Operatore Sanitario o Amministratore — deve completare per poter utilizzare l'applicativo. Permette di ottenere accesso a tutte le risorse protette del backend: visualizzare allarmi, appartamenti, dispositivi, gestire utenti, e così via.

Viene realizzata tramite token JWT, generati dal backend View4Life e poi inseriti automaticamente all'interno di ogni chiamata HTTP tramite `AuthInterceptor`.

### Use Case coperti

**UC1 — Autenticazione**

Flusso standard di login per tutti gli utenti già registrati nel sistema.

- **Attori:** Utente (Amministratore o Operatore Sanitario)
- **Pre-condizioni:** Il sistema è attivo; l'utente si trova nella pagina di autenticazione
- **Post-condizioni:** L'utente è autenticato e riconosciuto dal sistema con il proprio ruolo
- **Scenario:** L'utente inserisce username e password e conferma. Il backend verifica le credenziali, genera un JWT e lo restituisce al frontend.

**UC2 — Autenticazione con cambio password**

Flusso di primo accesso per utenti a cui è stata assegnata una password temporanea dall'Amministratore.

- **Attori:** Utente
- **Pre-condizioni:** Il sistema è attivo; l'utente ha ricevuto una password temporanea
- **Post-condizioni:** L'utente è autenticato e ha impostato una nuova password permanente
- **Scenario:** L'utente inserisce username e password temporanea, poi inserisce e conferma la nuova password. Il backend aggiorna le credenziali, genera un JWT e lo restituisce.

### Componenti Angular coinvolti

```
LoginComponent / FirstAccessComponent
        │ POST /api/auth/login
        ▼
InternalAuthService
        │ conserva JWT in RAM
        │ espone currentUser$ reattivamente
        ▼
AuthInterceptor
        │ aggiunge Authorization: Bearer <JWT> a ogni richiesta HTTP
        ▼
RoleGuard / AuthGuard
        │ leggono il ruolo da InternalAuthService
        │ proteggono le route senza chiamate di rete
```

---

## 3. Autenticazione Vimar (OAuth2)

### Cos'è

Serve esclusivamente all'Amministratore, già autenticato nella SPA con il proprio JWT interno, per collegare un account MyVimar al sistema View4Life. Non è un processo di autenticazione per accedere all'applicativo — è un'autorizzazione che consente al **backend** View4Life di comunicare con Vimar Cloud per conto dell'impianto.

Il token Vimar prodotto da questo flusso non è mai visibile al frontend: viene ottenuto dal backend, salvato nel database, e usato da `PlantAuthService` e `WebhookService` per comunicare con Vimar Cloud in modo continuativo e trasparente.

### Use Case coperti

**UC3 — Visualizzazione account MyVimar collegato**

- **Attori:** Amministratore
- **Pre-condizioni:** Il sistema è attivo; l'Amministratore è autenticato nel sistema
- **Scenario:** L'Amministratore visualizza se è presente un account MyVimar collegato al sistema e, se presente, ne visualizza l'email (UC3.1)

**UC4 — Collegamento account MyVimar**

- **Attori:** Amministratore, Cloud Vimar (attore secondario)
- **Pre-condizioni:** Il sistema è attivo; l'Amministratore è autenticato nel sistema
- **Scenario:** L'Amministratore avvia il collegamento. Il browser viene reindirizzato al portale OAuth2 di Vimar. L'Amministratore inserisce le credenziali MyVimar sul portale esterno. Vimar reindirizza il browser alla SPA con un codice di autorizzazione. La SPA invia il codice al backend, che lo scambia con un access token Vimar e lo salva nel database.

**UC5 — Rimozione account MyVimar**

- **Attori:** Amministratore, Cloud Vimar (attore secondario)
- **Pre-condizioni:** Il sistema è attivo; l'Amministratore è autenticato nel sistema; è presente un account MyVimar collegato
- **Scenario:** L'Amministratore rimuove il collegamento. Il backend elimina il token Vimar dal database.

### Flusso OAuth2 (UC4) passo per passo

```
1. Admin nella SPA (JWT interno valido)
        │ preme "Collega account MyVimar"
        ▼
2. VimarCloudApiService.initiateOAuth()
        │ costruisce URL: https://portal.vimar.com/oauth/authorize
        │                  ?client_id=...&redirect_uri=...&state=...
        │ window.location.href = URL
        │ ⚠️ nessuna chiamata HTTP al backend
        │ ⚠️ il browser naviga FUORI dalla SPA
        ▼
3. Portale OAuth2 Vimar
        │ Admin inserisce credenziali MyVimar
        │ Vimar genera authorization code monouso
        ▼
4. Browser reindirizzato a /admin/vimar/callback?code=...&state=...
        │ Angular si reinizializza da zero
        ▼
5. OAuthCallbackComponent.ngOnInit()
        │ legge code e state dai query parameter
        │ POST /api/vimar-account/oauth/callback { code, state }
        │     [+ Authorization: Bearer <JWT interno>]
        ▼
6. Backend — PlantAuthService
        │ verifica JWT interno → identifica l'Amministratore
        │ verifica state → protezione CSRF
        │ scambia code → ottiene Vimar access token
        │ salva Vimar access token nel DB
        └─→ HTTP 200
        ▼
7. OAuthCallbackComponent
        │ Router.navigate(['/admin/vimar'])
        ▼
8. MyVimarPageComponent mostra account collegato ✓
```

---

## 4. Differenze tra le due autenticazioni

```
                    Autenticazione Interna    Autenticazione Vimar
                    ──────────────────────    ────────────────────
Chi possiede il     Frontend (RAM)            Backend (database)
token?

Il frontend         Sì — JWT in RAM,          No — il Vimar token
lo vede?            usato da AuthInterceptor  non esce mai dal backend

A cosa serve        Identificare l'utente     Autorizzare il backend
il token?           in View4Life              a chiamare Vimar Cloud

Chi lo usa?         AuthInterceptor per       PlantAuthService e
                    ogni chiamata HTTP        WebhookService server-side

Lifecycle           Login → Logout            UC4 → UC5
                    (ogni sessione)           (configurazione impianto)

Standard            JWT (RFC 7519)            OAuth2 Authorization
                                              Code Flow (RFC 6749)
```

Il JWT interno è un **token di identità**: dice al backend View4Life chi sta facendo la richiesta. Il token Vimar è un **token di accesso a sistema esterno**: dice a Vimar Cloud che il backend View4Life è autorizzato a operare sull'impianto. I due token esistono in layer completamente separati e non si sovrappongono mai.

---

## 5. JWT — Cos'è e come funziona

### Struttura

Un JWT (JSON Web Token) è una stringa compatta composta da tre parti separate da punti, ognuna codificata in Base64:

```
header.payload.signature

eyJhbGciOiJIUzI1NiJ9
.eyJ1c2VySWQiOiIxMjMiLCJyb2xlIjoiQU1NTUlOSVNUUkFUT1JFIn0
.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

**Header** — descrive l'algoritmo di firma usato:
```json
{ "alg": "HS256", "typ": "JWT" }
```

**Payload** — contiene i *claims*, cioè le informazioni sull'utente:
```json
{
  "sub": "user_123",
  "username": "mario.rossi",
  "role": "AMMINISTRATORE",
  "iat": 1710000000,
  "exp": 1710003600
}
```

**Signature** — prova crittografica che il token non è stato alterato:
```
HMACSHA256(base64(header) + "." + base64(payload), SECRET_KEY)
```

La firma è calcolata dal backend usando una chiave segreta che solo il backend conosce. Questo significa che:
- chiunque può *leggere* il payload (è solo Base64, non cifrato)
- nessuno può *falsificare o alterare* il token senza la chiave segreta
- il backend può verificare l'autenticità **senza consultare il database** — questo è il vantaggio fondamentale rispetto alle sessioni tradizionali

### Flusso di autenticazione stateless

```
1. Login
   Frontend                          Backend
   POST /api/auth/login ──────────→  verifica credenziali nel DB
   { username, password }            genera JWT firmato con chiave segreta
                        ←──────────  { token: "eyJ..." }
   InternalAuthService.token = JWT

2. Ogni richiesta successiva
   Frontend                          Backend
   GET /api/allarmi ──────────────→  legge JWT dall'header Authorization
   Authorization: Bearer eyJ...      verifica firma con chiave segreta
                                     decodifica payload → conosce ruolo
                        ←──────────  { dati... }
```

Il backend non memorizza il token: gli basta la chiave segreta per verificarlo a ogni richiesta. Questo rende JWT intrinsecamente **stateless** e scalabile orizzontalmente.

### JWT nel contesto View4Life

Il payload del JWT interno di View4Life contiene:

```json
{
  "userId": "abc123",
  "username": "mario.rossi",
  "role": "AMMINISTRATORE",
  "isFirstAccess": false,
  "iat": 1710000000,
  "exp": 1710003600
}
```

`RoleGuard` e `AuthGuard` non effettuano chiamate di rete: leggono il ruolo direttamente da `InternalAuthService.currentUser$` in memoria. La protezione delle route è logica puramente client-side basata sul ruolo già decodificato al momento del login.

---

## 6. Access Token e Refresh Token

### Il problema di partenza: scadenza e compromesso di sicurezza

Un JWT contiene la sua stessa scadenza nel payload (`exp`). Il backend la legge e rifiuta il token se è scaduto. Ma non esiste un endpoint "invalida questo token" — una volta emesso, un JWT è valido fino a `exp`, punto.

Questo crea un dilemma:

| Token con scadenza lunga | Token con scadenza breve |
|---|---|
| Comodo — l'utente resta loggato a lungo | Sicuro — il danno di un token rubato è limitato nel tempo |
| Rischioso — un token rubato è utilizzabile a lungo | Scomodo — richiede ri-autenticazione frequente |

Il meccanismo access + refresh token risolve questo dilemma separando **due responsabilità distinte** in due token distinti.

### Access Token — identità a breve termine

È il JWT vero e proprio, quello che `AuthInterceptor` aggiunge a ogni richiesta. Ha una scadenza breve (15 minuti) perché è il token che viaggia continuamente sulla rete — è il più esposto. Se venisse intercettato, il danno è limitato a 15 minuti.

Vive solo in **RAM** perché non deve sopravvivere a nulla: se scade, il refresh token lo rinnova silenziosamente.

- **Scadenza breve:** tipicamente 15 minuti
- **Contenuto:** JWT completo con claims (`userId`, `role`, `username`, `exp`, ecc.)
- **Dove vive:** solo in RAM — `InternalAuthService.token`
- **Come viene usato:** `AuthInterceptor` lo aggiunge come `Authorization: Bearer` a ogni richiesta HTTP
- **Cosa succede alla scadenza:** il backend risponde HTTP 401; `AuthInterceptor` intercetta il 401 e avvia il rinnovo silenzioso tramite refresh token

### Refresh Token — credenziale di lunga durata

Non è un JWT. È una stringa opaca (contenuto sconosciuto, irrilevante). Non contiene claims leggibili, non ha struttura interna. È essenzialmente una password monouso a lunga scadenza (7 giorni).

Il backend lo salva nel database associato all'utente. Quando arriva una richiesta a `/api/auth/refresh`, il backend cerca quel token nel DB, verifica che non sia scaduto né revocato, e se tutto è valido emette un nuovo access token JWT.

Vive in un **`httpOnly` cookie** perché deve sopravvivere a redirect e refresh di pagina, ma non deve mai essere leggibile da JavaScript. Il browser lo invia automaticamente a ogni richiesta verso il backend — senza che il codice applicativo lo tocchi mai.

- **Scadenza lunga:** tipicamente 7 giorni
- **Contenuto:** stringa opaca casuale (non un JWT)
- **Dove vive:** `httpOnly` cookie — completamente inaccessibile a JavaScript
- **Come viene usato:** il browser lo invia automaticamente a ogni chiamata a `/api/auth/refresh`; JavaScript non lo vede mai
- **Cosa succede alla scadenza:** il backend rifiuta il refresh → logout forzato → l'utente ri-effettua il login

### Perché il refresh token vive nel cookie e non in localStorage

Questa è la scelta architetturale centrale. Le opzioni disponibili per persistere dati nel browser sono:

| | RAM | localStorage | sessionStorage | httpOnly Cookie |
|---|---|---|---|---|
| Sopravvive al redirect esterno | ❌ | ✅ | ❌* | ✅ |
| Sopravvive al refresh (F5) | ❌ | ✅ | ✅ | ✅ |
| Sopravvive alla chiusura tab | ❌ | ✅ | ❌ | ✅ |
| Leggibile da JavaScript | ✅ | ✅ | ✅ | ❌ |
| Vulnerabile a XSS | — | ✅ | ✅ | ❌ |

*Su alcuni browser `sessionStorage` non sopravvive al redirect a dominio esterno.

`localStorage` sopravvive al redirect, ma è leggibile da JavaScript — un attacco XSS (Cross-Site Scripting) può rubarlo con una riga:

```javascript
localStorage.getItem('userSession') // → token rubato
```

L'`httpOnly` cookie sopravvive al redirect **ed** è inaccessibile a JavaScript per design del browser: non appare in `document.cookie`, non è leggibile né scrivibile da nessuno script. Il browser lo gestisce in modo completamente autonomo, inviandolo automaticamente alle richieste verso il dominio corretto. Questa proprietà lo rende immune a XSS per definizione.

Il refresh token viene quindi salvato nell'unico storage che offre sia persistenza al redirect sia protezione da XSS. L'access token invece rimane in RAM perché la sua brevità lo rende abbastanza sicuro anche senza protezione aggiuntiva — se rubato, scade in 15 minuti.

### Come si combinano nel flusso reale

```
GIORNO 1 — Login
  Backend emette:
  ├── body:   { UserSession con JWT 15 min }   → InternalAuthService.token (RAM)
  └── header: Set-Cookie: refresh=XYZ;
              HttpOnly; Secure; SameSite=Strict → browser (JS non lo vede mai)

  [minuto 0-15] — JWT valido
  AuthInterceptor aggiunge JWT a ogni richiesta → tutto funziona ✓

  [minuto 16] — JWT scaduto
  Backend risponde HTTP 401 a qualsiasi richiesta
  AuthInterceptor intercetta il 401
  → POST /api/auth/refresh  (nessun body — il cookie viaggia automaticamente)
  Backend: trova refresh token nel DB → valido ✓
  ← nuovo JWT  scadenza: +15 min  → RAM aggiornata
  → riprova la richiesta originale con il nuovo JWT ✓
  L'utente non si accorge di nulla ✓

  [ogni 15 minuti per 7 giorni]
  stesso ciclo di rinnovo silenzioso ✓

GIORNO 8 — refresh token scaduto
  → POST /api/auth/refresh
  Backend: refresh token scaduto → HTTP 401
  AuthInterceptor: refresh fallito → logout()
  → Router.navigate(['/login'])
  L'utente deve ri-autenticarsi ← unica volta in 7 giorni ✓

Logout esplicito
  → POST /api/auth/logout
  ← Set-Cookie: refresh=; Max-Age=0  → browser cancella il cookie ✓
  InternalAuthService.token = null
  InternalAuthService.currentUser.next(null)
  → nessun token rimasto né in RAM né in storage ✓
```

### Come il refresh token risolve il problema del redirect OAuth2

Il flusso UC4 causa una navigazione completa del browser fuori dalla SPA verso il portale Vimar. `window.location.href = "https://portal.vimar.com/..."` termina il processo V8 del tab — tutta la RAM, incluso l'access token, viene distrutta.

```
RAM del browser
  └── InternalAuthService.token = "eyJ..."  ─┐
                                              ├─ DISTRUTTI al redirect
  └── currentUser = { role: ADMIN, ... }    ─┘

httpOnly cookie
  └── refresh = "a3f9b2c1..."               ← SOPRAVVIVE ✓
      (gestito dal browser, fuori dalla RAM V8)
```

Al rientro dalla callback OAuth2, Angular si reinizializza da zero. Il costruttore di `InternalAuthService` chiama immediatamente `/api/auth/refresh`. Il browser allega automaticamente il cookie alla richiesta. Il backend risponde con un nuovo access token JWT. La sessione è completamente ripristinata in RAM prima che `RoleGuard` venga valutato — e il flusso prosegue senza interruzioni.

```
[Angular si reinizializza dopo redirect OAuth2]
  InternalAuthService costruttore
  → POST /api/auth/refresh
    [browser allega automaticamente httpOnly cookie]
  ← nuovo JWT (15 min) → RAM ripristinata ✓

  RoleGuard.canActivate() → hasRole(AMMINISTRATORE) → true ✓

  OAuthCallbackComponent.ngOnInit()
  → POST /api/vimar-account/oauth/callback
    [AuthInterceptor: Authorization: Bearer <nuovo JWT>] ✓
```

Questa è esattamente la ragione per cui l'access token vive in RAM e il refresh token vive nel cookie: la RAM è volatile per design, il cookie è persistente per design. Il meccanismo sfrutta questa differenza invece di combatterla.

---

## 7. Il bug: perdita del JWT al redirect OAuth2

### Dove vive il JWT oggi

`InternalAuthService` è un singleton Angular (`providedIn: 'root'`). I suoi campi `token: string | null` e `currentUser: BehaviorSubject<UserSession | null>` vivono nell'**heap JavaScript del tab** — la RAM del processo V8 del browser.

```
Tab del browser
└── processo V8
    └── heap JavaScript
        └── InternalAuthService (singleton Angular)
            ├── token: "eyJhbGc..."   ← vive qui
            └── currentUser: {...}    ← vive qui
```

### Cosa succede al redirect OAuth2

Il flusso UC4 richiede che il browser navighi completamente fuori dalla SPA verso il portale Vimar. `window.location.href = "https://portal.vimar.com/..."` è una navigazione completa del browser, non una navigazione interna Angular.

```
1. Amministratore è loggato
   InternalAuthService.token = "eyJhbGc..."  ← in RAM

2. initiateOAuth() eseguito
   window.location.href = portale Vimar
   ┌─────────────────────────────────────────┐
   │ IL BROWSER NAVIGA FUORI DALLA SPA       │
   │ Il processo V8 viene terminato          │
   │ TUTTA la RAM dell'applicazione viene    │
   │ DISTRUTTA — incluso il JWT              │
   └─────────────────────────────────────────┘

3. Admin completa login su portale Vimar
   Browser reindirizzato a /admin/vimar/callback

4. Angular si reinizializza da zero
   InternalAuthService (nuova istanza)
   token = null   ← valore di default
   currentUser = new BehaviorSubject(null)

5. RoleGuard.canActivate()
   InternalAuthService.hasRole(AMMINISTRATORE)
   token è null → isAuthenticated() = false
   → RoleGuard reindirizza al login
   ┌─────────────────────────────────────────┐
   │ FLUSSO INTERROTTO                       │
   │ handleOAuthCallback() non viene mai     │
   │ chiamato — il Vimar token non viene     │
   │ mai salvato nel DB                      │
   └─────────────────────────────────────────┘
```

### Perché questo colpisce solo UC4

L'Operatore Sanitario non esegue mai `initiateOAuth()` — non ha accesso alle route della feature MyVimar Integration (protette da `RoleGuard` con ruolo `AMMINISTRATORE`). Il suo flusso è lineare: login → usa l'app → logout. Nessun redirect esterno, nessuna reinizializzazione di Angular. Il bug colpisce esclusivamente l'Amministratore durante UC4.

---

## 8. Soluzioni: come persistere la sessione

### RAM vs storage del browser

La differenza fondamentale tra la RAM e gli storage persistenti del browser:

| | RAM (heap JS) | localStorage | sessionStorage | httpOnly Cookie |
|---|---|---|---|---|
| Sopravvive al redirect | ❌ | ✅ | ❌* | ✅ |
| Sopravvive al refresh (F5) | ❌ | ✅ | ✅ | ✅ |
| Sopravvive alla chiusura tab | ❌ | ✅ | ❌ | ✅ |
| Leggibile da JavaScript | ✅ | ✅ | ✅ | ❌ |
| Vulnerabile a XSS | — | ✅ | ✅ | ❌ |

*Su alcuni browser `sessionStorage` non sopravvive al redirect a dominio esterno.

### Opzione A — localStorage (fix semplice)

```typescript
// InternalAuthService.login()
tap(session => {
  this.token = session.token;
  this.currentUser.next(session);
  localStorage.setItem('userSession', JSON.stringify(session)); // ← aggiunta
})

// InternalAuthService costruttore
constructor() {
  const stored = localStorage.getItem('userSession');
  if (stored) {
    const session = JSON.parse(stored);
    this.token = session.token;
    this.currentUser = new BehaviorSubject(session);
  }
}
```

**Risolve il bug?** ✅ Sì — il JWT sopravvive al redirect perché `localStorage` è gestito dal browser separatamente dall'heap V8.

**Introduce vulnerabilità?** ✅ Sì — `localStorage` è accessibile a qualsiasi script JavaScript in esecuzione sulla pagina. Un attacco XSS (Cross-Site Scripting) può rubare il token con una singola riga:

```javascript
// script malevolo iniettato tramite XSS
localStorage.getItem('userSession') // → "eyJhbGc..." rubato
```

### Opzione B — httpOnly cookie + refresh token (raccomandata da OWASP)

Il JWT di breve durata vive solo in RAM. Il refresh token di lunga durata vive in un `httpOnly` cookie, completamente inaccessibile a JavaScript. Al rientro dal redirect OAuth2, Angular chiama `/api/auth/refresh` al boot: il browser invia automaticamente il cookie (senza che JS lo tocchi), e il backend risponde con un nuovo JWT.

```
XSS attack con soluzione B:
  script malevolo in esecuzione nella pagina
  localStorage.getItem('token')   → undefined (non c'è)
  document.cookie                 → refresh token NON visibile (httpOnly)
  → nessun token rubabile ✓
```

---

## 9. Soluzione adottata: httpOnly cookie + refresh token

View4Life adotta la soluzione raccomandata da OWASP: access token JWT di breve durata in RAM, refresh token opaco in `httpOnly` cookie gestito dal browser.

### Modifiche a `InternalAuthService`

Il costruttore, invece di leggere da `localStorage`, chiama `/api/auth/refresh`. Se il cookie è presente e valido, il backend risponde con un nuovo JWT e la sessione viene ripristinata in RAM:

```typescript
constructor() {
  this.refresh().subscribe({
    error: () => this.currentUser.next(null)
    // cookie assente o scaduto → sessione non ripristinabile → login
  });
}

refresh(): Observable<UserSession> {
  return this.http.post<UserSession>('/api/auth/refresh', {}).pipe(
    tap(session => {
      this.token = session.token;       // JWT in RAM
      this.currentUser.next(session);
      // il cookie httpOnly è gestito dal browser — JS non lo tocca
    })
  );
}

logout(): void {
  this.http.post('/api/auth/logout', {}).subscribe();
  // il backend risponde con Set-Cookie: refresh=; Max-Age=0
  // il browser cancella il cookie — JS non può farlo direttamente
  this.token = null;
  this.currentUser.next(null);
  this.router.navigate(['/login']);
}
```

### Modifiche a `AuthInterceptor`

`AuthInterceptor` acquisisce la capacità di gestire il 401 silenziosamente: intercetta la risposta, chiama `refresh()`, e riprova la richiesta originale con il nuovo JWT. L'utente non si accorge mai della scadenza dell'access token.

```
AuthInterceptor — flusso esteso
  1. aggiunge JWT in RAM alla richiesta in uscita (come prima)
  2. se backend risponde 401 (JWT scaduto):
     a. chiama InternalAuthService.refresh()
     b. browser invia cookie httpOnly automaticamente
     c. backend risponde con nuovo JWT
     d. riprova la richiesta originale con il nuovo JWT ✓
  3. se refresh fallisce (cookie scaduto):
     a. chiama InternalAuthService.logout()
     b. Router.navigate(['/login'])
```

### Endpoint backend necessari

| Endpoint | Metodo | Descrizione |
|---|---|---|
| `/api/auth/login` | POST | Risponde con JWT nel body + `Set-Cookie: refresh=...; HttpOnly; Secure; SameSite=Strict` |
| `/api/auth/refresh` | POST | Legge cookie, verifica refresh token nel DB, risponde con nuovo JWT |
| `/api/auth/logout` | POST | Risponde con `Set-Cookie: refresh=; Max-Age=0` per cancellare il cookie |

---

## 10. Flusso completo con la soluzione adottata

```
UC1 — Login
  Frontend: POST /api/auth/login { username, password }
  Backend:
    ├── body:   { UserSession con JWT 15 min }   → InternalAuthService.token (RAM)
    └── header: Set-Cookie: refresh=XYZ;
                HttpOnly; Secure; SameSite=Strict → browser (JS non lo vede mai)

UC4 — Collegamento MyVimar (fase 1: avvio)
  Admin nella SPA, JWT valido in RAM
  initiateOAuth() → window.location.href = portale Vimar
  RAM distrutta → JWT perso
  httpOnly cookie sopravvive nel browser ✓

[Angular si reinizializza]
  InternalAuthService costruttore
  → POST /api/auth/refresh
  → browser invia automaticamente il cookie httpOnly
  ← nuovo JWT (15 min) in RAM ✓

  RoleGuard.canActivate() → hasRole(AMMINISTRATORE) → true ✓

UC4 — Collegamento MyVimar (fase 2: callback)
  OAuthCallbackComponent.ngOnInit()
  → POST /api/vimar-account/oauth/callback { code, state }
  → [AuthInterceptor: Authorization: Bearer <nuovo JWT>] ✓
  Backend:
    1. verifica JWT → identifica l'Amministratore
    2. verifica state → protezione CSRF
    3. scambia code → ottiene Vimar access token
    4. salva Vimar access token nel DB ← non torna mai al frontend
    5. risponde HTTP 200
  → Router.navigate(['/admin/vimar']) ✓

JWT scaduto durante la sessione (dopo 15 min)
  Backend risponde HTTP 401 a qualsiasi richiesta
  AuthInterceptor intercetta il 401
  → POST /api/auth/refresh
  → browser invia il cookie httpOnly automaticamente
  ← nuovo JWT in RAM
  → riprova la richiesta originale ✓
  L'utente non si accorge di nulla ✓

Logout
  → POST /api/auth/logout
  ← Set-Cookie: refresh=; Max-Age=0 → cookie cancellato dal browser
  InternalAuthService.token = null
  InternalAuthService.currentUser.next(null)
  → nessun token rimasto né in RAM né in storage ✓

Attacco XSS
  script malevolo in esecuzione nella pagina
  localStorage.getItem('token')   → undefined ✓
  document.cookie                 → refresh token non visibile (httpOnly) ✓
  → nessun token rubabile ✓
```
