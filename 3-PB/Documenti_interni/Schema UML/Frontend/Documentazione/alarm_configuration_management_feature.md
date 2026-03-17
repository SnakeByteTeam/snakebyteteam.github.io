# Documentazione Architettura — Alarm Module

Documento di riferimento per il class diagram del modulo allarmi del Frontend
dell'applicazione **View4Life**.

Il documento copre tre componenti C4 Level 3 progettati come un unico modulo
coeso:

- `AlarmApiService` — layer HTTP condiviso
- `AlarmConfigurationFeature` — gestione configurazione allarmi (Amministratore)
- `AlarmManagementFeature` — monitoraggio operativo allarmi attivi (Operatore Sanitario)

---

## Indice

1. [Contesto architetturale](#1-contesto-architetturale)
2. [Modelli di dominio condivisi](#2-modelli-di-dominio-condivisi)
   - [AlarmPriority](#alarmpriority)
   - [AlarmRule](#alarmrule)
   - [ActiveAlarm](#activealarm)
3. [DTO condivisi](#3-dto-condivisi)
   - [CreateAlarmRequest](#createalarmrequest)
   - [UpdateAlarmRequest](#updatealarmrequest)
4. [Service condivisi (Core)](#4-service-condivisi-core)
   - [AlarmApiService](#alarmapiservice)
   - [AlarmStateService](#alarmstateservice)
5. [AlarmConfigurationFeature](#5-alarmconfigurationfeature)
   - [AlarmConfigFormValue](#alarmconfigformvalue)
   - [AlarmConfigStateService](#alarmconfigstateservice)
   - [AlarmConfigPageComponent](#alarmconfigpagecomponent)
   - [AlarmConfigFormComponent](#alarmconfigformcomponent)
6. [AlarmManagementFeature](#6-alarmmanagementfeature)
   - [AlarmListVm](#alarmlistvm)
   - [AlarmManagementFacadeService](#alarmmanagementfacadeservice)
   - [AlarmManagementPageComponent](#alarmmanagementpagecomponent)
   - [AlarmItemComponent](#alarmitemcomponent)
7. [Shared](#7-shared)
   - [ElapsedTimePipe](#elapsedtimepipe)
8. [Route Configuration](#8-route-configuration)
9. [Relazioni](#9-relazioni)

---

## 1. Contesto architetturale

Il modulo allarmi del Frontend si articola su tre layer sovrapposti che
rispettano una dipendenza unidirezionale: le feature dipendono dai Service
Core, i Service Core non dipendono dalle feature.

Tutti i componenti del modulo sono **standalone**: non esistono NgModule
dedicati. Il ciclo di vita dei service feature-scoped è gestito tramite
`providers[]` nelle route, non tramite moduli.

```
AlarmConfigurationFeature              AlarmManagementFeature
         │                                       │
         │  uses                                 │  reads state / resolves via
         ▼                                       ▼
AlarmConfigStateService ──► AlarmApiService ◄── AlarmManagementFacadeService
                                  │                          │
                                  │ HTTP                     │ reads / mutates
                                  ▼                          ▼
                               Backend               AlarmStateService
                                                            ▲
                                                            │ push events
                                                    EventSubscriptionService
```

**Separazione delle responsabilità:**

- `AlarmApiService` è il **solo punto di accesso HTTP** per tutte le operazioni
  REST sugli allarmi. Nessun componente o feature service chiama `HttpClient`
  direttamente per operazioni su allarmi.

- `AlarmStateService` è la **singola sorgente di verità** per la lista degli
  allarmi attivi in tempo reale. Nessuna feature mantiene una propria copia
  dello stato push. Questo service è già progettato nel contesto di
  `EventSubscriptionService` e viene qui consumato, non ridefinito.

- Le due feature sono **completamente indipendenti** tra loro:
  `AlarmConfigurationFeature` non ha alcuna dipendenza da `AlarmStateService`
  (configura regole statiche, non monitora eventi in tempo reale);
  `AlarmManagementFeature` non ha alcuna dipendenza da `AlarmConfigStateService`
  (monitora e risolve, non configura).

- **Il `FormGroup` appartiene al componente**, non al service. Il service
  (`AlarmConfigStateService`) riceve il valore già estratto dal form
  (`AlarmConfigFormValue`), costruisce il DTO appropriato e delega la
  chiamata HTTP ad `AlarmApiService`. Questa separazione garantisce che la
  logica di mapping sia testabile in isolamento e che lo stato UI non sia
  mai condiviso tra classi diverse.

---

## 2. Modelli di dominio condivisi

I modelli di dominio descrivono la forma dei dati ricevuti dal backend e
utilizzati dalle feature. Sono interfacce TypeScript senza logica, definite
in `core/alarm/models/` per essere condivise tra le due feature.

---

### `AlarmPriority`

**File:** `core/alarm/models/alarm-rule.model.ts`
**Stereotipo:** `<<enumeration>>`

Enumera i quattro livelli di priorità di un allarme definiti dai casi d'uso
UC33.4–UC33.7. Sostituisce l'utilizzo di valori numerici o stringhe magiche
in tutto il codebase, garantendo type safety nel form di configurazione e
nella visualizzazione.

| Valore | Colore | UC |
|---|---|---|
| `WHITE` | Bianco — priorità 1 | UC33.4 |
| `GREEN` | Verde — priorità 2 | UC33.5 |
| `ORANGE` | Arancione — priorità 3 | UC33.6 |
| `RED` | Rosso — priorità 4 | UC33.7 |

Utilizzato come tipo del campo `priority` in `AlarmRule`, `CreateAlarmRequest`,
`UpdateAlarmRequest` e `AlarmConfigFormValue`.

---

### `AlarmRule`

**File:** `core/alarm/models/alarm-rule.model.ts`
**Stereotipo:** `<<interface>>`

Rappresenta una **regola di allarme configurata**, ovvero l'entità persistita
nel database che l'Amministratore crea e gestisce tramite
`AlarmConfigurationFeature`.

È il modello di **lettura** restituito dal backend nelle operazioni `GET`,
`POST` e `PATCH` su `/api/alarms`. Va distinto da `ActiveAlarm`, che
rappresenta invece un **evento di allarme scattato** in tempo reale.

| Campo | Tipo | UC | Descrizione |
|---|---|---|---|
| `id` | `string` | — | Identificatore univoco della regola — chiave per update (UC34–UC37), toggle (UC38–UC39), delete (UC40) |
| `name` | `string` | UC33 | Nome descrittivo della regola di allarme |
| `apartmentId` | `string` | UC33.1 | Appartamento a cui è associata la regola |
| `sensorId` | `string` | UC33.2 | Sensore che scatena l'allarme |
| `priority` | `AlarmPriority` | UC33.3–UC33.7 | Livello di priorità — uno dei quattro valori dell'enum |
| `threshold` | `number` | UC33.8 | Soglia di intervento che attiva la regola |
| `activationTime` | `string` | UC33.9 | Orario di attivazione della regola nel formato `HH:mm` |
| `deactivationTime` | `string` | UC33.10 | Orario di disattivazione della regola nel formato `HH:mm` |
| `enabled` | `boolean` | UC38–UC39 | Stato di abilitazione della regola. `true` → attiva; `false` → disabilitata. Il bottone di toggle in `AlarmConfigPageComponent` riflette questo valore |

---

### `ActiveAlarm`

**File:** `core/alarm/models/active-alarm.model.ts`
**Stereotipo:** `<<model>>`

Rappresenta un **allarme attivo**, ovvero un evento di allarme scattato in
tempo reale e non ancora risolto. È il modello prodotto da `AlarmStateService`
a partire dagli eventi push ricevuti tramite `EventSubscriptionService`.

Non va confuso con `AlarmRule`: `AlarmRule` è la configurazione statica creata
dall'Amministratore; `ActiveAlarm` è l'istanza dinamica di quell'allarme nel
momento in cui scatta. Una singola `AlarmRule` può generare molteplici
`ActiveAlarm` nel corso del tempo.

Questo modello è già stato definito nel design di `AlarmStateService` e viene
consumato in sola lettura da `AlarmManagementFeature`.

| Campo | Tipo | UC | Descrizione |
|---|---|---|---|
| `alarmId` | `string` | — | Identificatore univoco dell'evento allarme — usato in UC28 per identificare quale allarme risolvere |
| `alarmName` | `string` | UC17.1.1.2, RF47 | Nome dell'allarme — visualizzato da `AlarmItemComponent` |
| `dangerSignal` | `string` | UC17.1.1.1, RF46 | Segnale di pericolo — visualizzato da `AlarmItemComponent` |
| `triggeredAt` | `string` | UC17.1.1.3, RF48 | Timestamp ISO di scatto dell'allarme — trasformato in tempo trascorso leggibile da `ElapsedTimePipe` nel template di `AlarmItemComponent` |

> **Nota:** il campo `elapsedTime` (secondi numerici) è stato rimosso perché
> ridondante. La rappresentazione testuale del tempo trascorso è calcolata
> interamente a display-time da `ElapsedTimePipe` a partire da `triggeredAt`.
> Non è necessario né trasmettere né memorizzare un valore derivabile.

---

## 3. DTO condivisi

I DTO descrivono esclusivamente i dati che il frontend **invia** al backend
nelle operazioni di scrittura. Sono oggetti senza logica, usati come contratto
di trasporto in `AlarmApiService`. Sono mantenuti separati dai modelli di
dominio per rispettare la distinzione tra operazioni di lettura e scrittura.

I DTO non sono mai costruiti dai componenti. La loro costruzione è
responsabilità esclusiva di `AlarmConfigStateService`, che li produce a
partire da `AlarmConfigFormValue` prima di delegare la chiamata HTTP.

---

### `CreateAlarmRequest`

**File:** `core/alarm/models/create-alarm-request.model.ts`
**Stereotipo:** `<<interface>>`

Trasporta i dati necessari alla creazione di una nuova regola di allarme
(UC33). Viene costruito da `AlarmConfigStateService.mapToCreateRequest()` a
partire dal valore del `FormGroup`, e passato a `AlarmApiService.createAlarm()`.

Tutti i campi sono obbligatori — la loro presenza è garantita dai validatori
`Validators.required` nel form, che implementano le restrizioni definite da
UC48 (sensore obbligatorio), UC49 (priorità obbligatoria) e UC50 (soglia
obbligatoria).

| Campo | Tipo | UC | Descrizione |
|---|---|---|---|
| `name` | `string` | UC33 | Nome della nuova regola |
| `apartmentId` | `string` | UC33.1 | Appartamento selezionato |
| `sensorId` | `string` | UC33.2 | Sensore selezionato — obbligatorio (UC48) |
| `priority` | `AlarmPriority` | UC33.3–UC33.7 | Priorità selezionata — obbligatoria (UC49) |
| `threshold` | `number` | UC33.8 | Soglia di intervento — obbligatoria (UC50) |
| `activationTime` | `string` | UC33.9 | Orario di attivazione nel formato `HH:mm` |
| `deactivationTime` | `string` | UC33.10 | Orario di disattivazione nel formato `HH:mm` |

---

### `UpdateAlarmRequest`

**File:** `core/alarm/models/update-alarm-request.model.ts`
**Stereotipo:** `<<interface>>`

Trasporta i dati per l'aggiornamento parziale di una regola di allarme
esistente. È un DTO a campi opzionali — implementa semantiche `PATCH`:
vengono inviati solo i campi effettivamente modificati.

Copre cinque casi d'uso distinti (UC34–UC37, UC38–UC39) che operano tutti
su sottoinsiemi diversi dei campi della regola. La scelta di un singolo DTO
parziale in luogo di cinque DTO dedicati è una decisione deliberata:
la distinzione tra i casi d'uso appartiene alla logica di `AlarmConfigStateService`
(quale campo popolare), non al contratto di trasporto HTTP.

| Campo | Tipo | UC | Descrizione |
|---|---|---|---|
| `priority` | `AlarmPriority` (opzionale) | UC34 | Nuova priorità |
| `threshold` | `number` (opzionale) | UC35 | Nuova soglia di intervento |
| `activationTime` | `string` (opzionale) | UC36 | Nuovo orario di attivazione |
| `deactivationTime` | `string` (opzionale) | UC37 | Nuovo orario di disattivazione |
| `enabled` | `boolean` (opzionale) | UC38–UC39 | `true` per abilitare (UC38), `false` per disabilitare (UC39) |

---

## 4. Service condivisi (Core)

I service condivisi sono definiti in `core/alarm/services/` e hanno scope
`providedIn: 'root'`. Sono accessibili da entrambe le feature senza dipendenze
da moduli intermediari.

---

### `AlarmApiService`

**File:** `core/alarm/services/alarm-api.service.ts`
**Stereotipo:** `<<service>>`
**Pattern applicato:** Repository
**Scope:** `providedIn: 'root'`

Astrae tutte le chiamate HTTP REST verso il backend per le operazioni sugli
allarmi. È il **solo punto di accesso alla rete** per questo bounded context.
Nessun componente, nessun feature service chiama `HttpClient` direttamente
per operazioni su allarmi.

Implementa il pattern **Repository**: espone un'interfaccia tipizzata e
Observable-based che nasconde completamente i dettagli del trasporto HTTP
(URL, verb, headers, serializzazione). I consumatori dipendono
dall'interfaccia del service, non dall'implementazione HTTP.

Il service è **stateless**: non mantiene alcun dato in memoria tra una chiamata
e l'altra. I DTO in ingresso (`CreateAlarmRequest`, `UpdateAlarmRequest`) sono
sempre costruiti dal chiamante (`AlarmConfigStateService`) prima di essere
passati a questo service.

#### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `http` | `HttpClient` | `private` | Client HTTP Angular — iniettato via DI |
| `baseUrl` | `string` | `private readonly` | URL base `/api/alarms` — prefisso comune a tutti gli endpoint |

#### Metodi

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `getAlarms()` | `Observable<AlarmRule[]>` | — | `GET /api/alarms` — carica la lista completa delle regole configurate. Chiamato da `AlarmConfigStateService.loadAlarms()` |
| `getAlarm(id: string)` | `Observable<AlarmRule>` | UC34–UC37 | `GET /api/alarms/{id}` — recupera una singola regola per id. Chiamato da `AlarmConfigStateService.getAlarmById()` per pre-compilare il form in modalità modifica |
| `createAlarm(payload: CreateAlarmRequest)` | `Observable<AlarmRule>` | UC33 | `POST /api/alarms` — crea una nuova regola. Il backend restituisce la regola creata con `id` assegnato. Chiamato da `AlarmConfigStateService.createAlarm()` |
| `updateAlarm(id: string, payload: UpdateAlarmRequest)` | `Observable<AlarmRule>` | UC34–UC39 | `PATCH /api/alarms/{id}` — aggiornamento parziale della regola. Copre modifica priorità, soglia, orari e abilitazione/disabilitazione. Chiamato da `AlarmConfigStateService.updateAlarm()` e `AlarmConfigStateService.toggleEnabled()` |
| `deleteAlarm(id: string)` | `Observable<void>` | UC40 | `DELETE /api/alarms/{id}` — eliminazione permanente della regola. Chiamato da `AlarmConfigStateService.deleteAlarm()` |
| `resolveAlarm(id: string)` | `Observable<void>` | UC28 | `PATCH /api/alarms/{id}/resolve` — contrassegna un allarme attivo come risolto. Chiamato da `AlarmManagementFacadeService.resolveAlarm()` |

---

### `AlarmStateService`

**File:** `core/alarm/services/alarm-state.service.ts`
**Stereotipo:** `<<state-service>>`
**Scope:** `providedIn: 'root'`

Gestisce lo stato reattivo degli allarmi attivi e delle notifiche in tempo
reale. È già stato progettato nel contesto del design di `EventSubscriptionService`
ed è documentato in quella sede. Viene qui referenziato esclusivamente come
dipendenza consumata da `AlarmManagementFacadeService`.

Il metodo rilevante per questo modulo è `onAlarmResolved(alarmId: string)`,
che viene invocato dal Facade dopo una risoluzione HTTP andata a buon fine per
aggiornare la lista degli allarmi attivi — mantenendo `AlarmStateService`
come unica sorgente di verità.

---

## 5. AlarmConfigurationFeature

Feature riservata all'`Amministratore`. Fornisce l'interfaccia per la gestione
completa del ciclo di vita delle regole di allarme: creazione, visualizzazione,
modifica dei parametri, abilitazione/disabilitazione ed eliminazione.

Non ha alcuna dipendenza da `AlarmStateService` — le regole di allarme sono
entità di configurazione statiche, non eventi in tempo reale.

**UC coperti:** UC33–UC40 (RF85–RF101), incluse le validazioni UC48–UC50
(RF92–RF94).

**Struttura dei componenti:**

```
AlarmConfigPageComponent  (Smart — lista regole)
        │
        ├── naviga verso ──► AlarmConfigFormComponent  (Smart — form crea/modifica)
        │
        └── dipende da ──► AlarmConfigStateService  (feature-scoped)
                                    │
                                    └── dipende da ──► AlarmApiService  (core)
```

---

### `AlarmConfigFormValue`

**File:** `alarm-configuration/models/alarm-config-form-value.model.ts`
**Stereotipo:** `<<interface>>`
**Scope:** Feature-local — non esposto fuori da `AlarmConfigurationFeature`

Descrive la forma tipizzata del valore del `FormGroup` posseduto da
`AlarmConfigFormComponent`. Rappresenta il dato grezzo catturato dal form
prima della sua trasformazione in `CreateAlarmRequest` o `UpdateAlarmRequest`.

La separazione tra `AlarmConfigFormValue` e i DTO di scrittura è deliberata:
il form ha un ciclo di vita UI (include `null` per campi non ancora compilati,
gestisce validatori Angular), mentre i DTO hanno un contratto HTTP preciso.
`AlarmConfigStateService` è responsabile della mappatura tra i due attraverso
`mapToCreateRequest()` e `mapToUpdateRequest()`.

| Campo | Tipo | UC | Descrizione |
|---|---|---|---|
| `apartmentId` | `string` | UC33.1 | Id appartamento selezionato dal dropdown |
| `sensorId` | `string` | UC33.2 | Id sensore selezionato — soggetto al validatore UC48 |
| `priority` | `AlarmPriority \| null` | UC33.3–UC33.7 | Priorità selezionata — `null` prima della selezione, soggetta al validatore UC49 |
| `threshold` | `number \| null` | UC33.8 | Soglia di intervento — `null` prima dell'inserimento, soggetta al validatore UC50 |
| `activationTime` | `string` | UC33.9 | Orario di attivazione nel formato `HH:mm` |
| `deactivationTime` | `string` | UC33.10 | Orario di disattivazione nel formato `HH:mm` |

---

### `AlarmConfigStateService`

**File:** `alarm-configuration/services/alarm-config-state.service.ts`
**Stereotipo:** `<<service>>`
**Scope:** Feature-scoped — fornito nel `providers[]` della route padre
`alarm-config`. Viene distrutto quando l'utente naviga fuori dalla feature,
garantendo che lo stato della lista venga rilasciato.

Gestisce la **lista delle regole di allarme configurate** e coordina tutte le
operazioni CRUD verso `AlarmApiService`. Ha un'unica responsabilità: essere
la sorgente di verità reattiva per `AlarmConfigPageComponent` e il punto di
accesso alle operazioni di scrittura per `AlarmConfigFormComponent`.

Non conosce né il `FormGroup` né lo stato UI dei componenti. Riceve
`AlarmConfigFormValue` già estratto dal form e lo trasforma internamente nel
DTO HTTP appropriato prima di delegare ad `AlarmApiService`.

**Gestione degli errori:** tutti i metodi che effettuano chiamate HTTP
gestiscono internamente gli errori tramite `catchError`: aggiornano
`errorSubject` con un messaggio leggibile e restituiscono `EMPTY` per
completare l'Observable senza propagare l'errore al chiamante. Il componente
si sottoscrive a `error$` per mostrare il feedback all'utente.

#### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `alarmsSubject` | `BehaviorSubject<AlarmRule[]>` | `private` | Sorgente di verità interna per la lista delle regole. Inizializzata a `[]` |
| `errorSubject` | `BehaviorSubject<string \| null>` | `private` | Ultimo messaggio di errore HTTP. `null` indica nessun errore attivo |
| `alarms$` | `Observable<AlarmRule[]>` | `public` | Stream della lista regole — consumato da `AlarmConfigPageComponent` tramite `async` pipe |
| `error$` | `Observable<string \| null>` | `public` | Stream degli errori HTTP — consumato dai componenti per mostrare feedback all'utente |
| `api` | `AlarmApiService` | `private` | Service HTTP iniettato via DI |

#### Metodi

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `loadAlarms()` | `void` | — | Chiama `api.getAlarms()` e aggiorna `alarmsSubject`. Invocato da `AlarmConfigPageComponent.ngOnInit()` al montaggio della lista |
| `getAlarmById(id: string)` | `Observable<AlarmRule>` | UC34–UC37 | Chiama `api.getAlarm(id)` e restituisce la regola. Invocato da `AlarmConfigFormComponent.ngOnInit()` in modalità modifica per pre-compilare il form. In caso di errore: aggiorna `errorSubject` e restituisce `EMPTY` |
| `createAlarm(formValue: AlarmConfigFormValue)` | `Observable<AlarmRule>` | UC33 | Chiama `mapToCreateRequest(formValue)`, poi `api.createAlarm(payload)`. In caso di successo: aggiunge la nuova regola ad `alarmsSubject`. In caso di errore: aggiorna `errorSubject`, restituisce `EMPTY` |
| `updateAlarm(alarmId: string, formValue: AlarmConfigFormValue)` | `Observable<AlarmRule>` | UC34–UC37 | Chiama `mapToUpdateRequest(formValue)`, poi `api.updateAlarm(alarmId, payload)`. In caso di successo: sostituisce la regola aggiornata in `alarmsSubject`. In caso di errore: aggiorna `errorSubject`, restituisce `EMPTY` |
| `toggleEnabled(alarmId: string, enabled: boolean)` | `Observable<AlarmRule>` | UC38–UC39 | Chiama `api.updateAlarm(alarmId, { enabled })`. In caso di successo: sostituisce la regola in `alarmsSubject`. In caso di errore: aggiorna `errorSubject`, restituisce `EMPTY` |
| `deleteAlarm(alarmId: string)` | `Observable<void>` | UC40 | Chiama `api.deleteAlarm(alarmId)`. In caso di successo: rimuove la regola da `alarmsSubject`. In caso di errore: aggiorna `errorSubject`, restituisce `EMPTY` |
| `mapToCreateRequest(formValue: AlarmConfigFormValue)` | `CreateAlarmRequest` | UC33 | `private` — trasforma `AlarmConfigFormValue` in `CreateAlarmRequest`. Invocato da `createAlarm()` |
| `mapToUpdateRequest(formValue: AlarmConfigFormValue)` | `UpdateAlarmRequest` | UC34–UC37 | `private` — trasforma `AlarmConfigFormValue` in `UpdateAlarmRequest` popolando solo i campi modificabili. Invocato da `updateAlarm()` |

---

### `AlarmConfigPageComponent`

**File:** `alarm-configuration/components/alarm-config-page/alarm-config-page.component.ts`
**Stereotipo:** `<<component>>`
**Tipo:** Smart Component — Standalone
**UC coperti:** UC33 (entry point navigazione), UC38, UC39, UC40

Componente smart che funge da **contenitore della feature di configurazione**.
Visualizza la lista delle regole di allarme configurate e fornisce i controlli
per abilitare/disabilitare ed eliminare le regole esistenti. Gestisce la
navigazione verso `AlarmConfigFormComponent` per la creazione e la modifica.

Non interagisce mai direttamente con `AlarmApiService`. Tutte le operazioni
transitano attraverso `AlarmConfigStateService`. I service iniettati sono
`private` — non sono accessibili dal template né da test che non siano
specifici di questo componente.

#### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `alarms$` | `Observable<AlarmRule[]>` | `public` | Assegnato da `stateService.alarms$` in `ngOnInit()` — consumato nel template tramite `async` pipe per renderizzare la lista delle regole |
| `error$` | `Observable<string \| null>` | `public` | Assegnato da `stateService.error$` in `ngOnInit()` — consumato nel template per mostrare messaggi di errore HTTP |
| `stateService` | `AlarmConfigStateService` | `private` | Service iniettato via DI — unica dipendenza da service del componente |
| `router` | `Router` | `private` | Angular Router iniettato via DI — usato per la navigazione verso il form |
| `route` | `ActivatedRoute` | `private` | Angular ActivatedRoute iniettato via DI — usato come base per la navigazione relativa |

#### Metodi

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `ngOnInit()` | `void` | — | Assegna `alarms$` e `error$` dai rispettivi Observable del service. Chiama `stateService.loadAlarms()` per caricare la lista iniziale |
| `onCreateNew()` | `void` | UC33 | Naviga verso la route `./new` — `AlarmConfigFormComponent` viene montato in modalità creazione |
| `onEdit(rule: AlarmRule)` | `void` | UC34–UC37 | Naviga verso la route `./${rule.id}/edit` — `AlarmConfigFormComponent` viene montato in modalità modifica |
| `onToggleEnabled(rule: AlarmRule)` | `void` | UC38–UC39 | Chiama `stateService.toggleEnabled(rule.id, !rule.enabled)`. Il label del bottone nel template dipende da `rule.enabled` |
| `onDelete(id: string)` | `void` | UC40 | Chiama `stateService.deleteAlarm(id)`. La lista si aggiorna automaticamente tramite `alarmsSubject` |

---

### `AlarmConfigFormComponent`

**File:** `alarm-configuration/components/alarm-config-form/alarm-config-form.component.ts`
**Stereotipo:** `<<component>>`
**Tipo:** Smart Component — Standalone
**UC coperti:** UC33–UC37, UC48–UC50

Componente smart che gestisce il form di creazione e modifica di una regola di
allarme. Monta sulla route `./new` (creazione) e su `./:id/edit` (modifica).
Il **`FormGroup` è posseduto dal componente**, non da alcun service: è costruito
localmente in `ngOnInit()` tramite `FormBuilder` e il suo ciclo di vita è
interamente contenuto in questa classe.

La modalità (creazione vs modifica) è determinata dalla presenza del parametro
`:id` nella route attiva. In modalità modifica, il componente chiama
`stateService.getAlarmById(id)` per recuperare la regola dal backend e
pre-compilare il form tramite `form.patchValue()`. In caso di errore nel
recupero (regola non trovata o errore HTTP), naviga verso `../` per tornare
alla lista.

Al submit, il componente passa `form.value` direttamente a
`stateService.createAlarm()` o `stateService.updateAlarm()`. È il service a
costruire il DTO HTTP — il componente non conosce né `CreateAlarmRequest` né
`UpdateAlarmRequest`.

#### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `form` | `FormGroup` | `public` | Reactive form posseduto dal componente — binding nel template tramite `[formGroup]`. Costruito da `buildForm()` in `ngOnInit()` |
| `isEditMode` | `boolean` | `public` | `true` se `:id` è presente nella route. Usato nel template per adattare titolo e label del bottone di submit |
| `priorityOptions` | `AlarmPriority[]` | `public` | Array dei valori dell'enum `AlarmPriority` — usato nel template per generare le opzioni del selector di priorità (UC33.3–UC33.7) |
| `stateService` | `AlarmConfigStateService` | `private` | Service iniettato via DI — destinatario delle operazioni create/update |
| `fb` | `FormBuilder` | `private` | Angular FormBuilder iniettato via DI — usato in `buildForm()` |
| `route` | `ActivatedRoute` | `private` | Angular ActivatedRoute iniettato via DI — usato in `ngOnInit()` per leggere il parametro `:id` |
| `router` | `Router` | `private` | Angular Router iniettato via DI — usato per la navigazione post-submit, post-cancel e post-errore |

#### Metodi

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `ngOnInit()` | `void` | UC33, UC34–UC37 | Legge `:id` da `route.snapshot.paramMap`. Imposta `isEditMode`. Chiama `buildForm()`. Se `isEditMode`: chiama `stateService.getAlarmById(id)`, in caso di successo chiama `form.patchValue(rule)`, in caso di errore naviga verso `../` |
| `onSubmit()` | `void` | UC33, UC34–UC37 | Se `form` non valido: return. Se `isEditMode`: chiama `stateService.updateAlarm(id, form.value)`. Altrimenti: chiama `stateService.createAlarm(form.value)`. In caso di successo: naviga verso `../` |
| `onCancel()` | `void` | — | Naviga verso `../` senza inviare dati |
| `buildForm()` | `FormGroup` | — | `private` — costruisce il `FormGroup` con i campi: `apartmentId`, `sensorId`, `priority`, `threshold`, `activationTime`, `deactivationTime`. Applica `Validators.required` a `sensorId`, `priority` e `threshold` (UC48–UC50) |

> **Nota:** l'`id` della regola letto da `ActivatedRoute` in `ngOnInit()` è
> una variabile locale al metodo, non un campo della classe. Viene catturato
> nelle closure di `onSubmit()` e `getAlarmById()` tramite il riferimento
> diretto a `route.snapshot.paramMap`.

---

## 6. AlarmManagementFeature

Feature dedicata all'`Operatore Sanitario` per il monitoraggio operativo degli
allarmi attivi in tempo reale. Visualizza la lista degli allarmi attivi con i
loro dettagli (segnale di pericolo, nome, tempo trascorso) e fornisce l'azione
di risoluzione.

È la feature architetturalmente più complessa del modulo perché integra due
sorgenti di dati eterogenee: una **reattiva push** (`AlarmStateService`) e una
**imperativa HTTP** (`AlarmApiService`). La composizione di queste due sorgenti
è interamente delegata al Facade, che espone al componente smart una singola
interfaccia Observable coerente.

**UC coperti:** UC17.1, UC17.1.1, UC17.1.1.1–UC17.1.1.3, UC28
(RF44–RF48, RF60).

---

### `AlarmListVm`

**File:** `alarm-management/models/alarm-list-vm.model.ts`
**Stereotipo:** `<<interface>>`
**Scope:** Feature-local — non esposto fuori da `AlarmManagementFeature`

View Model che rappresenta lo snapshot coerente di tutto lo stato necessario
al template di `AlarmManagementPageComponent`. Viene prodotto da
`AlarmManagementFacadeService.vm$` componendo `AlarmStateService.getActiveAlarms$()`
e `resolvingId$` tramite `combineLatest`.

**Motivazione:** senza il ViewModel, il componente dovrebbe gestire due
`async` pipe indipendenti su Observable distinti (`alarms$` e `resolvingId$`).
Questo introduce il rischio di frame inconsistenti in cui le due pipe emettono
in momenti diversi, genera logica di confronto nel template (es.
`(resolvingId$ | async) === alarm.alarmId`) e aumenta le dipendenze del
componente. Il ViewModel elimina tutti questi problemi: il componente ha un
solo Observable, il template ha un solo binding, lo stato è sempre atomico.

| Campo | Tipo | Descrizione |
|---|---|---|
| `alarms` | `ActiveAlarm[]` | Lista corrente degli allarmi attivi — ricevuta direttamente da `AlarmStateService` |
| `isResolving` | `boolean` | `true` se è in corso una chiamata HTTP di risoluzione — usato nel template per mostrare uno spinner globale |
| `resolvingId` | `string \| null` | Id dell'allarme attualmente in fase di risoluzione. `null` se nessuna risoluzione è in corso — passato come `@Input` ad `AlarmItemComponent` per disabilitare il bottone dell'allarme specifico e prevenire doppi click |

---

### `AlarmManagementFacadeService`

**File:** `alarm-management/services/alarm-management-facade.service.ts`
**Stereotipo:** `<<service>>`
**Pattern applicato:** Facade + Observer (RxJS `combineLatest`)
**Scope:** Feature-scoped — fornito nel `providers[]` della route `alarms`.
Viene distrutto quando l'utente naviga fuori dalla feature, rilasciando
`resolvingId$` e le subscription interne.

Nasconde la complessità della composizione tra `AlarmStateService` e
`AlarmApiService` dietro un'interfaccia minimale: un unico Observable `vm$`
e un unico metodo `resolveAlarm()`.

`vm$` è costruito tramite `combineLatest` tra `alarmStateService.getActiveAlarms$()`
e `resolvingId$` (un `BehaviorSubject` interno). `combineLatest` garantisce
che ogni emissione di `vm$` contenga sempre uno snapshot coerente di entrambe
le sorgenti: non esistono frame intermedi in cui la lista degli allarmi e lo
stato di risoluzione sono disallineati.

**Flusso di `resolveAlarm()`:**

1. Imposta `resolvingId$.next(alarmId)` — il ViewModel emette con `isResolving: true`
2. Chiama `alarmApiService.resolveAlarm(alarmId)`
3. Al completamento HTTP, chiama `alarmStateService.onAlarmResolved(alarmId)` — la lista degli allarmi attivi si aggiorna nella sorgente di verità
4. Reimposta `resolvingId$.next(null)` — il ViewModel emette con `isResolving: false`

In nessun momento il Facade mantiene una propria copia della lista degli
allarmi attivi. L'unica sorgente di verità resta `AlarmStateService`.

#### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `alarmStateService` | `AlarmStateService` | `private` | Service di stato iniettato — sorgente degli allarmi attivi e destinatario di `onAlarmResolved()` post-risoluzione |
| `alarmApiService` | `AlarmApiService` | `private` | Service HTTP iniettato — destinatario della chiamata `resolveAlarm()` |
| `resolvingId$` | `BehaviorSubject<string \| null>` | `private` | Subject interno che traccia l'id dell'allarme in fase di risoluzione. Inizializzato a `null`. Composto in `vm$` tramite `combineLatest` |
| `vm$` | `Observable<AlarmListVm>` | `public` | Observable del ViewModel — consumato da `AlarmManagementPageComponent` tramite `async` pipe. Emette ad ogni cambio della lista allarmi o dello stato di risoluzione |

#### Metodi

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `resolveAlarm(alarmId: string)` | `void` | UC28 | Esegue il flusso descritto sopra: imposta `resolvingId$`, chiama `alarmApiService.resolveAlarm()`, al completamento chiama `alarmStateService.onAlarmResolved()`, reimposta `resolvingId$` |

---

### `AlarmManagementPageComponent`

**File:** `alarm-management/components/alarm-management-page/alarm-management-page.component.ts`
**Stereotipo:** `<<component>>`
**Tipo:** Smart Component — Standalone
**UC coperti:** UC17.1, UC28

Componente smart che funge da contenitore della feature di monitoraggio
operativo. Ha un'unica responsabilità: sottoscriversi a `facade.vm$` e
propagare gli eventi utente al Facade.

Non gestisce alcuna subscription manuale — l'unico `async` pipe nel template
si sottoscrive a `vm$` e gestisce automaticamente il ciclo di vita della
subscription. Non mantiene stato locale. Non conosce né `AlarmStateService`
né `AlarmApiService`.

La semplicità di questo componente è un indicatore diretto della corretta
allocazione delle responsabilità nel Facade.

#### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `vm$` | `Observable<AlarmListVm>` | `public` | Riferimento a `facade.vm$` — unico binding nel template |
| `facade` | `AlarmManagementFacadeService` | `private` | Facade iniettato via DI — unica dipendenza da service |

#### Metodi

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `ngOnInit()` | `void` | — | Assegna `vm$ = facade.vm$` |
| `onResolve(alarmId: string)` | `void` | UC28 | Delegato puro verso `facade.resolveAlarm(alarmId)`. Invocato quando `AlarmItemComponent` emette l'evento `(resolve)` |

---

### `AlarmItemComponent`

**File:** `alarm-management/components/alarm-item/alarm-item.component.ts`
**Stereotipo:** `<<component>>`
**Tipo:** Presentational (Dumb) Component — Standalone
**UC coperti:** UC17.1.1, UC17.1.1.1–UC17.1.1.3, UC28

Componente presentazionale che visualizza le informazioni di un singolo
allarme attivo e fornisce il controllo di risoluzione. Non ha dipendenze da
service. Riceve tutti i dati tramite `@Input()` ed emette eventi tramite
`@Output()`.

Importa direttamente `ElapsedTimePipe` nel proprio array `imports[]` — non
richiede moduli intermediari.

La sua natura dumb lo rende **riusabile** in altri contesti che necessitano di
visualizzare un allarme, come il widget degli allarmi nella `DashboardFeature`,
senza richiedere alcuna modifica. È compatibile con `ChangeDetectionStrategy.OnPush`
perché tutti gli input sono oggetti immutabili provenienti da un `BehaviorSubject`.

#### Attributi

| Attributo | Tipo | Visibilità | UC | Descrizione |
|---|---|---|---|---|
| `alarm` | `ActiveAlarm` | `public @Input()` | UC17.1.1 | Allarme da visualizzare — obbligatorio |
| `isResolving` | `boolean` | `public @Input()` | UC28 | Se `true`, disabilita il bottone "Risolvi" per questo specifico allarme e mostra un indicatore di caricamento |
| `resolve` | `EventEmitter<string>` | `public @Output()` | UC28 | Emette `alarm.alarmId` quando l'utente clicca "Risolvi" |

#### Metodi

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `onResolveClick()` | `void` | UC28 | Emette `this.resolve.emit(this.alarm.alarmId)`. Unico entry point per l'azione di risoluzione |

**Dati visualizzati nel template:**

| Campo sorgente | UC | Trasformazione |
|---|---|---|
| `alarm.dangerSignal` | UC17.1.1.1, RF46 | Visualizzazione diretta del segnale di pericolo |
| `alarm.alarmName` | UC17.1.1.2, RF47 | Visualizzazione diretta del nome |
| `alarm.triggeredAt` | UC17.1.1.3, RF48 | Trasformato da `ElapsedTimePipe` in stringa leggibile |

---

## 7. Shared

### `ElapsedTimePipe`

**File:** `shared/pipes/elapsed-time.pipe.ts`
**Stereotipo:** `<<pipe>>`
**Tipo:** Standalone, pura (`pure: true`)

Pipe Angular pura che trasforma un timestamp ISO in una stringa leggibile che
rappresenta il tempo trascorso dall'istante indicato a oggi.

È collocata in `shared/pipes/` perché è condivisa tra più feature: viene
importata direttamente da `AlarmItemComponent` (per `alarm.triggeredAt`,
RF48/UC17.1.1.3) e da `NotificationItemComponent` (per
`notification.sentAt`, RF105/UC41.1.2). Non appartiene ad alcun NgModule.

Esempi di output: `"3s fa"`, `"2m fa"`, `"1h 12m fa"`, `"3g fa"`.

È dichiarata come **pura** (`pure: true`, default Angular) perché la
trasformazione dipende esclusivamente dal valore in input — stesso input
produce sempre stesso output. Questo la rende:

- Sicura con `ChangeDetectionStrategy.OnPush`
- Testabile in isolamento con un semplice unit test sulla funzione `transform()`
- Performante: nessuna riesecuzione inutile ad ogni ciclo di change detection

> **Limitazione nota:** il valore calcolato riflette il tempo trascorso al
> momento del rendering ma non si aggiorna automaticamente se la pagina rimane
> aperta a lungo. Questo comportamento è accettabile per la versione corrente.

| Metodo | Parametro | Ritorna | UC | Descrizione |
|---|---|---|---|---|
| `transform(timestamp: string)` | Timestamp ISO | `string` | UC17.1.1.3, UC41.1.2 | Calcola la differenza tra `new Date()` e il timestamp in input. Formatta il risultato con granularità a secondi, minuti, ore e giorni |

---

## 8. Route Configuration

Entrambe le feature usano componenti standalone caricati tramite `loadComponent`
nell'app router. Non esistono NgModule dedicati per le feature.

I service feature-scoped (`AlarmConfigStateService` e
`AlarmManagementFacadeService`) sono forniti nel `providers[]` della rispettiva
route: vengono istanziati al montaggio della route e distrutti quando l'utente
naviga fuori, garantendo lo stesso ciclo di vita che in precedenza era gestito
dai NgModule.

```typescript
// Estratto da app.routes.ts
[
  {
    path: 'alarms',
    loadComponent: () =>
      import('./features/alarm-management/components/alarm-management-page/alarm-management-page.component')
        .then(c => c.AlarmManagementPageComponent),
    providers: [AlarmManagementFacadeService],
    canActivate: [AuthGuard],
  },
  {
    path: 'alarm-config',
    providers: [AlarmConfigStateService],
    canActivate: [AuthGuard, AdminGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/alarm-configuration/components/alarm-config-page/alarm-config-page.component')
            .then(c => c.AlarmConfigPageComponent),
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./features/alarm-configuration/components/alarm-config-form/alarm-config-form.component')
            .then(c => c.AlarmConfigFormComponent),
      },
      {
        path: ':id/edit',
        loadComponent: () =>
          import('./features/alarm-configuration/components/alarm-config-form/alarm-config-form.component')
            .then(c => c.AlarmConfigFormComponent),
      },
    ],
  },
]
```

`AlarmConfigStateService` è fornito al livello della route padre `alarm-config`:
le tre route figlie (`''`, `new`, `:id/edit`) condividono la stessa istanza,
garantendo che la lista delle regole caricata in `AlarmConfigPageComponent`
sia disponibile anche in `AlarmConfigFormComponent` (per il patchValue in
modalità modifica).

---

## 9. Relazioni

La tabella elenca tutte le relazioni del class diagram, organizzate per layer.

### Modelli di dominio

| Sorgente | Destinazione | Tipo | Descrizione |
|---|---|---|---|
| `AlarmRule` | `AlarmPriority` | `-->` aggregazione | Il campo `priority` di `AlarmRule` è tipizzato come `AlarmPriority` |
| `CreateAlarmRequest` | `AlarmPriority` | `-->` aggregazione | Il campo `priority` di `CreateAlarmRequest` è tipizzato come `AlarmPriority` |
| `UpdateAlarmRequest` | `AlarmPriority` | `-->` aggregazione | Il campo `priority` opzionale di `UpdateAlarmRequest` è tipizzato come `AlarmPriority` |
| `AlarmConfigFormValue` | `AlarmPriority` | `-->` aggregazione | Il campo `priority` del form value è tipizzato come `AlarmPriority \| null` |
| `AlarmListVm` | `ActiveAlarm` | `-->` aggregazione | Il campo `alarms` di `AlarmListVm` è un array di `ActiveAlarm` |

### AlarmApiService (Core)

| Sorgente | Destinazione | Tipo | Descrizione |
|---|---|---|---|
| `AlarmApiService` | `HttpClient` | `..>` dipendenza | `HttpClient` iniettato via DI — unico accesso alla rete |
| `AlarmApiService` | `AlarmRule` | `..>` dipendenza | Ritorna `AlarmRule` e `AlarmRule[]` come tipo di risposta |
| `AlarmApiService` | `CreateAlarmRequest` | `..>` dipendenza | Accetta come parametro di `createAlarm()` |
| `AlarmApiService` | `UpdateAlarmRequest` | `..>` dipendenza | Accetta come parametro di `updateAlarm()` |

### AlarmConfigurationFeature

| Sorgente | Destinazione | Tipo | Descrizione |
|---|---|---|---|
| `AlarmConfigStateService` | `AlarmApiService` | `-->` associazione | Service iniettato — tutte le chiamate HTTP della feature transitano attraverso di esso |
| `AlarmConfigStateService` | `AlarmRule` | `..>` dipendenza | Tipo di risposta di tutti i metodi CRUD. Aggiorna `alarmsSubject` con le istanze ricevute |
| `AlarmConfigStateService` | `CreateAlarmRequest` | `..>` dipendenza | Prodotto da `mapToCreateRequest()` e passato ad `AlarmApiService.createAlarm()` |
| `AlarmConfigStateService` | `UpdateAlarmRequest` | `..>` dipendenza | Prodotto da `mapToUpdateRequest()` e passato ad `AlarmApiService.updateAlarm()` |
| `AlarmConfigStateService` | `AlarmConfigFormValue` | `..>` dipendenza | Ricevuto come parametro di `createAlarm()` e `updateAlarm()` — base per la costruzione dei DTO |
| `AlarmConfigPageComponent` | `AlarmConfigStateService` | `-->` associazione | Service iniettato — unica dipendenza da service del componente |
| `AlarmConfigPageComponent` | `AlarmRule` | `..>` dipendenza | Consumato tramite `alarms$` nel template e come parametro di `onEdit()` e `onToggleEnabled()` |
| `AlarmConfigFormComponent` | `AlarmConfigStateService` | `-->` associazione | Service iniettato — unica dipendenza da service del componente |
| `AlarmConfigFormComponent` | `AlarmConfigFormValue` | `..>` dipendenza | Il valore tipizzato del `FormGroup` — passato a `stateService.createAlarm()` e `stateService.updateAlarm()` tramite `form.value` |

### AlarmManagementFeature

| Sorgente | Destinazione | Tipo | Descrizione |
|---|---|---|---|
| `AlarmManagementFacadeService` | `AlarmStateService` | `-->` associazione | Service iniettato — sorgente della lista allarmi attivi e destinatario di `onAlarmResolved()` post-risoluzione |
| `AlarmManagementFacadeService` | `AlarmApiService` | `-->` associazione | Service iniettato — destinatario della chiamata HTTP `resolveAlarm()` |
| `AlarmManagementFacadeService` | `AlarmListVm` | `..>` dipendenza | Prodotto da `vm$` tramite `combineLatest`. Non lo possiede strutturalmente |
| `AlarmManagementFacadeService` | `ActiveAlarm` | `..>` dipendenza | Consumato da `AlarmStateService.getActiveAlarms$()` e incluso nel ViewModel |
| `AlarmManagementPageComponent` | `AlarmManagementFacadeService` | `-->` associazione | Facade iniettato — unica dipendenza da service del componente smart |
| `AlarmManagementPageComponent` | `AlarmListVm` | `..>` dipendenza | Consumato tramite `async` pipe nel template tramite `vm$` |
| `AlarmManagementPageComponent` | `AlarmItemComponent` | `-->` composizione template | Il template renderizza `<app-alarm-item>` in `*ngFor` su `vm.alarms` |
| `AlarmItemComponent` | `ActiveAlarm` | `..>` dipendenza | Ricevuto come `@Input()` — tipo del dato visualizzato |
| `AlarmItemComponent` | `ElapsedTimePipe` | `..>` dipendenza (import) | Importata direttamente nell'array `imports[]` — usata nel template per trasformare `alarm.triggeredAt` in stringa leggibile |
