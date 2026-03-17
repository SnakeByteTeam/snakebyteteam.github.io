# Notification Feature — Documentazione UML

Documento di riferimento per il class diagram del modulo
`NotificationFeature`, `NotificationApiService` (nuovo) e
`AlarmStateService` (invariato) del Frontend dell'applicazione **View4Life**.

---

## Indice

1. [Contesto architetturale](#1-contesto-architetturale)
2. [Modelli di dominio](#2-modelli-di-dominio)
   - [NotificationEvent](#notificationevent)
   - [NotificationListVm](#notificationlistvm)
3. [Service condivisi (Core)](#3-service-condivisi-core)
   - [AlarmStateService](#alarmstateservice)
   - [NotificationApiService](#notificationapiservice)
4. [Service](#4-service)
   - [NotificationService](#notificationservice)
5. [Component](#5-component)
   - [NotificationPageComponent](#notificationpagecomponent)
   - [NotificationItemComponent](#notificationitemcomponent)
   - [NotificationBadgeComponent](#notificationbadgecomponent)
6. [Pipe](#6-pipe)
   - [ElapsedTimePipe](#elapsedtimepipe)
7. [Routing](#7-routing)
8. [Relazioni](#8-relazioni)

---

## 1. Contesto architetturale

La `NotificationFeature` gestisce l'interfaccia per la visualizzazione dello
storico delle notifiche di sistema ricevute dall'utente, mostrando titolo e
tempo trascorso dall'invio (UC41). È una feature in **sola lettura**: non
espone operazioni di scrittura né altera lo stato condiviso dell'applicazione.

Il design include anche `NotificationBadgeComponent`, un componente
presentazionale che visualizza il contatore delle notifiche non lette nella
barra di navigazione. **Questo elemento non è coperto da alcun Use Case
nell'Analisi dei Requisiti corrente** (UC41 e la sua famiglia descrivono
esclusivamente la visualizzazione della lista notifiche; il concetto di
notifica letta/non letta non è modellato). È presente nel design come scelta
di prodotto che anticipa un requisito implicito di UX, in attesa di
formalizzazione in un futuro aggiornamento dell'Analisi dei Requisiti.

### Composizione di due sorgenti eterogenee

Il tratto architetturale distintivo della feature è la necessità di unire
in una lista coerente due sorgenti di dati con natura opposta:

- **Storico HTTP** — le notifiche precedenti all'avvio dell'app, caricate
  una sola volta tramite `NotificationApiService.getNotificationsHistory()`
  all'apertura della pagina. È un Observable freddo: emette un solo array
  e si completa.
- **Stream push in-session** — le notifiche arrivate durante la sessione
  corrente, già parsate e rese disponibili da `AlarmStateService.getNotifications()`
  tramite il suo `BehaviorSubject` interno. È un Observable caldo: emette
  ad ogni nuova notifica ricevuta via WebSocket e non si completa mai.

La composizione — con deduplicazione per `notificationId` e ordinamento
decrescente per `sentAt` — è delegata interamente a `NotificationService`
tramite `combineLatest`. Il componente smart riceve un unico
`Observable<NotificationListVm>` già pronto e non conosce né la provenienza
dei dati né la logica di fusione.

```
NotificationApiService.getNotificationsHistory()  (cold, HTTP one-shot)
         │
         │  catchError → of([])
         ▼
    combineLatest ─────────────────────────────────────────
         ▲                                                 │
         │                                                 ▼
AlarmStateService.getNotifications()         NotificationService.vm$
(hot, BehaviorSubject)                       dedup per notificationId
                                             sort per sentAt desc
AlarmStateService.getUnreadCount() ──────────map → NotificationListVm
(hot, BehaviorSubject derivato)                          │
                                                         ▼
                                           NotificationPageComponent
                                           async pipe + *ngIf ... as vm
                                                         │
                                                *ngFor su vm.notifications
                                                         ▼
                                           NotificationItemComponent
                                           @Input() notification: NotificationEvent
```

**Gestione del fallimento HTTP:** la sorgente `getNotificationsHistory()` è
avvolta da `catchError(() => of([]))`. Se la chiamata HTTP fallisce,
`combineLatest` riceve comunque un'emissione (array vuoto) e può produrre
`vm$` mostrando solo le notifiche push in-session. Senza questo fallback,
un errore HTTP bloccherebbe `combineLatest` indefinitamente, lasciando il
template in attesa senza feedback visivo.

### Principi architetturali rispettati

- `AlarmStateService` non viene modificato. `NotificationService` lo consuma
  in sola lettura tramite `getNotifications()` e `getUnreadNotificationsCount()`.
  Non viene chiamato alcun metodo di mutazione.

- `AlarmApiService` non viene toccato. Il metodo HTTP per le notifiche è
  separato in `NotificationApiService` — un service con responsabilità
  singola — per rispettare SRP e isolare i due domini (allarmi e notifiche).

- I componenti della feature sono tutti **Standalone**. Non esiste un
  NgModule che li dichiara. Il routing è gestito dall'app router tramite
  `loadComponent`.

- `NotificationService` è scoped al componente smart (fornito nel suo
  array `providers[]`). Il suo ciclo di vita è legato a `NotificationPageComponent`:
  quando l'utente naviga via, Angular distrugge il componente, il suo injector
  locale, e con esso `NotificationService` — terminando automaticamente tutte
  le sottoscrizioni a `combineLatest` senza necessità di `ngOnDestroy`.

---

## 2. Modelli di dominio

---

### `NotificationEvent`

**File:** `core/alarm/models/notification-event.model.ts`
**Stereotipo:** `<<interface>>`

Rappresenta una singola notifica di sistema. È il modello di lettura usato
sia come elemento della risposta `GET /api/notifications` (storico HTTP) sia
come payload degli eventi push gestiti da `AlarmStateService.onNotificationReceived()`.

La simmetria tra le due forme di dato è intenzionale: `NotificationService`
può unire le due sorgenti senza trasformazioni intermedie perché entrambe
producono istanze dello stesso tipo. È definita nel layer `core/alarm` per
essere condivisa da `AlarmStateService`, `NotificationApiService` e
`NotificationService` senza dipendenze circolari.

> **Assunzione:** il campo `notificationId` assume che il backend garantisca
> l'unicità globale dell'identificatore tra sessioni diverse. Se due sessioni
> distinte producessero lo stesso `notificationId` per notifiche differenti,
> la deduplicazione in `NotificationService` produrrebbe risultati errati.
> Questa assunzione dovrebbe essere verificata con il contratto del backend.

| Campo | Tipo | UC | Descrizione |
|---|---|---|---|
| `notificationId` | `string` | — | Identificatore univoco della notifica. Usato da `NotificationService` come chiave di deduplicazione nell'unione tra storico HTTP e push in-session. Non visualizzato nel template |
| `title` | `string` | UC41.1.1, RF104 | Titolo della notifica. Visualizzato direttamente da `NotificationItemComponent` nel template senza trasformazioni |
| `sentAt` | `string` | UC41.1.2, RF105 | Timestamp ISO dell'istante di invio della notifica. Trasformato in stringa leggibile da `ElapsedTimePipe`. Usato da `NotificationService` come chiave di ordinamento decrescente nella lista finale |

---

### `NotificationListVm`

**File:** `features/notification/models/notification-list-vm.model.ts`
**Stereotipo:** `<<interface>>`
**Scope:** Feature-local — non esposto fuori da `NotificationFeature`

View Model che rappresenta lo snapshot coerente di tutto lo stato necessario
al template di `NotificationPageComponent`. Viene prodotto da
`NotificationService.vm$` tramite `combineLatest`.

**Motivazione del ViewModel:** senza di esso, `NotificationPageComponent`
dovrebbe gestire più `async` pipe separate su Observable distinti. Questo
introduce il rischio di frame inconsistenti (le pipe emettono in momenti
diversi), sposta logica di composizione nel template e duplica le dipendenze
del componente. Con il ViewModel, il componente ha un solo `Observable`,
il template un solo binding `async`, e l'emissione è sempre atomicamente
coerente.

| Campo | Tipo | UC | Descrizione |
|---|---|---|---|
| `notifications` | `NotificationEvent[]` | UC41, UC41.1 | Lista unificata e ordinata per `sentAt` decrescente delle notifiche storiche (HTTP) e in-session (push). La deduplicazione per `notificationId` garantisce che ogni notifica compaia una sola volta anche se presente in entrambe le sorgenti |
| `unreadCount` | `number` | *(nessun UC corrente)* | Contatore delle notifiche non ancora lette. Derivato da `AlarmStateService.getUnreadNotificationsCount()`. Alimenta `NotificationBadgeComponent` tramite `MainLayoutComponent`. **Non coperto da alcun Use Case nell'Analisi dei Requisiti corrente** — il concetto di notifica letta/non letta non è modellato in UC41 né nei RF. Il campo è presente per completezza di design in attesa di formalizzazione futura |

---

## 3. Service condivisi (Core)

Questa sezione documenta le classi del layer `core` coinvolte nella feature.
`AlarmStateService` è invariato rispetto al suo design originale.
`NotificationApiService` è un nuovo service aggiunto al layer `core`.

---

### `AlarmStateService`

**File:** `core/alarm/services/alarm-state.service.ts`
**Stereotipo:** `<<state-service>>`
**Scope:** `providedIn: 'root'`

**Stato: invariato.** `AlarmStateService` non richiede alcuna modifica per
supportare `NotificationFeature`. I metodi `getNotifications()` e
`getUnreadNotificationsCount()` erano già presenti nel design originale.
`NotificationService` li consuma direttamente in sola lettura.

I metodi rilevanti per questa feature sono:

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `getNotifications()` | `Observable<NotificationEvent[]>` | UC41 | Espone il `BehaviorSubject<NotificationEvent[]>` interno come Observable. Emette immediatamente il valore corrente alla sottoscrizione (comportamento di `BehaviorSubject`) e ad ogni nuova notifica push ricevuta tramite `onNotificationReceived()`. Rappresenta le sole notifiche arrivate durante la sessione corrente — non include lo storico precedente all'avvio dell'app |
| `getUnreadNotificationsCount()` | `Observable<number>` | *(nessun UC corrente)* | Proiezione derivata del `BehaviorSubject` interno che conta le notifiche non ancora marcate come lette. Alimenta il campo `unreadCount` del ViewModel e, tramite `MainLayoutComponent`, il badge nella barra di navigazione. **Non coperto da alcun Use Case corrente** — vedi nota in `NotificationListVm.unreadCount` |

Gli altri metodi di `AlarmStateService` (`onAlarmTriggered`, `onAlarmResolved`,
`onNotificationReceived`, `getActiveAlarms`, `getActiveAlarmsCount`) non sono
usati da questa feature.

---

### `NotificationApiService`

**File:** `core/notification/services/notification-api.service.ts`
**Stereotipo:** `<<service>>`
**Scope:** `providedIn: 'root'`

Service HTTP con responsabilità singola: caricare lo storico delle notifiche
dal backend. È collocato nel layer `core` perché potrebbe essere condiviso
da altre feature (es. `DashboardFeature`) senza creare dipendenze verso il
layer `features`.

Non gestisce stato, non mantiene Observable caldi, non conosce i consumatori.
È un repository HTTP puro: ogni chiamata è un Observable freddo che emette
una volta e si completa.

Il token JWT è aggiunto automaticamente da `AuthInterceptor` a livello di
`HttpClient` pipeline — `NotificationApiService` non gestisce autenticazione.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `http` | `HttpClient` | `private` | Client HTTP Angular iniettato via DI. Unico punto di accesso alla rete |
| `baseUrl` | `string` | `private` | URL base del backend, letta da `environment.apiBaseUrl`. Prefissa il path dell'endpoint `/api/notifications` |

### Metodi

| Metodo | Ritorna | Endpoint | UC | Descrizione |
|---|---|---|---|---|
| `getNotificationsHistory()` | `Observable<NotificationEvent[]>` | `GET /api/notifications` | UC41, RF102 | Carica la lista storica completa delle notifiche ricevute dall'utente. Observable freddo: emette una volta e si completa. `NotificationService` lo chiama una sola volta all'inizializzazione della pipeline `vm$` e lo avvolge in `catchError(() => of([]))` per garantire la robustezza in caso di errore di rete |

---

## 4. Service

### `NotificationService`

**File:** `features/notification/services/notification.service.ts`
**Stereotipo:** `<<service>>`
**Scope:** Component-scoped — fornito nell'array `providers[]` di
`NotificationPageComponent`. Non è `providedIn: 'root'`.

Nasconde la complessità della composizione tra le sorgenti di dati dietro
un'interfaccia minimale: un unico campo pubblico `vm$`. Il componente smart
non conosce né la provenienza dei dati né la logica di fusione.

**Perché è component-scoped:** `NotificationService` mantiene sottoscrizioni
attive verso `AlarmStateService` tramite `combineLatest`. Legarne il ciclo
di vita al componente garantisce che queste sottoscrizioni vengano terminate
automaticamente quando `NotificationPageComponent` viene distrutto (navigazione
verso un'altra route), senza necessità di `ngOnDestroy` né di
`takeUntilDestroyed`. Angular gestisce tutto tramite il suo injector locale.

### Costruzione di `vm$`

`vm$` viene inizializzato nel costruttore del service tramite `combineLatest`:

```typescript
this.vm$ = combineLatest([
  this.notificationApiService.getNotificationsHistory().pipe(
    catchError(() => of([]))
  ),
  this.alarmStateService.getNotifications(),
  this.alarmStateService.getUnreadNotificationsCount(),
]).pipe(
  map(([historic, inSession, unreadCount]) => {
    const merged = [...historic, ...inSession];
    const deduped = Array.from(
      new Map(merged.map(n => [n.notificationId, n])).values()
    );
    const sorted = deduped.sort(
      (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
    );
    return { notifications: sorted, unreadCount } satisfies NotificationListVm;
  })
);
```

Il `BehaviorSubject` interno di `AlarmStateService` garantisce che sia
`getNotifications()` che `getUnreadNotificationsCount()` emettano
immediatamente alla sottoscrizione, permettendo a `combineLatest` di
produrre la prima emissione di `vm$` non appena l'HTTP risponde (o fallisce
con il fallback `of([])`).

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `alarmStateService` | `AlarmStateService` | `private` | Sorgente degli stream push in-session. Iniettato via DI. Consumato in sola lettura tramite `getNotifications()` e `getUnreadNotificationsCount()` — nessun metodo di mutazione viene chiamato |
| `notificationApiService` | `NotificationApiService` | `private` | Gateway HTTP per il caricamento dello storico. Iniettato via DI |
| `vm$` | `Observable<NotificationListVm>` | `public` | Observable del ViewModel — unico punto di accesso ai dati per `NotificationPageComponent`. Costruito nel costruttore del service. Emette ad ogni nuova notifica push in-session o aggiornamento del contatore non lette |

---

## 5. Component

### `NotificationPageComponent`

**File:** `features/notification/components/notification-page/notification-page.component.ts`
**Stereotipo:** `<<component>>`
**Tipo:** Smart Component (Standalone)
**UC coperti:** UC41, UC41.1

Componente smart che funge da contenitore della feature. È l'unico componente
della feature a iniettare un service. Ha un'unica responsabilità: esporre
`vm$` al template tramite `async` pipe e propagare il ViewModel ai componenti
figli tramite `@Input()`.

Non gestisce alcuna sottoscrizione manuale. Non mantiene stato locale. Non
conosce né `AlarmStateService` né `NotificationApiService` — vede solo il
contratto minimo esposto da `NotificationService`.

`NotificationService` è fornito nel proprio array `providers[]`: ogni
istanza di `NotificationPageComponent` riceve la propria istanza del service,
con ciclo di vita legato al componente.

### Template — binding principali

```html
<ng-container *ngIf="notificationService.vm$ | async as vm">
  <app-notification-item
    *ngFor="let notification of vm.notifications"
    [notification]="notification">
  </app-notification-item>
</ng-container>
```

Il pattern `*ngIf … as vm` garantisce che i componenti figli vengano
istanziati solo quando `vm$` ha emesso il primo valore. Questo evita
accessi a proprietà di un oggetto null durante il primo ciclo di rendering
e fornisce un'implicita fase di caricamento (il contenuto non appare finché
i dati non sono pronti).

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `notificationService` | `NotificationService` | `private` | Service iniettato via DI. Unica dipendenza da service di questo componente. Fornito nel proprio `providers[]` — component-scoped |

---

### `NotificationItemComponent`

**File:** `features/notification/components/notification-item/notification-item.component.ts`
**Stereotipo:** `<<component>>`
**Tipo:** Presentational (Dumb) Component (Standalone)
**UC coperti:** UC41.1, UC41.1.1, UC41.1.2

Componente presentazionale che visualizza le informazioni di una singola
notifica. Non inietta servizi, non emette eventi verso l'alto — la feature
è in sola lettura, non esistono `@Output()`. Riceve tutti i dati tramite
`@Input()`.

Importa `ElapsedTimePipe` direttamente nel proprio array `imports[]`
(pattern Standalone), senza dipendere da alcun modulo condiviso.

È compatibile con `ChangeDetectionStrategy.OnPush` perché l'unico input
(`notification`) è un oggetto immutabile prodotto dalla pipeline di
`NotificationService`.

### Attributi

| Attributo | Tipo | Visibilità | Stereotipo | UC | Descrizione |
|---|---|---|---|---|---|
| `notification` | `NotificationEvent` | `public` | `@Input()` | UC41.1 | La notifica da visualizzare. Obbligatorio. Il template lega direttamente i suoi campi |

### Dati visualizzati nel template

| Campo sorgente | UC | Trasformazione | Requisito |
|---|---|---|---|
| `notification.title` | UC41.1.1 | Diretta — stringa grezza | RF104 |
| `notification.sentAt` | UC41.1.2 | `ElapsedTimePipe` — da ISO timestamp a stringa leggibile (es. `"3m fa"`) | RF105 |

---

### `NotificationBadgeComponent`

**File:** `features/notification/components/notification-badge/notification-badge.component.ts`
**Stereotipo:** `<<component>>`
**Tipo:** Presentational (Dumb) Component (Standalone, esportabile)
**UC coperti:** *(nessuno — funzionalità non coperta dall'Analisi dei Requisiti corrente)*

> **Nota di copertura requisiti:** questo componente visualizza il contatore
> delle notifiche non lette nella barra di navigazione globale. Il concetto
> di notifica letta/non letta non è modellato in nessun Use Case dell'Analisi
> dei Requisiti v2.1.0 (UC41 e la sua famiglia descrivono esclusivamente la
> visualizzazione della lista; i termini "non lette", "badge" e "contatore"
> non compaiono nei requisiti). Il componente è presente nel design come
> scelta di prodotto che anticipa un requisito implicito di UX. Prima
> dell'implementazione è opportuno formalizzare questo comportamento con un
> nuovo UC (es. *"UC41.2 Visualizzazione contatore notifiche non lette"*) e
> il relativo RF, allineando l'Analisi dei Requisiti al design.

Componente presentazionale che visualizza un badge numerico nella barra di
navigazione per segnalare all'utente la presenza di notifiche non ancora
visualizzate.

Non appartiene alla pagina delle notifiche in senso stretto: è collocato nel
contesto di `MainLayoutComponent` ed è da questo istanziato e alimentato.
Non inietta servizi — riceve il contatore esclusivamente via `@Input()`.

**Perché è dumb:** se iniettasse `AlarmStateService` direttamente,
creerebbe una dipendenza da un Core Service in un componente renderizzato
nel layout globale, complicando il testing e accoppiando il layout al dominio
Alarm. Rendendolo dumb, il responsabile di fornire il dato è
`MainLayoutComponent`, che inietta `AlarmStateService` nel proprio smart
component e passa il valore scalare via `@Input()`.

**Come viene usato da `MainLayoutComponent`:**

```html
<!-- In MainLayoutComponent template -->
<app-notification-badge
  [count]="(alarmStateService.getUnreadNotificationsCount() | async) ?? 0">
</app-notification-badge>
```

### Attributi

| Attributo | Tipo | Visibilità | Stereotipo | UC | Descrizione |
|---|---|---|---|---|---|
| `count` | `number` | `public` | `@Input()` | *(nessun UC corrente)* | Numero di notifiche non lette da visualizzare. Il template usa `*ngIf="count > 0"` per nascondere il badge quando non ci sono notifiche non lette, evitando di mostrare "0" |

---

## 6. Pipe

### `ElapsedTimePipe`

**File:** `shared/pipes/elapsed-time.pipe.ts`
**Stereotipo:** `<<pipe>>`
**Tipo:** Standalone, pura (`pure: true`)
**Scope:** Condivisa — importata direttamente da `NotificationItemComponent`
e da altri componenti che ne hanno bisogno (es. `AlarmItemComponent` in
`AlarmManagementFeature`)

Pipe Angular pura che trasforma un timestamp ISO in una stringa leggibile
che rappresenta il tempo trascorso dall'istante indicato a oggi
(RF105 — UC41.1.2).

Esempi di output: `"3s fa"`, `"2m fa"`, `"1h 12m fa"`, `"3g fa"`.

**Perché è standalone e non dichiarata in un modulo condiviso:** con il
pattern Standalone Components, la condivisione avviene tramite import diretto
nel proprio array `imports[]`. Non è necessario un `SharedModule`
intermediario. Le dipendenze di ciascun componente sono autodescrittive e
leggibili senza aprire file di modulo.

**Perché è pura:** la trasformazione dipende esclusivamente dal valore in
input — stesso input produce sempre stesso output. Questo la rende:
- Sicura con `ChangeDetectionStrategy.OnPush`: Angular non la riesegue se
  l'input non cambia
- Testabile in isolamento con un semplice unit test sulla funzione `transform()`
- Performante: nessuna riesecuzione inutile a ogni ciclo di change detection

**Limitazione nota:** il valore calcolato riflette il tempo trascorso al
momento del rendering, ma non si aggiorna automaticamente se la pagina
rimane aperta. `"3s fa"` diventa obsoleto senza un meccanismo di refresh
periodico. Questo comportamento è accettabile per la versione corrente.

### Metodi

| Metodo | Parametro | Ritorna | UC | Descrizione |
|---|---|---|---|---|
| `transform(sentAt: string)` | Timestamp ISO | `string` | UC41.1.2, RF105 | Calcola la differenza tra `new Date()` e il timestamp in input. Formatta il risultato con granularità a secondi, minuti, ore e giorni. Accetta qualsiasi stringa ISO valida — il nome del parametro (`sentAt`) è contestuale a `NotificationFeature`; la stessa pipe usata in altri contesti riceve campi con nomi semantici diversi (es. `triggeredAt` in `AlarmManagementFeature`) |

---

## 7. Routing

La feature è caricata lazy tramite `loadComponent` nell'app router. Non
esiste un routing module dedicato:

```typescript
// In app.routes.ts (o equivalente)
{
  path: 'notifications',
  loadComponent: () =>
    import('./features/notification/components/notification-page/notification-page.component')
      .then(c => c.NotificationPageComponent),
  canActivate: [AuthGuard]
}
```

`AuthGuard` garantisce che la route sia accessibile solo agli utenti
autenticati — pre-condizione esplicita di UC41 (*"L'Utente è autenticato
nel Sistema"*).

La feature ha un'unica route senza sottopagine: tutta la UI è contenuta in
`NotificationPageComponent` e nel suo figlio `NotificationItemComponent`.
`NotificationBadgeComponent` non è raggiungibile tramite routing — è
renderizzato da `MainLayoutComponent` indipendentemente dalla route corrente.

---

## 8. Relazioni

### Modelli di dominio

| Sorgente | Destinazione | Tipo | Descrizione |
|---|---|---|---|
| `NotificationListVm` | `NotificationEvent` | `-->` associazione | Il campo `notifications` è un array di `NotificationEvent`. Il ViewModel aggrega le istanze ma non le possiede — esistono nelle sorgenti originali (array HTTP e BehaviorSubject) |

### Service condivisi (Core)

| Sorgente | Destinazione | Tipo | Descrizione |
|---|---|---|---|
| `NotificationApiService` | `NotificationEvent` | `..>` dipendenza tratteggiata | Ritorna `NotificationEvent[]` come tipo della risposta di `getNotificationsHistory()`. Non possiede le istanze — le deserializza dalla risposta HTTP e le consegna al consumatore |
| `AlarmStateService` | `NotificationEvent` | `..>` dipendenza tratteggiata | Emette `NotificationEvent[]` tramite il `BehaviorSubject` interno. Le istanze sono create da `onNotificationReceived()` quando arriva un evento push |

### NotificationService

| Sorgente | Destinazione | Tipo | Descrizione |
|---|---|---|---|
| `NotificationService` | `AlarmStateService` | `-->` dipendenza (inietta) | Consuma `getNotifications()` per lo stream push in-session e `getUnreadNotificationsCount()` per il contatore non lette. Interazione in sola lettura — nessun metodo di mutazione viene chiamato |
| `NotificationService` | `NotificationApiService` | `-->` dipendenza (inietta) | Consuma `getNotificationsHistory()` per il caricamento dello storico HTTP. La chiamata è avvolta da `catchError(() => of([]))` per garantire la robustezza |
| `NotificationService` | `NotificationListVm` | `..>` dipendenza tratteggiata | Produce `NotificationListVm` tramite `combineLatest` + dedup + sort + map. Emette nuove istanze immutabili ad ogni aggiornamento delle sorgenti |
| `NotificationService` | `NotificationEvent` | `..>` dipendenza tratteggiata | Consuma `NotificationEvent[]` da entrambe le sorgenti, le unisce e le deduplica per `notificationId` |

### NotificationPageComponent

| Sorgente | Destinazione | Tipo | Descrizione |
|---|---|---|---|
| `NotificationPageComponent` | `NotificationService` | `-->` dipendenza (inietta, providers-scoped) | Unica dipendenza da service del componente smart. Espone `notificationService.vm$` al template tramite `async` pipe — non chiama mai metodi diretti |
| `NotificationPageComponent` | `NotificationListVm` | `..>` dipendenza tratteggiata | `vm$` è risolto nel template con `*ngIf … as vm`. Il componente riceve uno snapshot `NotificationListVm` ad ogni emissione e lo propaga ai figli |
| `NotificationPageComponent` | `NotificationItemComponent` | `-->` composizione di template | Il template renderizza `<app-notification-item>` in `*ngFor` su `vm.notifications`. Ogni istanza riceve un `NotificationEvent` distinto tramite `@Input()` |

### NotificationItemComponent

| Sorgente | Destinazione | Tipo | Descrizione |
|---|---|---|---|
| `NotificationItemComponent` | `NotificationEvent` | `..>` dipendenza tratteggiata | Riceve `NotificationEvent` via `@Input() notification`. Il template accede direttamente ai campi `title` e `sentAt` |
| `NotificationItemComponent` | `ElapsedTimePipe` | `..>` dipendenza (`imports[]`) | Importata direttamente nel proprio array `imports[]`. Usata nel template tramite `notification.sentAt \| elapsedTime` per trasformare il timestamp ISO in stringa leggibile (RF105, UC41.1.2) |

### NotificationBadgeComponent

| Sorgente | Destinazione | Tipo | Descrizione |
|---|---|---|---|
| `MainLayoutComponent` | `NotificationBadgeComponent` | `-->` composizione di template (cross-feature) | `MainLayoutComponent` istanzia `<app-notification-badge>` nel proprio template e ne alimenta `[count]` sottoscrivendosi a `AlarmStateService.getUnreadNotificationsCount()` tramite `async` pipe con fallback `?? 0`. La relazione è cross-feature e non compare nel class diagram della `NotificationFeature` |
