# Spiegazione Plant Management UML

Documento di riferimento per il class diagram del modulo
`PlantManagementFeature` e `PlantApiService`
del Frontend dell'applicazione **View4Life**.

---

## Indice

1. [DTO](#1-dto)
   - [CreateWardDto](#createwarddto)
   - [UpdateWardDto](#updatewarddto)
   - [AssignOperatorDto](#assignoperatordto)
   - [AssignApartmentDto](#assignapartmentdto)
2. [Modelli di dominio](#2-modelli-di-dominio)
   - [Ward](#ward)
   - [Apartment](#apartment)
   - [User](#user)
   - [UserRole](#userrole)
   - [RemoveOperatorEvent](#removeoperatorevent)
   - [RemoveApartmentEvent](#removeapartmentevent)
   - [PlantManagementState](#plantmanagementstate)
3. [Token di iniezione](#3-token-di-iniezione)
   - [API_BASE_URL](#api_base_url)
4. [Service](#4-service)
   - [PlantApiService](#plantapiservice)
   - [UserApiService](#userapiservice)
   - [WardStore](#wardstore)
   - [WardOperationsService](#wardoperationsservice)
   - [AssignmentOperationsService](#assignmentoperationsservice)
   - [PlantManagementStore](#plantmanagementstore)
5. [Component](#5-component)
   - [PlantManagementPageComponent](#plantmanagementpagecomponent)
   - [WardCardComponent](#wardcardcomponent)
   - [ApartmentRowComponent](#apartmentrowcomponent)
   - [WardFormDialogComponent](#wardformdialogcomponent)
   - [AssignOperatorDialogComponent](#assignoperatordialogcomponent)
   - [AssignApartmentDialogComponent](#assignapartmentdialogcomponent)
   - [ConfirmDialogComponent](#confirmdialogcomponent)
6. [Guard](#6-guard)
   - [AdminGuard](#adminguard)
7. [Module](#7-module)
   - [PlantManagementModule](#plantmanagementmodule)
   - [PlantManagementRoutingModule](#plantmanagementroutingmodule)
8. [Relazioni](#8-relazioni)

---

## 1. DTO

I DTO (Data Transfer Object) di questa feature descrivono esclusivamente i
dati che il frontend **invia** al backend. Sono oggetti senza logica, usati
come contratto di scrittura nelle chiamate HTTP. Sono separati dai modelli
di dominio (`Ward`, `Apartment`) che descrivono invece i dati **ricevuti** in
lettura.

---

### `CreateWardDto`

**File:** `plant-api.dto.ts`
**Stereotipo:** `<<DTO>>`

Contiene i dati necessari alla creazione di un nuovo reparto (UC10).
L'`Amministratore` inserisce il nome nel form di `WardFormDialogComponent`
e il DTO viene composto in `onSubmit()` prima di essere inviato allo store
tramite `PlantManagementPageComponent`.

| Campo | Tipo | Descrizione |
|---|---|---|
| `name` | `string` | Nome del nuovo reparto — UC10.1. Il backend risponde con `409 Conflict` se il nome è già in uso (UC47) |

---

### `UpdateWardDto`

**File:** `plant-api.dto.ts`
**Stereotipo:** `<<DTO>>`

Contiene i dati per la modifica del nome di un reparto esistente (UC11).
Strutturalmente identico a `CreateWardDto`, ma viene tenuto separato
per rispettare l'Interface Segregation Principle: i due DTO hanno lifecycle
diversi e in futuro potrebbero divergere.

| Campo | Tipo | Descrizione |
|---|---|---|
| `name` | `string` | Nuovo nome del reparto — UC11 |

---

### `AssignOperatorDto`

**File:** `plant-api.dto.ts`
**Stereotipo:** `<<DTO>>`

Trasporta l'identificatore dell'Operatore Sanitario da assegnare a un reparto
(UC13). L'`Amministratore` seleziona l'utente nel dropdown di
`AssignOperatorDialogComponent` e il DTO viene composto in `onSubmit()`.

| Campo | Tipo | Descrizione |
|---|---|---|
| `userId` | `string` | Id dell'Operatore Sanitario selezionato — UC13.2 |

---

### `AssignApartmentDto`

**File:** `plant-api.dto.ts`
**Stereotipo:** `<<DTO>>`

Trasporta l'identificatore dell'appartamento da assegnare a un reparto
(UC15). L'`Amministratore` seleziona l'appartamento nel dropdown di
`AssignApartmentDialogComponent` e il DTO viene composto in `onSubmit()`.

| Campo | Tipo | Descrizione |
|---|---|---|
| `apartmentId` | `string` | Id dell'appartamento selezionato — UC15.2 |

---

## 2. Modelli di dominio

I modelli di dominio descrivono la forma dei dati **ricevuti** dal backend
e usati internamente dalla feature. Sono interfacce TypeScript senza logica.

---

### `Ward`

**File:** `ward.model.ts`
**Stereotipo:** `<<Interface>>`

Rappresenta un reparto dell'impianto. È l'aggregato centrale di questa
feature: ogni operazione di `PlantApiService` ruota attorno ad esso.
Usato da `WardCardComponent` come `@Input`, da `PlantManagementState`
come elemento della lista, e da `WardFormDialogComponent` come dato
pre-compilato in modalità modifica.

| Campo | Tipo | Descrizione |
|---|---|---|
| `id` | `string` | Identificatore univoco del reparto — chiave per update (UC11), delete (UC12), assign (UC13, UC14, UC15, UC16) |
| `name` | `string` | Nome del reparto — visualizzato in UC9.1.1 |
| `apartments` | `Apartment[]` | Lista degli appartamenti assegnati al reparto — visualizzata in UC9.1.2. La risposta `GET /wards` deve includere questo array popolato |
| `operators` | `User[]` | Lista degli Operatori Sanitari assegnati al reparto — visualizzata in UC9.1. La risposta `GET /wards` deve includere questo array popolato |

---

### `Apartment`

**File:** `apartment.model.ts`
**Stereotipo:** `<<Interface>>`

Rappresenta un appartamento all'interno di un reparto. Usato da
`ApartmentRowComponent` come `@Input` per la visualizzazione del nome
(UC9.1.2.1.1) e del controllo abilita/disabilita (UC31, UC32).

| Campo | Tipo | Descrizione |
|---|---|---|
| `id` | `string` | Identificatore univoco dell'appartamento — usato nelle chiamate di rimozione (UC16) e, tramite `ApartmentApiService`, nelle chiamate enable/disable (UC31, UC32) |
| `name` | `string` | Nome dell'appartamento — visualizzato in UC9.1.2.1.1 |
| `isEnabled` | `boolean` | Stato corrente dell'appartamento. `true` → il bottone "Disabilita" è visibile (UC32); `false` → il bottone "Abilita" è visibile (UC31) |

---

### `User`

**File:** `user.model.ts`
**Stereotipo:** `<<Interface>>`

Rappresenta la proiezione completa di un utente del sistema così come
restituita dal backend. Utilizzata sia dalla feature Plant Management per
popolare la lista degli operatori assegnati a un reparto (UC9.1) e il
dropdown di `AssignOperatorDialogComponent` (UC13.2), sia dalla feature
User Management per l'elenco utenti (UC6).

| Campo | Tipo | Descrizione |
|---|---|---|
| `id` | `string` | Identificatore univoco dell'utente — usato in `AssignOperatorDto.userId` (UC13) e nella chiamata di rimozione `removeOperatorFromWard` (UC14) |
| `firstName` | `string` | Nome dell'operatore — visualizzato nella lista operatori del reparto e nel dropdown di `AssignOperatorDialogComponent` |
| `lastName` | `string` | Cognome dell'operatore — visualizzato affianco al nome |
| `username` | `string` | Username dell'utente — visualizzato in UC6.1.3 (User Management). Non usato direttamente nella feature Plant Management |
| `role` | `UserRole` | Ruolo dell'utente. Usato da `AdminGuard` e dal frontend per condizionare la visibilità di aree riservate |

---

### `UserRole`

**File:** `user-role.enum.ts`
**Stereotipo:** `<<enum>>`
**Scope:** Riferimento esterno — definito nel modulo `auth`, condiviso tra le feature

Enumerazione dei ruoli utente del sistema. Tipizza `User.role` in modo
sicuro, usata da `AdminGuard` per il controllo di accesso e dal frontend
per la logica di visibilità condizionale.

| Valore | Descrizione |
|---|---|
| `AMMINISTRATORE` | Utente con accesso completo alle funzionalità di gestione |
| `OPERATORE_SANITARIO` | Utente con accesso alle funzionalità operative e di monitoraggio |

---

### `RemoveOperatorEvent`

**File:** `plant-management.events.ts`
**Stereotipo:** `<<Interface>>`

Tipizza il payload emesso da `WardCardComponent` quando l'Amministratore
rimuove un Operatore Sanitario da un reparto (UC14). Consolida i due
identificatori necessari in un unico tipo strutturato.

| Campo | Tipo | Descrizione |
|---|---|---|
| `wardId` | `string` | Identificatore del reparto da cui rimuovere l'operatore |
| `userId` | `string` | Identificatore dell'Operatore Sanitario da rimuovere |

---

### `RemoveApartmentEvent`

**File:** `plant-management.events.ts`
**Stereotipo:** `<<Interface>>`

Analogo a `RemoveOperatorEvent`, tipizza il payload emesso da
`WardCardComponent` quando l'Amministratore rimuove un appartamento
da un reparto (UC16).

| Campo | Tipo | Descrizione |
|---|---|---|
| `wardId` | `string` | Identificatore del reparto da cui rimuovere l'appartamento |
| `apartmentId` | `string` | Identificatore dell'appartamento da rimuovere |

---

### `PlantManagementState`

**File:** `plant-management-state.model.ts`
**Stereotipo:** `<<Interface>>`

Definisce la forma dello stato interno di `WardStore`. È l'unica struttura
che il `BehaviorSubject` conosce. I selettori pubblici di `WardStore`
(`wards$`, `isLoading$`, `error$`) sono proiezioni derivate tramite
`.pipe(map(...))` da questa interfaccia. Non è mai esposta direttamente
ai componenti.

| Campo | Tipo | Descrizione |
|---|---|---|
| `wards` | `Ward[]` | Lista corrente dei reparti. Aggiornata tramite le mutazioni esplicite di `WardStore` |
| `isLoading` | `boolean` | `true` durante qualsiasi chiamata HTTP in corso. Usato nel template per lo spinner |
| `error` | `string \| null` | Messaggio di errore dell'ultima operazione fallita. `null` in assenza di errori |

---

## 3. Token di iniezione

### `API_BASE_URL`

**File:** `core/tokens/api-base-url.token.ts`
**Stereotipo:** `<<InjectionToken>>`

Token Angular per iniettare l'URL base del backend senza hardcodarlo
nelle classi. Fornito a livello di `AppModule` o `environment`:

```typescript
{ provide: API_BASE_URL, useValue: environment.apiUrl }
```

Rispetta l'Open/Closed Principle: cambiare l'URL tra ambienti non richiede
modifiche alle classi che lo consumano.

---

## 4. Service

Questa feature adotta un'architettura a layer con separazione esplicita delle
responsabilità. Ogni classe ha **una sola ragione per cambiare**:

| Classe | Responsabilità unica |
|---|---|
| `PlantApiService` | Tradurre operazioni di dominio in chiamate HTTP |
| `WardStore` | Contenere e distribuire lo stato reattivo |
| `WardOperationsService` | Orchestrare il ciclo di vita dei reparti (CRUD) |
| `AssignmentOperationsService` | Orchestrare le operazioni di assegnazione |
| `PlantManagementStore` | Fare da unico punto di contatto per il page component |

---

### `PlantApiService`

**File:** `plant-management/services/plant-api.service.ts`
**Stereotipo:** `<<service>>`
**Scope:** `providedIn: 'root'` — singleton per tutta l'app
**Pattern:** Repository

Gateway HTTP puro per il dominio Plant Management. Non conosce lo stato
dell'applicazione, non chiama altri servizi interni, non gestisce errori
applicativi. Ogni metodo restituisce un `Observable<T>` **freddo**: la
chiamata HTTP non parte finché qualcuno non si sottoscrive.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `http` | `HttpClient` | `private` | Client HTTP Angular. Unico punto di accesso alla rete |
| `baseUrl` | `string` | `private` | URL base del backend, iniettato tramite `API_BASE_URL` |

### Metodi

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `getWards()` | `Observable<Ward[]>` | UC9, UC9.1, UC9.1.1, UC9.1.2 | `GET /api/wards`. Risposta completa: nome, lista appartamenti, lista operatori per ogni reparto |
| `createWard(dto)` | `Observable<Ward>` | UC10 | `POST /api/wards`. Ritorna il reparto creato — consente aggiornamento locale senza secondo round-trip. `409 Conflict` se nome duplicato (UC47) |
| `updateWard(wardId, dto)` | `Observable<Ward>` | UC11 | `PUT /api/wards/:wardId`. Ritorna il reparto aggiornato per patch locale |
| `deleteWard(wardId)` | `Observable<void>` | UC12 | `DELETE /api/wards/:wardId`. Risposta vuota |
| `assignOperatorToWard(wardId, dto)` | `Observable<void>` | UC13 | `POST /api/wards/:wardId/operators`. Risposta vuota: necessario reload |
| `removeOperatorFromWard(wardId, userId)` | `Observable<void>` | UC14 | `DELETE /api/wards/:wardId/operators/:userId`. Stessa strategia |
| `assignApartmentToWard(wardId, dto)` | `Observable<void>` | UC15 | `POST /api/wards/:wardId/apartments`. Risposta vuota: necessario reload |
| `removeApartmentFromWard(wardId, apartmentId)` | `Observable<void>` | UC16 | `DELETE /api/wards/:wardId/apartments/:apartmentId` |

> **Nota — UC31 / UC32:** I metodi `enableApartment()` e `disableApartment()`
> appartengono all'`ApartmentApiService` (modellato separatamente), gateway
> HTTP dedicato al dominio appartamento. Non rientrano nel perimetro di questo
> service.

---

### `UserApiService`

**File:** `core/services/user-api.service.ts`
**Stereotipo:** `<<injectable>>`
**Scope:** `providedIn: 'root'` — singleton condiviso tra le feature
**Pattern:** Repository

Gateway HTTP per il dominio utenti. Condiviso tra `AssignOperatorDialogComponent`
(dropdown UC13.2) e `UserManagementFeature` (UC6, UC7, UC8). Non appartiene
alla feature Plant Management ma è una sua dipendenza indiretta.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `baseUrl` | `string` | `private` | URL base del backend |
| `http` | `HttpClient` | `private` | Client HTTP Angular |

### Metodi

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `getUsers()` | `Observable<User[]>` | UC6, UC13.2 | `GET /api/users`. Ritorna tutti gli utenti del sistema |
| `createUser(dto: CreateUserDto)` | `Observable<UserCreatedResponse>` | UC7 | `POST /api/users`. Solo `UserManagementFeature` |
| `deleteUser(userId: string)` | `Observable<void>` | UC8 | `DELETE /api/users/:userId`. Solo `UserManagementFeature` |

---

### `WardStore`

**File:** `plant-management/services/ward.store.ts`
**Stereotipo:** `<<service>>`
**Scope:** `@Injectable()` senza `providedIn` — module-scoped
**Pattern:** BehaviorSubject State Container
**Responsabilità unica:** contenere e distribuire lo stato reattivo della feature

Non conosce `PlantApiService`, non fa chiamate HTTP, non contiene logica
di business. È l'unico oggetto che scrive sul `BehaviorSubject` tramite
`setState()` privato. Espone i selettori pubblici in sola lettura e accetta
mutazioni esclusivamente tramite metodi nominali espliciti.

Le mutazioni sono **tipizzate e nominate** — `addWard()`, `replaceWard()`,
`removeWard()`, `patchApartment()` — per rendere visibile nel modello quali
tipi di cambiamento di stato sono possibili, impedire mutazioni arbitrarie
tramite spread generici, e rendere ogni operazione testabile in isolamento
senza dover mockare chiamate HTTP.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `state$` | `BehaviorSubject<PlantManagementState>` | `private` | Sorgente unica di verità. Privato: nessun servizio esterno può scriverci direttamente. `BehaviorSubject` perché deve emettere il valore corrente anche ai sottoscrittori tardivi |
| `wards$` | `Observable<Ward[]>` | `public` | Selettore: `state$.pipe(map(s => s.wards))` |
| `isLoading$` | `Observable<boolean>` | `public` | Selettore: `state$.pipe(map(s => s.isLoading))` |
| `error$` | `Observable<string \| null>` | `public` | Selettore: `state$.pipe(map(s => s.error))` |

### Metodi di mutazione

| Metodo | Firma | Descrizione |
|---|---|---|
| `setWards` | `(wards: Ward[]): void` | Sostituisce l'intera lista. Usato dopo reload completo da `AssignmentOperationsService` |
| `addWard` | `(ward: Ward): void` | Appende un reparto. Usato da `WardOperationsService.createWard()` |
| `replaceWard` | `(ward: Ward): void` | Sostituisce il reparto con `id` corrispondente tramite `Array.map()`. Usato da `WardOperationsService.updateWard()` |
| `removeWard` | `(wardId: string): void` | Rimuove per id tramite `Array.filter()`. Usato da `WardOperationsService.deleteWard()` |
| `patchApartment` | `(apartmentId: string, patch: Partial<Apartment>): void` | Patch chirurgica: naviga la lista di ward, trova il ward contenente l'appartamento, applica lo spread parziale. Usato per aggiornare `isEnabled` dopo UC31/UC32 |
| `setLoading` | `(value: boolean): void` | Aggiorna il flag `isLoading` |
| `setError` | `(message: string \| null): void` | Scrive o cancella il messaggio di errore. Resetta sempre `isLoading: false` |
| `setState` | `(partial: Partial<PlantManagementState>): void` | `private`. Unico punto che chiama `state$.next()`. Applica spread sul valore corrente |

---

### `WardOperationsService`

**File:** `plant-management/services/ward-operations.service.ts`
**Stereotipo:** `<<service>>`
**Scope:** `@Injectable()` senza `providedIn` — module-scoped
**Responsabilità unica:** orchestrare le operazioni di ciclo di vita dei reparti (Ward CRUD)

Inietta `PlantApiService` per le chiamate HTTP e `WardStore` per aggiornare
lo stato. Non possiede stato proprio.

I metodi restituiscono **`Observable<void>`** — non sottoscrivono internamente.
È `PlantManagementStore` il responsabile della sottoscrizione, perché è lì
che vive il `destroy$` per la gestione del lifecycle. Ogni Observable restituito
è una pipeline reattiva composta con operatori RxJS (`tap`, `catchError`, `map`)
che include la logica di aggiornamento dello store e la gestione degli errori.
Il chiamante deve solo sottoscriversi con `takeUntil(destroy$)`.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `api` | `PlantApiService` | `private` | Gateway HTTP per le operazioni sui reparti |
| `store` | `WardStore` | `private` | Destinatario degli aggiornamenti di stato |

### Metodi

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `loadWards()` | `Observable<void>` | UC9 | `api.getWards()` → `tap(wards => store.setWards(wards))` → `tap(_ => store.setLoading(false))` → `catchError(err => store.setError(...), EMPTY)` |
| `createWard(dto)` | `Observable<void>` | UC10, UC47 | `api.createWard(dto)` → `tap(ward => store.addWard(ward))` → `catchError`. In caso di `409 Conflict`, `catchError` scrive il messaggio di nome duplicato in `store.setError()` (UC47) |
| `updateWard(wardId, dto)` | `Observable<void>` | UC11 | `api.updateWard(wardId, dto)` → `tap(ward => store.replaceWard(ward))` → `catchError` |
| `deleteWard(wardId)` | `Observable<void>` | UC12 | `api.deleteWard(wardId)` → `tap(_ => store.removeWard(wardId))` → `catchError` |

---

### `AssignmentOperationsService`

**File:** `plant-management/services/assignment-operations.service.ts`
**Stereotipo:** `<<service>>`
**Scope:** `@Injectable()` senza `providedIn` — module-scoped
**Responsabilità unica:** orchestrare le operazioni di assegnazione ward↔operator e ward↔apartment

Inietta `PlantApiService` e `WardStore`. Come `WardOperationsService`,
restituisce `Observable<void>` senza sottoscrivere internamente.

**Strategia di aggiornamento — reload completo:** tutte e quattro le
operazioni ricevono `Observable<void>` dal backend (nessun corpo di risposta).
Non essendo possibile una patch chirurgica senza il ward aggiornato, la scelta
è ricaricare l'intera lista tramite `switchMap(_ => api.getWards())`. Questa
strategia è esplicita e localizzata qui, non distribuita nel `PlantManagementStore`.

L'helper `reloadAfter()` è **privato**: è un dettaglio implementativo condiviso
dai quattro metodi pubblici, non fa parte dell'interfaccia del servizio.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `api` | `PlantApiService` | `private` | Gateway HTTP per le operazioni di assegnazione |
| `store` | `WardStore` | `private` | Destinatario di `setWards()` dopo reload completo |

### Metodi

| Metodo | Ritorna | Visibilità | UC | Descrizione |
|---|---|---|---|---|
| `reloadAfter(op)` | `Observable<void>` | `private` | — | Helper: `op.pipe(switchMap(_ => api.getWards()), tap(wards => store.setWards(wards)), tap(_ => store.setLoading(false)), catchError(...))` |
| `assignOperator(wardId, dto)` | `Observable<void>` | `public` | UC13 | `reloadAfter(api.assignOperatorToWard(wardId, dto))` |
| `removeOperator(wardId, userId)` | `Observable<void>` | `public` | UC14 | `reloadAfter(api.removeOperatorFromWard(wardId, userId))` |
| `assignApartment(wardId, dto)` | `Observable<void>` | `public` | UC15 | `reloadAfter(api.assignApartmentToWard(wardId, dto))` |
| `removeApartment(wardId, apartmentId)` | `Observable<void>` | `public` | UC16 | `reloadAfter(api.removeApartmentFromWard(wardId, apartmentId))` |

---

### `PlantManagementStore`

**File:** `plant-management/services/plant-management.store.ts`
**Stereotipo:** `<<service>>`
**Scope:** `@Injectable()` senza `providedIn` — module-scoped
**Pattern:** Facade
**Responsabilità unica:** essere l'unico punto di contatto tra `PlantManagementPageComponent` e il layer dei servizi interni

Non possiede stato proprio (`BehaviorSubject` è in `WardStore`). Non contiene
logica di orchestrazione HTTP (è nei command service). Non ha metodi privati
`setState()` o `handleError()` — quelle responsabilità appartengono
rispettivamente a `WardStore` e ai command service.

Il suo compito è duplice: **esporre i selettori** di `WardStore` al page
component (che non deve sapere che `WardStore` esiste) e **delegare i comandi**
ai command service appropriati, sottoscrivendo gli `Observable<void>` restituiti
con `takeUntil(destroy$)`.

La gestione del lifecycle delle sottoscrizioni è centralizzata qui tramite
`destroy$` e `ngOnDestroy()`. Quando Angular distrugge il modulo alla
navigazione fuori da `/plant-management`, tutte le sottoscrizioni attive
vengono automaticamente cancellate.

**Cambia solo se cambia la composizione della feature** — cioè se viene
aggiunto o rimosso un intero sotto-dominio.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `wardStore` | `WardStore` | `private` | Sorgente dei selettori pubblici |
| `wardOperations` | `WardOperationsService` | `private` | Delegato per Ward CRUD |
| `wardAssignmentOperations` | `AssignmentOperationsService` | `private` | Delegato per le assegnazioni |
| `destroy$` | `Subject<void>` | `private` | Usato con `takeUntil(destroy$)` in ogni sottoscrizione per prevenire memory leak |
| `wards$` | `Observable<Ward[]>` | `public` | Passthrough: `wardStore.wards$` |
| `isLoading$` | `Observable<boolean>` | `public` | Passthrough: `wardStore.isLoading$` |
| `error$` | `Observable<string \| null>` | `public` | Passthrough: `wardStore.error$` |

### Metodi

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `ngOnDestroy()` | `void` | — | `destroy$.next()` e `destroy$.complete()`. Cancella tutte le sottoscrizioni attive |
| `loadWards()` | `void` | UC9 | `wardStore.setLoading(true)` poi sottoscrive `wardOperations.loadWards().pipe(takeUntil(destroy$))` |
| `createWard(dto)` | `void` | UC10 | `wardStore.setLoading(true)` poi sottoscrive `wardOperations.createWard(dto).pipe(takeUntil(destroy$))` |
| `updateWard(wardId, dto)` | `void` | UC11 | Delega a `wardOperations.updateWard()` con `takeUntil(destroy$)` |
| `deleteWard(wardId)` | `void` | UC12 | Delega a `wardOperations.deleteWard()` con `takeUntil(destroy$)` |
| `assignOperator(wardId, dto)` | `void` | UC13 | `wardStore.setLoading(true)` poi sottoscrive `wardAssignmentOperations.assignOperator().pipe(takeUntil(destroy$))` |
| `removeOperator(wardId, userId)` | `void` | UC14 | Delega a `wardAssignmentOperations.removeOperator()` con `takeUntil(destroy$)` |
| `assignApartment(wardId, dto)` | `void` | UC15 | Delega a `wardAssignmentOperations.assignApartment()` con `takeUntil(destroy$)` |
| `removeApartment(wardId, apartmentId)` | `void` | UC16 | Delega a `wardAssignmentOperations.removeApartment()` con `takeUntil(destroy$)` |
| `enableApartment(apartmentId)` | `void` | UC31 | Delega ad `ApartmentApiService` (modellato separatamente). Al completamento aggiorna `wardStore.patchApartment(apartmentId, { isEnabled: true })` |
| `disableApartment(apartmentId)` | `void` | UC32 | Analogo a `enableApartment` con `isEnabled: false` |

> **Nota — UC31 / UC32:** I metodi sono esposti dalla facade per mantenere
> invariata l'interfaccia verso `PlantManagementPageComponent`. La chiamata
> HTTP è delegata ad `ApartmentApiService`. `WardStore.patchApartment()` è il
> meccanismo con cui lo stato locale viene aggiornato chirurgicamente al
> completamento, senza ricaricare l'intera lista.

---

## 5. Component

### `PlantManagementPageComponent`

**File:** `plant-management/components/plant-management-page/plant-management-page.component.ts`
**Stereotipo:** `<<component>>`
**Tipo:** Smart Component (Container)
**Route:** `/plant-management` — protetta da `AdminGuard`
**UC coperti:** UC9, UC10, UC11, UC12, UC13, UC14, UC15, UC16, UC31, UC32

È il punto di ingresso della route e l'unico componente *smart* della feature.
Conosce `PlantManagementStore` e `DialogService`. Tutti gli altri componenti
sono *dumb*. Il template usa esclusivamente il pipe `async` per `wards$` e
`isLoading$`. La sottoscrizione manuale a `error$` (per la snackbar) è
protetta da `takeUntil(destroy$)`.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `wards$` | `Observable<Ward[]>` | `public` | Riferimento a `store.wards$`. Consumato nel template con `*ngFor="let ward of wards$ \| async"` |
| `isLoading$` | `Observable<boolean>` | `public` | Riferimento a `store.isLoading$`. Mostra/nasconde lo spinner globale |
| `error$` | `Observable<string \| null>` | `public` | Riferimento a `store.error$`. Osservato manualmente in `ngOnInit()` per la snackbar |
| `destroy$` | `Subject<void>` | `private` | Usato con `takeUntil(destroy$)` per terminare la sottoscrizione manuale a `error$` |

### Metodi

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `ngOnInit()` | `void` | UC9 | Chiama `store.loadWards()`. Sottoscrive `error$` con `takeUntil(destroy$)` per mostrare una snackbar a ogni errore |
| `ngOnDestroy()` | `void` | — | `destroy$.next()` e `destroy$.complete()` |
| `onCreateWard()` | `void` | UC10 | Apre `WardFormDialogComponent` in modalità creazione (`ward: null`). Su `afterClosed()` con DTO valido chiama `store.createWard(dto)` |
| `onEditWard(ward)` | `void` | UC11 | Apre `WardFormDialogComponent` in modalità modifica (`ward` non null). Su conferma chiama `store.updateWard(ward.id, dto)` |
| `onDeleteWard(wardId)` | `void` | UC12 | Apre `ConfirmDialogComponent`. Su conferma chiama `store.deleteWard(wardId)` |
| `onAssignOperator(wardId)` | `void` | UC13 | Apre `AssignOperatorDialogComponent`. Su conferma chiama `store.assignOperator(wardId, dto)` |
| `onRemoveOperator(wardId, userId)` | `void` | UC14 | Riceve `RemoveOperatorEvent`. Apre `ConfirmDialogComponent`. Su conferma chiama `store.removeOperator(wardId, userId)` |
| `onAssignApartment(wardId)` | `void` | UC15 | Calcola `availableApartments`. Apre `AssignApartmentDialogComponent`. Su conferma chiama `store.assignApartment(wardId, dto)` |
| `onRemoveApartment(wardId, apartmentId)` | `void` | UC16 | Riceve `RemoveApartmentEvent`. Apre `ConfirmDialogComponent`. Su conferma chiama `store.removeApartment(wardId, apartmentId)` |
| `onEnableApartment(apartmentId)` | `void` | UC31 | Chiama `store.enableApartment(apartmentId)` |
| `onDisableApartment(apartmentId)` | `void` | UC32 | Chiama `store.disableApartment(apartmentId)` |

---

### `WardCardComponent`

**File:** `plant-management/components/ward-card/ward-card.component.ts`
**Stereotipo:** `<<component>>`
**Tipo:** Dumb Component (Presentational)
**UC coperti:** UC9.1, UC9.1.1, UC9.1.2, UC11, UC12, UC13, UC14, UC15, UC16, UC31, UC32

Riceve un singolo `Ward` via `@Input()` e renderizza tutte le informazioni
del reparto. Ogni azione utente è propagata verso l'alto tramite `@Output()`
dedicato. Gestisce localmente solo `isExpanded` — stato di pura UI.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `ward` | `Ward` | `public @Input()` | Il reparto da visualizzare |
| `isExpanded` | `boolean` | `private` | Stato di espansione/collasso del pannello. Non appartiene allo store |

### Output

| Output | Tipo emesso | UC | Descrizione |
|---|---|---|---|
| `editWard` | `Ward` | UC11 | Emette il `Ward` completo al click su "Modifica nome" |
| `deleteWard` | `string` (wardId) | UC12 | Emette l'id del reparto al click su "Elimina" |
| `assignOperator` | `string` (wardId) | UC13 | Emette l'id del reparto al click su "Aggiungi operatore" |
| `removeOperator` | `RemoveOperatorEvent` | UC14 | Emette `{ wardId, userId }` al click su "Rimuovi" su un operatore |
| `assignApartment` | `string` (wardId) | UC15 | Emette l'id del reparto al click su "Assegna appartamento" |
| `removeApartment` | `RemoveApartmentEvent` | UC16 | Emette `{ wardId, apartmentId }` al click su "Rimuovi" su un appartamento |
| `enableApartment` | `string` (apartmentId) | UC31 | Bubblato da `ApartmentRowComponent.(enable)` |
| `disableApartment` | `string` (apartmentId) | UC32 | Bubblato da `ApartmentRowComponent.(disable)` |

### Metodi

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `toggleExpanded()` | `void` | Inverte `isExpanded`. Unico metodo con side effect interno |

---

### `ApartmentRowComponent`

**File:** `plant-management/components/apartment-row/apartment-row.component.ts`
**Stereotipo:** `<<component>>`
**Tipo:** Dumb Leaf Component
**UC coperti:** UC9.1.2.1.1, UC31, UC32

Componente foglia. Renderizza una riga con il nome dell'appartamento
e un bottone di toggle il cui testo cambia in base a `apartment.isEnabled`.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `apartment` | `Apartment` | `public @Input()` | L'appartamento da visualizzare |
| `wardId` | `string` | `public @Input()` | Id del reparto padre |

### Output

| Output | Tipo emesso | UC | Descrizione |
|---|---|---|---|
| `enable` | `string` (apartmentId) | UC31 | Emesso al click su "Abilita". Visibile solo se `!apartment.isEnabled` |
| `disable` | `string` (apartmentId) | UC32 | Emesso al click su "Disabilita". Visibile solo se `apartment.isEnabled` |

---

### `WardFormDialogComponent`

**File:** `plant-management/components/ward-form-dialog/ward-form-dialog.component.ts`
**Stereotipo:** `<<component>>`
**Tipo:** Dialog Component
**UC coperti:** UC10, UC10.1, UC11, UC47

Gestisce sia la creazione (UC10) sia la modifica (UC11) del nome di un reparto.
La modalità è determinata da `ward` come dialog data: `null` indica creazione,
un `Ward` valido indica modifica.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `ward` | `Ward \| null` | `public` | `null` → creazione, valorizzato → modifica |
| `isEditMode` | `boolean` | `public` | Derivato da `ward !== null` in `ngOnInit()`. Controlla titolo e testo del bottone |
| `form` | `FormGroup` | `public` | Controllo `name`. Validatori: `required`, `maxLength(100)` |

### Metodi

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `ngOnInit()` | `void` | UC10, UC11 | Costruisce il form. In modifica pre-compila `name` con `ward.name` |
| `onSubmit()` | `void` | UC10, UC11 | Se valido, chiude con `{ name }` come DTO. Se non valido, marca i campi `touched` |
| `onCancel()` | `void` | — | Chiude con `undefined` |

**Nota UC47:** L'errore di nome duplicato arriva in modo asincrono dopo la
chiusura del dialog. `WardOperationsService` scrive il messaggio in
`WardStore.setError()`, da cui `PlantManagementStore.error$` lo propaga
come snackbar. Il dialog non viene riaperto.

---

### `AssignOperatorDialogComponent`

**File:** `plant-management/components/assign-operator-dialog/assign-operator-dialog.component.ts`
**Stereotipo:** `<<component>>`
**Tipo:** Semi-Smart Dialog Component
**UC coperti:** UC13, UC13.1, UC13.2

Gestisce la selezione dell'Operatore Sanitario da assegnare a un reparto.
Il reparto (UC13.1) è già noto al momento dell'apertura. Inietta
`UserApiService` per popolare il dropdown (UC13.2).

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `wardId` | `string` | `public` | Id del reparto destinazione — UC13.1 già risolto |
| `availableWards` | `Ward[]` | `public` | Lista reparti per visualizzazione di contesto |
| `operators$` | `Observable<User[]>` | `private` | Inizializzato in `ngOnInit()` via `userApiService.getUsers()`. Consumato con `async` pipe nel dropdown |
| `form` | `FormGroup` | `public` | Controllo `userId`. Validatore: `required` |

### Metodi

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `ngOnInit()` | `void` | UC13.2 | Costruisce il form. Inizializza `operators$` |
| `onSubmit()` | `void` | UC13 | Se valido, chiude con `{ userId }` come `AssignOperatorDto` |
| `onCancel()` | `void` | — | Chiude con `undefined` |

---

### `AssignApartmentDialogComponent`

**File:** `plant-management/components/assign-apartment-dialog/assign-apartment-dialog.component.ts`
**Stereotipo:** `<<component>>`
**Tipo:** Dialog Component
**UC coperti:** UC15, UC15.1, UC15.2

Gestisce la selezione dell'appartamento da assegnare a un reparto. La lista
`availableApartments` è calcolata dal page component prima dell'apertura.
Nessuna dipendenza da servizi.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `wardId` | `string` | `public` | Id del reparto destinazione — UC15.1 già risolto |
| `availableWards` | `Ward[]` | `public` | Lista reparti per visualizzazione di contesto |
| `availableApartments` | `Apartment[]` | `public` | Appartamenti non ancora assegnati, calcolati dal page component |
| `form` | `FormGroup` | `public` | Controllo `apartmentId`. Validatore: `required` |

### Metodi

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `ngOnInit()` | `void` | UC15.2 | Costruisce il form |
| `onSubmit()` | `void` | UC15 | Se valido, chiude con `{ apartmentId }` come `AssignApartmentDto` |
| `onCancel()` | `void` | — | Chiude con `undefined` |

---

### `ConfirmDialogComponent`

**File:** `shared/components/confirm-dialog/confirm-dialog.component.ts`
**Stereotipo:** `<<component>>`
**Tipo:** Dumb Component condiviso (Shared/Presentational)
**Package:** `SharedModule` — riferimento esterno
**UC coperti:** UC12, UC14, UC16 (e qualsiasi flusso di conferma dell'applicazione)

Componente presentazionale per dialog di conferma generici. Riceve testo e
label via `@Input`, emette l'esito via `@Output`. Usato da
`PlantManagementPageComponent` tramite `DialogService` per UC12, UC14, UC16.

### Attributi

| Attributo | Tipo | Visibilità | Stereotipo | Descrizione |
|---|---|---|---|---|
| `message` | `string` | `public` | `@Input` | Testo del corpo del dialog |
| `confirmLabel` | `string` | `public` | `@Input` | Label bottone conferma. Default: `"Conferma"` |
| `cancelLabel` | `string` | `public` | `@Input` | Label bottone annullamento. Default: `"Annulla"` |
| `confirmed` | `EventEmitter<void>` | `public` | `@Output` | Emesso alla conferma |
| `cancelled` | `EventEmitter<void>` | `public` | `@Output` | Emesso all'annullamento o chiusura |

### Metodi

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `onConfirm()` | `void` | Emette `confirmed` |
| `onCancel()` | `void` | Emette `cancelled` |

---

## 6. Guard

### `AdminGuard`

**File:** `core/guards/admin.guard.ts`
**Stereotipo:** `<<guard>>`
**Scope:** Condiviso — definito nel `CoreModule`

Implementa `CanActivate`. Protegge la route `/plant-management` ai soli
utenti con ruolo `Amministratore`. Il metodo
`canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean`
legge il ruolo dalla sessione tramite `InternalAuthService`. Se il ruolo
non corrisponde, redirige a `/dashboard`.

> **⚠️ Nota:** L'iniezione di `InternalAuthService` non è esplicitata nel
> diagramma corrente. Deve essere aggiunta al modello per rendere visibile
> la dipendenza che rende il guard funzionale.

---

## 7. Module

### `PlantManagementModule`

**File:** `plant-management/plant-management.module.ts`
**Stereotipo:** `<<module>>`

NgModule che incapsula tutta la feature. Dichiara i componenti e registra
i servizi module-scoped in `providers[]`.

Tutti i servizi dello strato di stato e orchestrazione sono **module-scoped**:
creati all'attivazione della route `/plant-management`, distrutti alla
navigazione fuori. Questo garantisce che stato e sottoscrizioni vengano
rilasciati automaticamente.

**Providers registrati:**

| Servizio | Motivazione del module-scope |
|---|---|
| `PlantManagementStore` | Unico punto di contatto del page component — vive per tutta la durata della route |
| `WardStore` | Contiene il `BehaviorSubject` — stesso lifecycle della route |
| `WardOperationsService` | Dipende da `WardStore` module-scoped |
| `AssignmentOperationsService` | Dipende da `WardStore` module-scoped |

---

### `PlantManagementRoutingModule`

**File:** `plant-management/plant-management-routing.module.ts`
**Stereotipo:** `<<module>>`

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `routes` | `Routes` | `public` | `{ path: '', component: PlantManagementPageComponent, canActivate: [AdminGuard] }` |

---

## 8. Relazioni

| Sorgente | Destinazione | Tipo | Descrizione |
|---|---|---|---|
| `PlantApiService` | `HttpClient` | `-->` inietta | Unico accesso alla rete |
| `PlantApiService` | `API_BASE_URL` | `-->` inietta | URL base via `@Inject(API_BASE_URL)` |
| `PlantApiService` | `Ward` | `..>` usa | Ritorna `Ward` e `Ward[]`. Non lo possiede |
| `PlantApiService` | `CreateWardDto` | `..>` usa | Parametro di `createWard()` |
| `PlantApiService` | `UpdateWardDto` | `..>` usa | Parametro di `updateWard()` |
| `PlantApiService` | `AssignOperatorDto` | `..>` usa | Parametro di `assignOperatorToWard()` |
| `PlantApiService` | `AssignApartmentDto` | `..>` usa | Parametro di `assignApartmentToWard()` |
| `UserApiService` | `HttpClient` | `-->` inietta | Client HTTP |
| `UserApiService` | `API_BASE_URL` | `-->` inietta | Stesso token di `PlantApiService` |
| `UserApiService` | `User` | `..>` usa | Ritorna `User[]` da `getUsers()` |
| `WardStore` | `PlantManagementState` | `o--` aggrega | Possiede il `BehaviorSubject<PlantManagementState>` |
| `PlantManagementState` | `Ward` | `o--` aggrega | Lo stato contiene `Ward[]` |
| `Ward` | `Apartment` | `o--` aggrega | Un reparto aggrega una lista di appartamenti |
| `Ward` | `User` | `o--` aggrega | Un reparto aggrega una lista di operatori assegnati |
| `WardOperationsService` | `PlantApiService` | `-->` inietta | Gateway HTTP per Ward CRUD |
| `WardOperationsService` | `WardStore` | `-->` inietta | Destinatario delle mutazioni `addWard`, `replaceWard`, `removeWard` |
| `AssignmentOperationsService` | `PlantApiService` | `-->` inietta | Gateway HTTP per le assegnazioni |
| `AssignmentOperationsService` | `WardStore` | `-->` inietta | Destinatario di `setWards()` dopo reload completo |
| `PlantManagementStore` | `WardStore` | `-->` inietta | Fonte dei selettori pubblici (`wards$`, `isLoading$`, `error$`) |
| `PlantManagementStore` | `WardOperationsService` | `-->` inietta | Delegato per Ward CRUD |
| `PlantManagementStore` | `AssignmentOperationsService` | `-->` inietta | Delegato per le assegnazioni |
| `PlantManagementPageComponent` | `PlantManagementStore` | `-->` inietta | Unico servizio noto al page component |
| `PlantManagementPageComponent` | `DialogService` | `-->` inietta | Apertura imperativa dei dialog |
| `PlantManagementPageComponent` | `ConfirmDialogComponent` | `..>` «uses» | Aperto via `DialogService` per UC12, UC14, UC16 |
| `PlantManagementPageComponent` | `WardCardComponent` | `-->` contenimento | Renderizzato in `*ngFor` nel template |
| `WardCardComponent` | `ApartmentRowComponent` | `*--` composizione | Renderizzato in `*ngFor` su `ward.apartments` |
| `WardCardComponent` | `RemoveOperatorEvent` | `..>` usa | Emette questo tipo sull'output `removeOperator` |
| `WardCardComponent` | `RemoveApartmentEvent` | `..>` usa | Emette questo tipo sull'output `removeApartment` |
| `WardFormDialogComponent` | `FormBuilder` | `-->` inietta | Costruisce il `FormGroup` in `ngOnInit()` |
| `AssignOperatorDialogComponent` | `FormBuilder` | `-->` inietta | Costruisce il `FormGroup` in `ngOnInit()` |
| `AssignOperatorDialogComponent` | `UserApiService` | `-->` inietta | Carica la lista operatori per il dropdown (UC13.2) |
| `AssignApartmentDialogComponent` | `FormBuilder` | `-->` inietta | Costruisce il `FormGroup` in `ngOnInit()` |
| `AdminGuard` | `PlantManagementPageComponent` | `..>` protegge | Controlla l'accesso alla route |
| `PlantManagementModule` | `PlantManagementPageComponent` | `-->` dichiara | Angular ownership |
| `PlantManagementModule` | `WardCardComponent` | `-->` dichiara | Angular ownership |
| `PlantManagementModule` | `ApartmentRowComponent` | `-->` dichiara | Angular ownership |
| `PlantManagementModule` | `WardFormDialogComponent` | `-->` dichiara | Angular ownership |
| `PlantManagementModule` | `AssignOperatorDialogComponent` | `-->` dichiara | Angular ownership |
| `PlantManagementModule` | `AssignApartmentDialogComponent` | `-->` dichiara | Angular ownership |
| `PlantManagementModule` | `PlantManagementStore` | `-->` provider | Module-scoped |
| `PlantManagementModule` | `WardStore` | `-->` provider | Module-scoped |
| `PlantManagementModule` | `WardOperationsService` | `-->` provider | Module-scoped |
| `PlantManagementModule` | `AssignmentOperationsService` | `-->` provider | Module-scoped |
| `PlantManagementModule` | `PlantManagementRoutingModule` | `-->` importa | Registra le route interne |
| `PlantManagementModule` | `AuthInterceptor` | `-->` importa | Riferimento esterno (SharedModule). Aggiunge il token JWT alle richieste HTTP uscenti |
