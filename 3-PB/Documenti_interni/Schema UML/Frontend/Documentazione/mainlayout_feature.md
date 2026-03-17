# Spiegazione MainLayout Feature UML

Documento di riferimento per il class diagram del modulo
`MainLayoutFeature` del Frontend dell'applicazione **View4Life**.

---

## Indice

1. [Modelli di dominio](#1-modelli-di-dominio)
   - [NavItem](#navitem)
   - [UserInfo](#userinfo)
   - [UserRole](#userrole)
2. [Service](#2-service)
   - [NavService](#navservice)
   - [InternalAuthService](#internalAuthservice)
   - [AlarmStateService](#alarmstateservice)
3. [Component](#3-component)
   - [MainLayoutComponent](#mainlayoutcomponent)
   - [SidebarComponent](#sidebarcomponent)
   - [TopbarComponent](#topbarcomponent)
4. [Guard](#4-guard)
   - [AuthGuard](#authguard)
   - [RoleGuard](#roleguard)
5. [Struttura del routing](#5-struttura-del-routing)
6. [Relazioni](#6-relazioni)

---

## 1. Modelli di dominio

I modelli di dominio della feature MainLayout descrivono i dati che
reggono la navigazione e l'identità dell'utente autenticato. Sono
interfacce TypeScript senza logica — puri contratti di forma.

---

### `NavItem`

**File:** `core/models/nav-item.model.ts`
**Stereotipo:** `<<interface>>`

Rappresenta una singola voce di navigazione nella sidebar.
È l'unità atomica di cui `NavService` compone la lista di navigazione.
Ogni istanza descrive un link navigabile con la sua etichetta, icona,
route di destinazione e, opzionalmente, il ruolo minimo richiesto per
visualizzarla. La visibilità condizionale per ruolo (`requiredRole`) è
responsabilità di `NavService`, non del componente che la renderizza:
`SidebarComponent` riceve già una lista filtrata e non deve contenere
logica di autorizzazione.

`NavItem` è un plain data object. Non contiene dipendenze reattive
né riferimenti a framework: questo garantisce che sia serializzabile,
comparabile per deep equality e utilizzabile in qualsiasi contesto
(test, configurazione statica, SSR) senza dipendenze aggiuntive.

| Campo | Tipo | Obbligatorio | Descrizione |
|---|---|---|---|
| `label` | `string` | ✅ | Etichetta testuale visualizzata nella voce di menu — es. `"Dashboard"`, `"Allarmi"`, `"Gestione Impianti"` |
| `icon` | `string` | ✅ | Nome dell'icona da renderizzare — es. identificatore Material Icon o classe CSS |
| `route` | `string` | ✅ | Percorso Angular verso cui la voce naviga — es. `"/app/dashboard"`, `"/app/admin/users"` |
| `requiredRole` | `UserRole` | ❌ (opzionale) | Ruolo necessario per visualizzare la voce. Presente solo per le voci riservate a `AMMINISTRATORE`. Assente per le voci visibili a tutti i ruoli autenticati. Usato esclusivamente da `NavService.getNavItems()` per filtrare la lista |

---

### `UserInfo`

**File:** `core/models/user-info.model.ts`
**Stereotipo:** `<<interface>>`

Rappresenta la proiezione dell'utente autenticato così come mantenuta
in sessione da `InternalAuthService`. È il contratto di dati che
`MainLayoutComponent` legge per popolare la topbar e filtrare la
navigazione. Non contiene credenziali né token — è esclusivamente la
rappresentazione dell'identità per uso UI.

| Campo | Tipo | Descrizione |
|---|---|---|
| `username` | `string` | Username dell'utente autenticato — usato come identificativo univoco della sessione |
| `firstName` | `string` | Nome dell'utente — visualizzato in `TopbarComponent` (UC17.3.1) |
| `lastName` | `string` | Cognome dell'utente — visualizzato in `TopbarComponent` (UC17.3.2) |
| `role` | `UserRole` | Ruolo dell'utente corrente. Usato da `NavService` per filtrare le voci di menu e da `AuthGuard`/`RoleGuard` per proteggere le route |

---

### `UserRole`

**File:** `core/models/user-role.enum.ts`
**Stereotipo:** `<<enumeration>>`

Enumerazione che codifica i due ruoli previsti dal sistema. È il tipo
condiviso da `UserInfo`, `NavItem`, `NavService`, `AuthGuard` e
`RoleGuard`. Centralizzare l'enumerazione in un unico file evita
stringhe magiche sparse nel codice e permette al compilatore TypeScript
di rilevare assegnazioni non valide a compile time.

| Valore | Descrizione |
|---|---|
| `AMMINISTRATORE` | Utente Amministratore — ha accesso a tutte le sezioni, incluse quelle riservate (`/app/admin/**`) |
| `OPERATORE_SANITARIO` | Utente Operatore Sanitario — ha accesso alle sezioni operative (Dashboard, Allarmi, Appartamenti, Analytics) |

---

## 2. Service

### `NavService`

**File:** `features/main-layout/services/nav.service.ts`
**Stereotipo:** `<<service>>`
**Scope:** `providedIn: 'root'` — singleton per tutta l'app

Responsabile esclusivo della composizione della lista di voci di
navigazione. Riceve il ruolo dell'utente come parametro e restituisce
la lista filtrata dei `NavItem` visibili per quel ruolo. È l'unico
punto del codice in cui è definita la corrispondenza tra route e sezioni
dell'applicazione: aggiungere una nuova sezione richiede solo una
modifica qui, senza toccare `MainLayoutComponent` né `SidebarComponent`.

Questo rispetta l'Open/Closed Principle: la logica di navigazione è
aperta all'estensione (nuove voci) ma chiusa alla modifica dei
componenti consumatori.

Il service non ha stato interno e non effettua chiamate HTTP — è una
funzione pura incapsulata in un service per beneficiare dell'iniezione
di dipendenza e della testabilità.

### Metodi

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `getNavItems(role: UserRole)` | `NavItem[]` | Ritorna la lista completa delle voci di navigazione filtrata per il ruolo fornito. Le voci senza `requiredRole` sono sempre incluse. Le voci con `requiredRole: UserRole.AMMINISTRATORE` sono incluse solo se `role === UserRole.AMMINISTRATORE` |

---

### `InternalAuthService`

**File:** `core/services/internal-auth.service.ts`
**Stereotipo:** `<<service>>`
**Scope:** `providedIn: 'root'` — singleton per tutta l'app

**Riferimento esterno** — definito nel `CoreModule`, non di proprietà
della feature MainLayout. Corrisponde al componente C4 livello 3
`Internal Auth Service`. Gestisce il processo di login, mantiene lo
stato della sessione JWT e espone l'identità dell'utente corrente in
modo reattivo. `MainLayoutComponent` lo consuma per due scopi distinti:
esporre `currentUser$` come Observable al template per popolare la
topbar, e delegare il logout quando l'utente preme il bottone
corrispondente.

È il service iniettato anche da `AuthGuard` e `RoleGuard` per le
decisioni di protezione delle route.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `currentUser$` | `Observable<UserInfo>` | `public` | Stream reattivo dell'utente correntemente autenticato. `MainLayoutComponent` lo espone come campo e il template lo risolve con il pipe `async` per passare il valore a `TopbarComponent` via `@Input()` |

### Metodi

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `isAuthenticated()` | `boolean` | Ritorna `true` se esiste una sessione JWT valida. Usato da `AuthGuard.canActivate()` per bloccare l'accesso alle route protette |
| `getUserRole()` | `UserRole` | Ritorna il ruolo dell'utente corrente letto dal JWT. Usato da `RoleGuard.canActivate()` e da `MainLayoutComponent.ngOnInit()` per inizializzare `navItems` in modo sincrono |
| `logout()` | `void` | Invalida la sessione JWT, pulisce lo stato in memoria e naviga verso `/auth/login`. Chiamato da `MainLayoutComponent` in risposta all'output `logoutClicked` di `TopbarComponent` |

---

### `AlarmStateService`

**File:** `core/services/alarm-state.service.ts`
**Stereotipo:** `<<service>>`
**Scope:** `providedIn: 'root'` — singleton per tutta l'app

**Riferimento esterno** — definito nel `CoreModule`, non di proprietà
della feature MainLayout. Corrisponde al componente C4 livello 3
`AlarmState Service`. Mantiene lo stato reattivo degli allarmi attivi
e lo espone tramite Observable derivati. `MainLayoutComponent` espone
`activeAlarmCount$` come campo e il template lo risolve con il pipe
`async`, passando il valore scalare a `SidebarComponent` come `@Input()`.

`MainLayoutComponent` non interpreta il valore né esegue logica su di
esso: è un passthrough reattivo verso un componente presentazionale.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `activeAlarmCount$` | `Observable<number>` | `public` | Stream del numero di allarmi attivi in questo momento. Emette un nuovo valore ogni volta che un allarme viene attivato o risolto. Consumato da `MainLayoutComponent` tramite pipe `async` nel template |

---

## 3. Component

### `MainLayoutComponent`

**File:** `features/main-layout/main-layout.component.ts`
**Stereotipo:** `<<component>>`
**Tipo:** Smart Component (Shell / Container)
**Route:** `/app/**` — protetta da `AuthGuard`
**UC coperti:** Tutti i casi d'uso post-login attraverso il routing verso le feature figlie

È il contenitore principale dell'applicazione una volta completato il
login. Funge da shell strutturale: il suo template ospita `<app-sidebar>`,
`<app-topbar>` e `<router-outlet>`. È l'unico componente *smart* della
feature: è l'unico a conoscere `InternalAuthService`, `AlarmStateService`
e `NavService`. I componenti figli `SidebarComponent` e `TopbarComponent`
sono *dumb* — ricevono dati via `@Input()` ed emettono eventi via
`@Output()` senza alcuna dipendenza diretta da service.

Il pattern Smart/Dumb è la scelta architetturale chiave di questa feature:
garantisce che la logica di navigazione e di autenticazione sia
centralizzata in un unico punto, mentre i componenti presentazionali
rimangono semplici, testabili e riusabili.

`MainLayoutComponent` espone gli Observable di `InternalAuthService` e
`AlarmStateService` come campi `readonly` e li risolve nel template
tramite il pipe `async`, delegando interamente ad Angular la gestione
del ciclo di vita delle sottoscrizioni. Non è necessaria alcuna
sottoscrizione manuale, il che rende `ngOnDestroy()` un no-op per questi
stream. `navItems` è calcolato in modo sincrono in `ngOnInit()` tramite
`NavService`, poiché il ruolo utente non cambia durante la sessione.

### Template — bindings principali

```html
<app-sidebar
  [navItems]="navItems"
  [isCollapsed]="isCollapsed"
  [activeAlarmCount]="(activeAlarmCount$ | async) ?? 0"
  (collapsed)="toggleSidebar()">
</app-sidebar>

<app-topbar
  *ngIf="currentUser$ | async as user"
  [user]="user"
  (logoutClicked)="logout()">
</app-topbar>

<router-outlet />
```

Note sui binding:
- `(activeAlarmCount$ | async) ?? 0`: l'operatore `??` garantisce che
  `SidebarComponent` riceva sempre un `number` valido, mai `null`,
  prima che l'Observable emetta il primo valore.
- `*ngIf="currentUser$ | async as user"`: il pattern `as` di Angular
  risolve l'Observable nel template e assegna il valore a `user`.
  `TopbarComponent` viene renderizzato solo quando `user` è disponibile
  (non `null`), mantenendo il tipo dell'`@Input()` come `UserInfo` puro
  senza nullable.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `isCollapsed` | `boolean` | `public` | Stato di espansione/collasso della sidebar. Inizializzato a `false` (sidebar espansa). Invertito da `toggleSidebar()` in risposta all'output `collapsed` di `SidebarComponent`. Passato come `@Input()` a `SidebarComponent` |
| `navItems` | `NavItem[]` | `public` | Lista delle voci di navigazione calcolata in modo sincrono in `ngOnInit()` tramite `NavService.getNavItems(role)`. Passata come `@Input()` a `SidebarComponent`. Non è un Observable: il ruolo dell'utente non cambia durante la sessione, quindi il calcolo una-tantum è sufficiente |
| `currentUser$` | `Observable<UserInfo>` | `public` | Reference all'Observable `InternalAuthService.currentUser$`. Risolto nel template con `async` pipe tramite il pattern `*ngIf="currentUser$ | async as user"`, che garantisce un tipo `UserInfo` non nullable per `TopbarComponent` |
| `activeAlarmCount$` | `Observable<number>` | `public` | Reference all'Observable `AlarmStateService.activeAlarmCount$`. Risolto nel template con `async` pipe e operatore `?? 0` per garantire un valore `number` valido a `SidebarComponent` prima della prima emissione |

### Metodi

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `ngOnInit()` | `void` | — | Calcola `navItems` chiamando `NavService.getNavItems(this.authService.getUserRole())`. Non effettua sottoscrizioni manuali: `currentUser$` e `activeAlarmCount$` sono gestiti interamente dal template tramite `async` pipe |
| `ngOnDestroy()` | `void` | — | No-op nella configurazione corrente: tutte le sottoscrizioni sono delegate al pipe `async` nel template, che Angular gestisce automaticamente. Il metodo è presente per contratto e per future estensioni che richiedessero sottoscrizioni manuali |
| `toggleSidebar()` | `void` | — | Inverte il valore di `isCollapsed`. Chiamato in risposta all'output `collapsed` emesso da `SidebarComponent` quando l'utente preme il pulsante di collasso. `SidebarComponent` emette un segnale senza payload: è `MainLayoutComponent` a decidere il nuovo stato, essendo il proprietario esclusivo di `isCollapsed` |
| `logout()` | `void` | — | Delega a `InternalAuthService.logout()`. Chiamato in risposta all'output `logoutClicked` emesso da `TopbarComponent` quando l'utente preme il pulsante di uscita |

---

### `SidebarComponent`

**File:** `features/main-layout/components/sidebar/sidebar.component.ts`
**Stereotipo:** `<<component>>`
**Tipo:** Dumb Component (Presentational)
**UC coperti:** Navigazione verso tutte le sezioni post-login; badge allarmi attivi (UC41)

Componente puramente presentazionale che renderizza la barra di
navigazione laterale. Non ha dipendenze da service: riceve tutti i
dati di cui ha bisogno via `@Input()` da `MainLayoutComponent` ed emette
eventi verso di esso via `@Output()`. Questo lo rende completamente
testabile in isolamento — è sufficiente fornire gli input di test senza
necessità di mock per i service.

Renderizza la lista `navItems` in un `*ngFor`. Ogni voce usa
`[routerLinkActive]` di Angular per evidenziare la route attiva.
Il badge numerico degli allarmi è visualizzato sulla voce di navigazione
corrispondente quando `activeAlarmCount > 0`.

La scelta di ricevere `activeAlarmCount` come `number` scalare anziché
come `Observable<number>` è deliberata: `SidebarComponent` è dumb e non
si sottoscrive direttamente agli stream — il pipe `async` nel template
di `MainLayoutComponent` risolve l'Observable e passa il valore
già scalare via `@Input()`.

### Attributi

| Attributo | Tipo | Visibilità | Stereotipo | Descrizione |
|---|---|---|---|---|
| `navItems` | `NavItem[]` | `public` | `@Input()` | Lista filtrata delle voci di navigazione da renderizzare, calcolata e passata da `MainLayoutComponent` |
| `isCollapsed` | `boolean` | `public` | `@Input()` | Controlla l'espansione visiva della sidebar. `true` → sidebar collassata (solo icone); `false` → sidebar espansa (icone + etichette). Lo stato è posseduto da `MainLayoutComponent` e passato qui come sola lettura |
| `activeAlarmCount` | `number` | `public` | `@Input()` | Numero di allarmi attivi. Usato nel template per mostrare/nascondere il badge numerico sulla voce "Allarmi". Riceve sempre un valore `number` valido grazie all'operatore `?? 0` nel template del parent |
| `collapsed` | `EventEmitter<void>` | `public` | `@Output()` | Emesso quando l'utente preme il pulsante di collasso/espansione della sidebar. Non trasporta payload: è un segnale puro che comunica l'intenzione dell'utente. `MainLayoutComponent` risponde invertendo il proprio `isCollapsed`, essendo il proprietario esclusivo di quello stato |

---

### `TopbarComponent`

**File:** `features/main-layout/components/topbar/topbar.component.ts`
**Stereotipo:** `<<component>>`
**Tipo:** Dumb Component (Presentational)
**UC coperti:** UC17.3.1 (visualizzazione nome utente), UC17.3.2 (visualizzazione cognome utente)

Componente puramente presentazionale che renderizza la barra superiore
dell'applicazione. Come `SidebarComponent`, non ha dipendenze da service:
riceve i dati utente via `@Input()` e comunica il logout via `@Output()`.

Visualizza nome e cognome dell'utente autenticato, il suo ruolo e un
pulsante di logout. Non conosce né `InternalAuthService` né il meccanismo
di invalidazione del JWT — emette semplicemente `logoutClicked` e lascia
a `MainLayoutComponent` la responsabilità di gestire il flusso.

Il componente è renderizzato solo quando `currentUser$` ha emesso il
primo valore, grazie al pattern `*ngIf="currentUser$ | async as user"`
nel template di `MainLayoutComponent`. Questo garantisce che `user` sia
sempre un `UserInfo` valido e non nullable quando il componente è attivo.

### Attributi

| Attributo | Tipo | Visibilità | Stereotipo | Descrizione |
|---|---|---|---|---|
| `user` | `UserInfo` | `public` | `@Input()` | Dati dell'utente autenticato da visualizzare: nome (UC17.3.1), cognome (UC17.3.2) e ruolo. Il tipo è `UserInfo` non nullable: il parent garantisce la presenza del valore tramite il pattern `*ngIf ... as user` prima di istanziare il componente |
| `logoutClicked` | `EventEmitter<void>` | `public` | `@Output()` | Emesso quando l'utente preme il pulsante di logout. `MainLayoutComponent` si iscrive a questo output nel template e chiama `logout()` in risposta |

---

## 4. Guard

### `AuthGuard`

**File:** `core/guards/auth.guard.ts`
**Stereotipo:** `<<guard>>`
**Scope:** Condiviso — definito nel `CoreModule`, non in `MainLayoutFeature`

Implementa `CanActivateFn` di Angular. Protegge tutte le route figlie
del percorso `/app/**` — ovvero l'intera area autenticata dell'applicazione.
In `canActivate()` interroga `InternalAuthService.isAuthenticated()`: se
la sessione JWT non è valida o non esiste, redirige l'utente verso
`/auth/login` e blocca la navigazione. Non è di proprietà di questa
feature — è riusato da tutte le route che richiedono autenticazione.

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot)` | `boolean` | Legge lo stato di autenticazione da `InternalAuthService`. Se non autenticato, naviga a `/auth/login` e ritorna `false`. Se autenticato, ritorna `true` e la navigazione procede |

---

### `RoleGuard`

**File:** `core/guards/role.guard.ts`
**Stereotipo:** `<<guard>>`
**Scope:** Condiviso — definito nel `CoreModule`, non in `MainLayoutFeature`

Implementa `CanActivateFn` di Angular. Protegge le route riservate agli
Amministratori — `/app/admin/**`. Viene applicato in aggiunta ad
`AuthGuard` (non in sostituzione): il primo verifica l'autenticazione,
il secondo verifica il ruolo. In `canActivate()` interroga
`InternalAuthService.getUserRole()`: se il ruolo non è
`UserRole.AMMINISTRATORE`, redirige a `/app/dashboard` e blocca la
navigazione.

La separazione in due guard distinti rispetta il Single Responsibility
Principle: ciascuno ha una sola ragione di cambiare. Se in futuro si
aggiunge un ruolo intermedio, si modifica solo `RoleGuard`.

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot)` | `boolean` | Legge il ruolo utente da `InternalAuthService`. Se il ruolo non è `UserRole.AMMINISTRATORE`, naviga a `/app/dashboard` e ritorna `false`. Altrimenti ritorna `true` |

---

## 5. Struttura del routing

Il routing dell'applicazione è strutturato in due macro-aree nettamente
separate, ciascuna con il proprio host component:

```
/auth/**        →  UserAuthenticationFeature     (nessuna guardia — area pubblica)
  /auth/login
  /auth/first-access

/app/**         →  MainLayoutComponent            (protetto da AuthGuard)
  /app/dashboard                                  (tutti i ruoli)
  /app/alarms                                     (tutti i ruoli)
  /app/analytics                                  (tutti i ruoli)
  /app/apartments                                 (tutti i ruoli)
  /app/notifications                              (tutti i ruoli)
  /app/admin/users                                (protetto anche da RoleGuard)
  /app/admin/plant                                (protetto anche da RoleGuard)
  /app/admin/alarm-config                         (protetto anche da RoleGuard)
  /app/admin/myvimar                              (protetto anche da RoleGuard)
```

`MainLayoutComponent` è il componente host di `<router-outlet>` per tutte
le route sotto `/app/**`. Non è mai visibile prima del login: la route
`/auth/**` è completamente separata e non condivide alcuno shell con
l'area autenticata. Il collegamento account MyVimar (UC3–UC5) avviene
**dentro** il MainLayout, nella route `/app/admin/myvimar`, dopo che
l'Amministratore ha già effettuato il login in View4Life.

---

## 6. Relazioni

| Sorgente | Destinazione | Tipo | Descrizione |
|---|---|---|---|
| `MainLayoutComponent` | `SidebarComponent` | `*--` composizione | Il template di `MainLayoutComponent` renderizza `<app-sidebar>`. Il ciclo di vita del Sidebar è legato al layout |
| `MainLayoutComponent` | `TopbarComponent` | `*--` composizione | Il template di `MainLayoutComponent` renderizza `<app-topbar>` condizionalmente tramite `*ngIf`. Il ciclo di vita del Topbar è legato al layout |
| `MainLayoutComponent` | `NavService` | `-->` dipendenza (inietta) | Chiamato una sola volta in `ngOnInit()` per calcolare `navItems` a partire dal ruolo dell'utente |
| `MainLayoutComponent` | `InternalAuthService` | `-->` dipendenza (inietta) | Usato per esporre `currentUser$` al template e per delegare il logout |
| `MainLayoutComponent` | `AlarmStateService` | `-->` dipendenza (inietta) | Usato per esporre `activeAlarmCount$` al template, che lo risolve con `async` pipe e lo passa come `@Input()` scalare a `SidebarComponent` |
| `AuthGuard` | `InternalAuthService` | `-->` dipendenza (inietta) | Legge `isAuthenticated()` per decidere se bloccare la navigazione verso `/app/**` |
| `RoleGuard` | `InternalAuthService` | `-->` dipendenza (inietta) | Legge `getUserRole()` per decidere se bloccare la navigazione verso `/app/admin/**` |
| `NavService` | `NavItem` | `..>` dipendenza tratteggiata | `getNavItems()` crea e ritorna istanze di `NavItem[]`. Non le possiede |
| `NavItem` | `UserRole` | `..>` dipendenza tratteggiata | Il campo `requiredRole?` è di tipo `UserRole`. Dipendenza di tipo |
| `UserInfo` | `UserRole` | `..>` dipendenza tratteggiata | Il campo `role` è di tipo `UserRole`. Dipendenza di tipo |
