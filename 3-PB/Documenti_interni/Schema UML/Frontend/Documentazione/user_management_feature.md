# Spiegazione User Management UML

Documento di riferimento per il class diagram `user-management-uml`,
relativo ai componenti Angular `UserManagementFeature` e `UserApiService`
del Frontend dell'applicazione **View4Life**.

**Versione:** 2.0.0
**Pattern architetturale adottato:** Smart/Dumb Component
**Strategia di stato:** async pipe (`Observable` + `*ngIf as`)

---

## Indice

1. [DTO](#1-dto)
   - [UserDto](#userdto)
   - [CreateUserDto](#createuserdto)
   - [UserCreatedResponse](#usercreatedresponse)
2. [Enum](#2-enum)
   - [UserRole](#userrole)
   - [UserManagementErrorType](#usermanagementerrortype)
3. [Service](#3-service)
   - [UserApiService](#userapiservice)
4. [Component](#4-component)
   - [UserManagementComponent](#usermanagementcomponent)
   - [UserListComponent](#userlistcomponent)
   - [CreateUserFormComponent](#createuserformcomponent)
   - [UserCreatedDialogComponent](#usercreateddialocomponent)
5. [Module](#5-module)
   - [UserManagementModule](#usermanagementmodule)
   - [UserManagementRoutingModule](#usermanagementroutingmodule)
6. [Relazioni](#6-relazioni)

---

## Note architetturali generali

La feature adotta il pattern **Smart/Dumb Component** (detto anche
Container/Presentational). Un unico componente smart —
`UserManagementComponent` — è il solo a conoscere i servizi, a
effettuare chiamate HTTP e a detenere lo stato della feature. I
componenti figli (`UserListComponent`, `CreateUserFormComponent`,
`UserCreatedDialogComponent`) sono puramente presentazionali: ricevono
dati via `@Input` e comunicano eventi verso il padre via `@Output`.
Non iniettano servizi e non conoscono il layer HTTP.

La comunicazione padre→figlio avviene esclusivamente tramite property
binding (`[input]`); la comunicazione figlio→padre avviene
esclusivamente tramite event binding (`(output)`). Non esistono
`@ViewChild` né riferimenti TypeScript diretti ai figli: Angular
gestisce il ciclo di vita dei componenti presentazionali tramite il
DOM e i relativi binding nel template.

Lo stato principale della lista utenti è modellato come
`users$: Observable<UserDto[]>` e consumato nel template tramite
`*ngIf="users$ | async as users; else loading"`, eliminando la
necessità di un campo `loading` e di una gestione manuale della
sottoscrizione.

La password temporanea per i nuovi Operatori Sanitari è **generata
dal backend**: il frontend invia un `CreateUserDto` senza password e
riceve in risposta un `UserCreatedResponse` che contiene il campo
`temporaryPassword`. Questo valore viene mostrato all'Amministratore
tramite `UserCreatedDialogComponent` con l'avviso esplicito che non
sarà più recuperabile una volta chiuso il dialog.

---

## 1. DTO

I DTO (Data Transfer Object) descrivono la struttura dei dati scambiati
tra frontend e backend. Non contengono logica né stato: sono contratti
puri di serializzazione. I DTO in lettura (risposta del backend) sono
separati dai DTO in scrittura (payload delle richieste) per rispettare
l'Interface Segregation Principle e perché i due tipi hanno lifecycle
distinti.

---

### `UserDto`

**File:** `user.model.ts`
**Stereotipo:** `<<interface>>`

Descrive la struttura di un utente così come viene restituita dal
backend nelle chiamate in lettura. È il contratto della risposta di
`GET /users`. Non ha logica né stato proprio.

Viene usato da `UserManagementComponent` come elemento dell'`Observable`
esposto al template, e da `UserListComponent` come tipo dell'array
`@Input` iterato nel template per visualizzare l'elenco (UC6, UC6.1,
UC6.1.1, UC6.1.2, UC6.1.3). Il campo `id` è usato da
`UserManagementComponent.onUserDeleted()` per identificare l'utente da
eliminare.

| Campo | Tipo | Descrizione |
|---|---|---|
| `id` | `String` | Identificatore univoco dell'utente nel database. Usato come chiave per la chiamata `DELETE /users/:id` in UC8 |
| `firstName` | `String` | Nome dell'utente — visualizzato in UC6.1.1 |
| `lastName` | `String` | Cognome dell'utente — visualizzato in UC6.1.2 |
| `username` | `String` | Username dell'utente — visualizzato in UC6.1.3 |
| `role` | `UserRole` | Ruolo dell'utente nel sistema. Restituito dal backend come parte della risposta. Attualmente non consumato dalla UI di questa feature, ma presente nel contratto di risposta dell'API |

---

### `CreateUserDto`

**File:** `create-user.model.ts`
**Stereotipo:** `<<interface>>`

Descrive la struttura del payload inviato al backend per creare un
nuovo Operatore Sanitario (`POST /users`). È separato da `UserDto`
perché ha un lifecycle diverso: viene composto dall'Amministratore
durante la compilazione del form e inviato in scrittura, mentre
`UserDto` descrive solo dati ricevuti in lettura.

Non include la password temporanea: questa viene **generata dal
backend** e restituita nella risposta (`UserCreatedResponse.temporaryPassword`).
Il frontend non partecipa alla generazione né alla politica di
composizione della password.

Il DTO viene composto da `UserManagementComponent.onFormSubmit()` a
partire dai valori emessi dal `formSubmit: EventEmitter<CreateUserDto>`
di `CreateUserFormComponent`, e passato come parametro a
`userApi.createUser()`.

| Campo | Tipo | Descrizione |
|---|---|---|
| `firstName` | `String` | Nome del nuovo Operatore Sanitario — corrisponde al campo inserito in UC7.1 |
| `lastName` | `String` | Cognome del nuovo Operatore Sanitario — corrisponde al campo inserito in UC7.2 |
| `username` | `String` | Username del nuovo Operatore Sanitario — corrisponde al campo inserito in UC7.3. Il backend risponde con HTTP 409 se lo username è già registrato (UC46) |

---

### `UserCreatedResponse`

**File:** `user-created-response.model.ts`
**Stereotipo:** `<<interface>>`

Descrive la risposta del backend alla chiamata `POST /users`. Contiene
sia i dati dell'utente appena creato (come `UserDto`), sia la password
temporanea generata dal backend (UC7.4). La password temporanea è
inclusa **esclusivamente in questa risposta**: non è memorizzata né
recuperabile in seguito dal sistema. L'Amministratore deve comunicarla
direttamente al nuovo utente (verbalmente o per iscritto) prima di
chiudere il dialog.

Viene ricevuto da `UserManagementComponent.onFormSubmit()` al successo
della chiamata `userApi.createUser()`, e passato come `@Input` a
`UserCreatedDialogComponent` per la visualizzazione.

| Campo | Tipo | Descrizione |
|---|---|---|
| `user` | `UserDto` | I dati dell'utente appena creato, con il campo `id` assegnato dal backend |
| `temporaryPassword` | `String` | La password temporanea generata dal backend per il nuovo utente — UC7.4. Mostrata all'Amministratore da `UserCreatedDialogComponent` con avviso di non recuperabilità |

---

## 2. Enum

---

### `UserRole`

**File:** `user-role.enum.ts`
**Stereotipo:** `<<enumeration>>`

Definisce i ruoli che un utente può avere nel sistema. È condiviso con
il modulo di autenticazione, dove viene usato da `InternalAuthService`
per controllare i permessi di accesso. In questo modulo è presente come
tipo del campo `role` di `UserDto`, che il backend include nella
risposta di `GET /users`.

| Valore | Descrizione |
|---|---|
| `AMMINISTRATORE` | Utente con accesso completo alle funzionalità di gestione. Accede alla feature User Management |
| `OPERATORE_SANITARIO` | Utente operativo. Non accede alla feature User Management — le sue route sono protette da guard nel routing principale dell'applicazione |

---

### `UserManagementErrorType`

**File:** `user-management-error-type.enum.ts`
**Stereotipo:** `<<enumeration>>`

Mappa gli errori della gestione utenti ai casi d'uso dell'AdR.
Essere un enum esplicito mantiene la tracciabilità con l'AdR e lascia
spazio all'aggiunta di nuovi errori futuri senza modificare
l'interfaccia dei componenti. Il valore corrente corrisponde all'unico
scenario di errore previsto dall'AdR per questa feature.

Viene usato da `UserManagementComponent`: dopo un errore HTTP 409
ricevuto da `userApi.createUser()`, il componente smart assegna il
valore corrispondente al campo `formError` e lo passa via `@Input`
a `CreateUserFormComponent` per la visualizzazione nel template del form.

| Valore | UC corrispondente | Descrizione |
|---|---|---|
| `USERNAME_ALREADY_IN_USE` | UC46 | L'username inserito è già registrato nel Sistema. Il backend risponde con HTTP 409 Conflict e il Sistema non crea il nuovo utente |

---

## 3. Service

---

### `UserApiService`

**File:** `user-api.service.ts`
**Stereotipo:** `<<injectable>>`
**Scope:** `providedIn: 'root'` — singleton per tutta l'applicazione

È il Repository HTTP per il dominio utenti. La sua unica
responsabilità è astrarre le chiamate REST verso il backend: non
contiene logica di business, non mantiene stato, non conosce i
componenti che lo usano. Seguendo il Repository Pattern, centralizza
in un unico punto tutti gli accessi alla risorsa `/api/users`: se
un endpoint cambia, la modifica va effettuata in un solo file.

È iniettato esclusivamente da `UserManagementComponent`, che è l'unico
componente della feature a conoscere il layer HTTP. I componenti
presentazionali non hanno accesso diretto a questo service.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `baseUrl` | `String` | `private` | URL base del backend, iniettato tramite il token `API_BASE_URL`. Prefissato a tutti i path delle chiamate HTTP |
| `http` | `HttpClient` | `private` | Client HTTP Angular iniettato via DI. Unico punto di accesso alla rete per questa feature |

### Metodi

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `getUsers()` | `Observable<UserDto[]>` | UC6 | Chiama `GET /users` e ritorna la lista di tutti gli utenti del sistema. Usato da `UserManagementComponent` per inizializzare `users$` in `ngOnInit()` e per aggiornare la lista dopo una creazione o eliminazione riuscita |
| `createUser(dto: CreateUserDto)` | `Observable<UserCreatedResponse>` | UC7 | Chiama `POST /users` con il `CreateUserDto` compilato dall'Amministratore. Ritorna `UserCreatedResponse` contenente i dati del nuovo utente e la password temporanea generata dal backend. Usato da `UserManagementComponent.onFormSubmit()` |
| `deleteUser(id: String)` | `Observable<void>` | UC8 | Chiama `DELETE /users/:id` con l'identificatore dell'utente da eliminare. Non ritorna dati — solo la conferma dell'avvenuta eliminazione. Usato da `UserManagementComponent.onUserDeleted()` |

---

## 4. Component

---

### `UserManagementComponent`

**File:** `user-management/user-management.component.ts`
**Stereotipo:** `<<smartcomponent>>`
**Tipo:** Smart Component (Container)
**UC coperti:** UC6, UC7, UC7.1, UC7.2, UC7.3, UC7.4, UC8, UC46

È il componente radice e l'unico componente smart della feature.
Detiene tutto lo stato osservabile, effettua tutte le chiamate al
service e coordina la comunicazione tra i componenti presentazionali
figli tramite binding di template.

Il template di questo componente compone la UI completa: renderizza
`<app-user-list>`, `<app-create-user-form>` e — condizionalmente,
quando `createdResponse` è non nullo — `<app-user-created-dialog>`.
La comparsa e la scomparsa del dialog sono gestite con
`*ngIf="createdResponse"` nel template: non serve logica imperativa
per aprire o chiudere il dialog.

`users$` è un `Observable` inizializzato con un `BehaviorSubject`
interno usato come trigger di aggiornamento: ogniqualvolta l'utente
viene creato o eliminato con successo, il componente emette sul subject
per causare una nuova chiamata a `getUsers()` tramite `switchMap`.
Questo mantiene la lista sempre sincronizzata senza gestione manuale
della sottoscrizione.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `users$` | `Observable<UserDto[]>` | `public` | Stream della lista utenti, consumato dal template con `*ngIf="users$ \| async as users; else loading"`. Si aggiorna automaticamente ad ogni emissione del trigger interno, senza campi `loading` separati — il template gestisce i tre stati (caricamento, lista, errore) con blocchi `else` |
| `createdResponse` | `UserCreatedResponse \| null` | `public` | Valorizzato con la risposta di `userApi.createUser()` al successo della creazione. Quando non è `null`, il template mostra `UserCreatedDialogComponent` con questo valore come `@Input`. Reimpostato a `null` da `onDialogClosed()` quando l'Amministratore chiude il dialog |
| `formError` | `UserManagementErrorType \| null` | `public` | L'errore corrente da mostrare nel form. `null` in assenza di errori. Valorizzato con `UserManagementErrorType.USERNAME_ALREADY_IN_USE` quando `userApi.createUser()` risponde con HTTP 409 (UC46). Passato via `@Input` a `CreateUserFormComponent`. Reimpostato a `null` ad ogni nuova sottomissione del form |
| `userApi` | `UserApiService` | `private` | Iniettato via DI. È il solo punto di accesso al layer HTTP nella feature |

### Metodi

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `ngOnInit()` | `void` | UC6 | Lifecycle hook Angular. Inizializza `users$` collegandolo al trigger interno tramite `switchMap(() => userApi.getUsers())`. La lista viene caricata immediatamente al montaggio del componente |
| `onFormSubmit(dto: CreateUserDto)` | `void` | UC7, UC46 | Handler dell'evento `(formSubmit)` emesso da `CreateUserFormComponent`. Reimposta `formError` a `null`, quindi chiama `userApi.createUser(dto)`. In caso di successo assegna la risposta a `createdResponse` e aggiorna `users$`. In caso di HTTP 409 assegna `UserManagementErrorType.USERNAME_ALREADY_IN_USE` a `formError` — UC46 |
| `onUserDeleted(id: String)` | `void` | UC8 | Handler dell'evento `(deleteUser)` emesso da `UserListComponent`. Chiama `userApi.deleteUser(id)`. In caso di successo aggiorna `users$` per rimuovere l'utente eliminato dalla lista senza ulteriore navigazione |
| `onDialogClosed()` | `void` | — | Handler dell'evento `(closed)` emesso da `UserCreatedDialogComponent`. Reimposta `createdResponse` a `null`: il template rimuove il dialog dal DOM tramite `*ngIf` |

---

### `UserListComponent`

**File:** `user-management/components/user-list/user-list.component.ts`
**Stereotipo:** `<<presentationalcomponent>>`
**Tipo:** Dumb Component
**UC coperti:** UC6, UC6.1, UC6.1.1, UC6.1.2, UC6.1.3

Componente puramente presentazionale. Riceve la lista degli utenti
via `@Input` e si limita a renderizzarla: non inietta servizi, non
effettua chiamate HTTP, non mantiene stato proprio oltre a quello
strettamente necessario alla visualizzazione.

Per ogni elemento della lista mostra nome (UC6.1.1), cognome (UC6.1.2)
e username (UC6.1.3). Per ogni elemento espone un bottone "Elimina"
che, alla pressione, emette l'`id` dell'utente tramite l'`@Output`
`deleteUser`. È `UserManagementComponent` a ricevere questo evento e
a orchestrare la chiamata HTTP.

Non esiste un componente separato per la conferma dell'eliminazione:
la conferma è gestita direttamente nel template di questo componente
(ad esempio con un dialog nativo `window.confirm` o un elemento
condizionale inline), mantenendo la logica di presentazione all'interno
del layer dumb.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `users` | `UserDto[]` | `public` `@Input` | Array degli utenti da visualizzare, passato da `UserManagementComponent` tramite property binding. Iterato nel template con `*ngFor`. Quando l'array è vuoto il template mostra un messaggio di lista vuota |
| `deleteUser` | `EventEmitter<String>` | `public` `@Output` | Emette l'`id` dell'utente quando l'Amministratore preme il bottone "Elimina" per quell'utente. Il valore emesso viene ricevuto da `UserManagementComponent.onUserDeleted()` |

---

### `CreateUserFormComponent`

**File:** `user-management/components/create-user-form/create-user-form.component.ts`
**Stereotipo:** `<<presentationalcomponent>>`
**Tipo:** Dumb Component
**UC coperti:** UC7.1, UC7.2, UC7.3, UC46 (visualizzazione errore)

Componente puramente presentazionale che gestisce il Reactive Form per
la creazione di un nuovo Operatore Sanitario. Non chiama servizi: al
submit valida il form internamente e, se valido, emette il
`CreateUserDto` tramite l'`@Output` `formSubmit`. È
`UserManagementComponent` a ricevere il DTO e a orchestrare la chiamata
HTTP.

I campi `firstName`, `lastName` e `username` sono legati ai rispettivi
`FormControl` tramite `formControlName` nel template. I valori sono
gestiti dal `FormGroup` interno senza handler dedicati per
l'aggiornamento.

Il bottone di submit è disabilitato fintanto che il form è invalido
(validatori `required` e lunghezza minima). Il form non include campi
relativi alla password: il campo `tempPassword` non esiste in questa
architettura perché la generazione avviene interamente nel backend.

L'errore HTTP ricevuto da `UserManagementComponent` (in caso di username
già in uso — UC46) viene ricevuto tramite l'`@Input` `errorType` e
mostrato nel template come messaggio di errore inline sotto il campo
username. Il campo `errorType` viene reimpostato a `null` da
`UserManagementComponent` ad ogni nuova sottomissione.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `form` | `FormGroup` | `public` | Reactive form con i controlli `firstName` (required, minlength), `lastName` (required, minlength), `username` (required, minlength). Costruito in `ngOnInit()`. Il bottone di submit è disabilitato se `form.invalid` |
| `errorType` | `UserManagementErrorType \| null` | `public` `@Input` | Errore corrente da mostrare nel template. Passato da `UserManagementComponent` dopo una risposta HTTP 409. `null` in assenza di errori. Quando valorizzato con `USERNAME_ALREADY_IN_USE`, il template mostra un messaggio di errore inline sotto il campo username |
| `formSubmit` | `EventEmitter<CreateUserDto>` | `public` `@Output` | Emette il `CreateUserDto` quando l'Amministratore preme "Crea utente" e il form è valido. Ricevuto da `UserManagementComponent.onFormSubmit()` |

### Metodi

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `ngOnInit()` | `void` | — | Costruisce il `FormGroup` con i tre `FormControl` e le relative validazioni |
| `submit()` | `void` | UC7 | Chiamato dal bottone di submit nel template. Se `form.valid`, compone un `CreateUserDto` con i valori correnti dei controlli e lo emette tramite `formSubmit`. Se `form.invalid`, marca tutti i controlli come touched per far apparire i messaggi di validazione inline |
| `reset()` | `void` | — | Reimposta il form ai valori iniziali e annulla tutti i messaggi di validazione. Chiamato da `UserManagementComponent` (tramite `@ViewChild` o rimozione/reinserimento del componente nel DOM) dopo una creazione riuscita |

---

### `UserCreatedDialogComponent`

**File:** `user-management/components/user-created-dialog/user-created-dialog.component.ts`
**Stereotipo:** `<<presentationalcomponent>>`
**Tipo:** Dumb Component
**UC coperti:** UC7.4

Componente presentazionale che mostra la password temporanea generata
dal backend al termine della creazione di un nuovo Operatore Sanitario.
Il suo compito principale è presentare `UserCreatedResponse.temporaryPassword`
all'Amministratore con un avviso esplicito che il valore non sarà
recuperabile una volta chiuso il dialog (UC7.4).

Il dialog è inserito nel template di `UserManagementComponent` con
`*ngIf="createdResponse"`: appare quando `createdResponse` è non nullo,
scompare quando `UserManagementComponent` lo reimposta a `null` in
risposta all'evento `(closed)`.

Non effettua chiamate HTTP né accede a servizi. Riceve tutti i dati
necessari via `@Input` e segnala la propria chiusura tramite `@Output`.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `response` | `UserCreatedResponse` | `public` `@Input` | La risposta del backend contenente i dati del nuovo utente e la password temporanea. Il template mostra `response.user.firstName`, `response.user.username` e `response.temporaryPassword`. Non opzionale: il componente viene montato solo quando `createdResponse` è non nullo in `UserManagementComponent` |
| `closed` | `EventEmitter<void>` | `public` `@Output` | Emesso quando l'Amministratore clicca "Chiudi" o "Ho comunicato la password". Ricevuto da `UserManagementComponent.onDialogClosed()`, che reimposta `createdResponse` a `null` causando la rimozione del componente dal DOM tramite `*ngIf` |

---

## 5. Module

---

### `UserManagementModule`

**File:** `user-management/user-management.module.ts`
**Stereotipo:** `<<ngmodule>>`

NgModule Angular che incapsula tutta la feature di gestione utenti.
Dichiara i quattro componenti della feature e importa il modulo di
routing. `UserApiService` è `providedIn: 'root'` e non è registrato
in questo modulo — è disponibile globalmente tramite l'injector radice
e non è legato al ciclo di vita del modulo.

Le route di questa feature sono protette da `RoleGuard` nel routing
principale dell'applicazione, che ne limita l'accesso ai soli utenti
con ruolo `AMMINISTRATORE`.

---

### `UserManagementRoutingModule`

**File:** `user-management/user-management-routing.module.ts`
**Stereotipo:** `<<ngmodule>>`

Definisce le route interne alla feature. Tutte le route sono relative
al prefisso con cui il modulo è caricato (lazy) dall'app router.
La feature espone una singola route perché l'intera UI è gestita da
`UserManagementComponent`: la lista, il form di creazione e il dialog
post-creazione sono tutti renderizzati all'interno del template di
questo unico componente smart, senza navigazione tra route distinte.

Non definisce guard propri: la protezione è delegata al routing
principale, che già verifica il ruolo `AMMINISTRATORE` prima di
attivare il modulo.

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `routes` | `Routes` | `public` | `{ path: '', component: UserManagementComponent }` — unica route; tutto il flusso UC6, UC7, UC8 avviene all'interno di questo componente senza cambi di URL |

---

## 6. Relazioni

| Sorgente | Destinazione | Tipo | Descrizione |
|---|---|---|---|
| `UserApiService` | `HttpClient` | `-->` dipendenza (inietta) | Unico accesso alla rete — iniettato via DI nel costruttore |
| `UserApiService` | `API_BASE_URL` | `-->` dipendenza (inietta) | URL base del backend — iniettato via `@Inject(API_BASE_URL)` |
| `UserApiService` | `UserDto` | `..>` dipendenza tratteggiata | Ritorna `UserDto[]` come output di `getUsers()`. Non lo possiede |
| `UserApiService` | `CreateUserDto` | `..>` dipendenza tratteggiata | Accetta come parametro di `createUser()`. Non lo possiede |
| `UserApiService` | `UserCreatedResponse` | `..>` dipendenza tratteggiata | Ritorna `UserCreatedResponse` come output di `createUser()`. Non lo possiede |
| `UserManagementComponent` | `UserApiService` | `-->` dipendenza (inietta) | Unico componente della feature che accede al service. Lo usa in `ngOnInit()`, `onFormSubmit()` e `onUserDeleted()` |
| `UserManagementComponent` | `UserDto` | `..>` dipendenza tratteggiata | Usa `UserDto[]` come tipo del campo `users$` e come tipo dell'array passato a `UserListComponent` |
| `UserManagementComponent` | `CreateUserDto` | `..>` dipendenza tratteggiata | Riceve `CreateUserDto` dall'evento `formSubmit` di `CreateUserFormComponent` e lo passa a `userApi.createUser()` |
| `UserManagementComponent` | `UserCreatedResponse` | `..>` dipendenza tratteggiata | Riceve `UserCreatedResponse` dal successo di `userApi.createUser()` e lo assegna a `createdResponse` |
| `UserManagementComponent` | `UserManagementErrorType` | `..>` dipendenza tratteggiata | Assegna `USERNAME_ALREADY_IN_USE` a `formError` in risposta a HTTP 409 da `userApi.createUser()` — UC46 |
| `UserManagementComponent` | `UserListComponent` | `*--` composizione di template | Il template di `UserManagementComponent` renderizza `<app-user-list>`. Il ciclo di vita di `UserListComponent` è controllato dal parent. Non si traduce in un campo TypeScript: la relazione è di template, non di ownership a runtime |
| `UserManagementComponent` | `CreateUserFormComponent` | `*--` composizione di template | Il template di `UserManagementComponent` renderizza `<app-create-user-form>`. Medesima natura della relazione con `UserListComponent` |
| `UserManagementComponent` | `UserCreatedDialogComponent` | `*--` composizione di template condizionale | Il template di `UserManagementComponent` renderizza `<app-user-created-dialog>` solo quando `createdResponse` è non nullo (`*ngIf="createdResponse"`). Il ciclo di vita del dialog è interamente controllato dal parent tramite questo binding |
| `UserListComponent` | `UserDto` | `..>` dipendenza tratteggiata | Riceve `UserDto[]` via `@Input users` e itera il tipo nel template con `*ngFor` |
| `UserListComponent` | `UserManagementComponent` | `-->` evento (`deleteUser`) | Emette `id: String` tramite `@Output deleteUser` quando l'Amministratore preme "Elimina" su un utente. Ricevuto da `UserManagementComponent.onUserDeleted()` |
| `CreateUserFormComponent` | `CreateUserDto` | `..>` dipendenza tratteggiata (`«produces»`) | Compone e emette un `CreateUserDto` tramite `@Output formSubmit` al submit valido del form |
| `CreateUserFormComponent` | `UserManagementErrorType` | `..>` dipendenza tratteggiata | Riceve `UserManagementErrorType \| null` via `@Input errorType` e lo visualizza nel template del form |
| `CreateUserFormComponent` | `UserManagementComponent` | `-->` evento (`formSubmit`) | Emette `CreateUserDto` tramite `@Output formSubmit`. Ricevuto da `UserManagementComponent.onFormSubmit()` |
| `UserCreatedDialogComponent` | `UserCreatedResponse` | `..>` dipendenza tratteggiata | Riceve `UserCreatedResponse` via `@Input response` e visualizza `response.temporaryPassword` e `response.user` nel template |
| `UserCreatedDialogComponent` | `UserManagementComponent` | `-->` evento (`closed`) | Emette `void` tramite `@Output closed` quando l'Amministratore chiude il dialog. Ricevuto da `UserManagementComponent.onDialogClosed()` |
| `UserDto` | `UserRole` | `-->` dipendenza | `UserDto.role` è di tipo `UserRole` |
| `UserManagementModule` | `UserManagementComponent` | `-->` dichiarazione | Angular ownership — il componente è dichiarato nel modulo |
| `UserManagementModule` | `UserListComponent` | `-->` dichiarazione | Angular ownership — il componente è dichiarato nel modulo |
| `UserManagementModule` | `CreateUserFormComponent` | `-->` dichiarazione | Angular ownership — il componente è dichiarato nel modulo |
| `UserManagementModule` | `UserCreatedDialogComponent` | `-->` dichiarazione | Angular ownership — il componente è dichiarato nel modulo |
| `UserManagementModule` | `UserManagementRoutingModule` | `-->` importazione | Il modulo registra le proprie route interne |
| `UserManagementModule` | `UserApiService` | `..>` dipendenza tratteggiata | Il service è `providedIn: 'root'` — non dichiarato nel modulo ma disponibile globalmente tramite l'injector radice. Non è legato al ciclo di vita del modulo |
