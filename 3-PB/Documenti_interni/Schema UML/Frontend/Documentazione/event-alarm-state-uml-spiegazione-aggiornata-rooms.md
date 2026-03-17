# Spiegazione: Event Subscription Service & Alarm State Service UML (v4)

Documento di riferimento per il class diagram `event-alarm-state-uml-v4.mermaid`,
relativo ai componenti `EventSubscriptionService` e `AlarmStateService`
del Frontend Angular dell'applicazione **View4Life**.

---

## Indice

1. [Panoramica Architetturale](#1-panoramica-architetturale)
2. [DTO — Livello di Trasporto](#2-dto--livello-di-trasporto)
   - [PushEvent](#pushevent)
   - [AlarmEvent](#alarmevent)
   - [NotificationEvent](#notificationevent)
3. [Model — Livello di Dominio](#3-model--livello-di-dominio)
   - [ActiveAlarm](#activealarm)
4. [Enum](#4-enum)
   - [PushEventType](#pusheventtype)
   - [ConnectionStatus](#connectionstatus)
5. [Service](#5-service)
   - [EventSubscriptionService](#eventsubscriptionservice)
   - [AlarmStateService](#alarmstateservice)
6. [Feature Module (Consumer)](#6-feature-module-consumer)
7. [Design Pattern](#7-design-pattern)
8. [Relazioni](#8-relazioni)

---

## 1. Panoramica Architetturale

I due service implementano una **separazione delle responsabilità** netta,
già dichiarata nell'architettura C4 Livello 3:

| Service | Sa | Non sa |
|---|---|---|
| `EventSubscriptionService` | **Come** arrivano i dati (Socket.IO, rooms, protocollo, connessione) | Business logic degli allarmi |
| `AlarmStateService` | **Cosa significano** i dati (regole di business, gestione dello stato) | Socket.IO, rooms, protocollo di trasporto |

Il flusso dei dati è unidirezionale:

```
Backend ──push──► EventSubscriptionService ──dispatch──► AlarmStateService ──Observable──► Feature UI
```

Questa architettura elimina il polling, mantiene la UI sempre sincronizzata
con gli eventi in tempo reale, e mantiene ogni classe focalizzata su
un'unica responsabilità.

### Socket.IO Rooms

Il backend utilizza le **Socket.IO rooms** per isolare gli eventi per reparto
(`wardId`). Una room è un canale logico server-side: il client apre
**una sola connessione WebSocket** e si iscrive a più room tramite messaggi
sul socket esistente.

```
Client Angular                    Server NestJS
     │                                  │
     │──── connect() ──────────────────►│  (1 sola connessione TCP)
     │                                  │
     │──── emit('join-ward', wardId) ──►│  socket.join('ward:42')
     │                                  │
     │◄─── evento da 'ward:42' ─────────│  server.to('ward:42').emit(...)
     │◄─── evento da 'ward:99' ─────────│  server.to('ward:99').emit(...)
```

`EventSubscriptionService` gestisce questo ciclo di vita: apre la connessione
una volta sola in `connect()`, poi iscrive e disiscrive il client dalle room
dei reparti tramite `joinRoom()` e `leaveRoom()`. Il set `joinedRooms`
tiene traccia delle room attive per evitare iscrizioni duplicate.

---

## 2. DTO — Livello di Trasporto

I DTO in questo contesto rappresentano **eventi grezzi ricevuti dal backend**
tramite la connessione push. Sono puri contratti di dati, senza logica né stato.

### `PushEvent`

**File:** `push-event.model.ts`
**Stereotipo:** `<<DTO>>`

Evento grezzo generico emesso dalla connessione Socket.IO del backend.
È la busta comune per tutti gli eventi che arrivano dalle room a cui
il client è iscritto.

| Campo | Tipo | Descrizione |
|---|---|---|
| `eventType` | `PushEventType` | Discriminatore che identifica il tipo di evento. Usato da `EventSubscriptionService` per smistare l'evento al gestore corretto |
| `payload` | `unknown` | Corpo grezzo dell'evento. Il tipo concreto dipende da `eventType` e viene risolto tramite type narrowing |
| `timestamp` | `string` | Timestamp ISO 8601 di quando l'evento è stato emesso dal backend |

---

### `AlarmEvent`

**File:** `alarm-event.model.ts`
**Stereotipo:** `<<DTO>>`

Risultato tipizzato del narrowing di un `PushEvent` il cui `eventType` è
`ALARM_TRIGGERED`. Prodotto da `EventSubscriptionService` dopo il parsing
del `payload` grezzo e inoltrato ad `AlarmStateService`.

| Campo | Tipo | Descrizione |
|---|---|---|
| `alarmId` | `string` | Identificatore univoco dell'allarme |
| `alarmName` | `string` | Nome visualizzato dell'allarme — UC17.1.1.2 |
| `dangerSignal` | `string` | Indicatore del segnale di pericolo — UC17.1.1.1 |
| `triggeredAt` | `string` | Timestamp ISO 8601 dello scatto dell'allarme. Usato per calcolare il tempo trascorso — UC17.1.1.3 |

> Il backend non include `wardId` nel payload dell'evento. Il filtraggio
> per reparto avviene a monte tramite le room Socket.IO: il client riceve
> solo gli eventi delle room a cui si è iscritto.

---

### `NotificationEvent`

**File:** `notification-event.model.ts`
**Stereotipo:** `<<DTO>>`

Risultato tipizzato del narrowing di un `PushEvent` il cui `eventType` è
`NOTIFICATION`. Prodotto da `EventSubscriptionService` e inoltrato
ad `AlarmStateService` per la gestione dello stato.

| Campo | Tipo | Descrizione |
|---|---|---|
| `notificationId` | `string` | Identificatore univoco della notifica |
| `title` | `string` | Titolo della notifica — UC41.1.1 |
| `sentAt` | `string` | Timestamp ISO 8601 di invio della notifica — usato per calcolare il tempo trascorso in UC41.1.2 |

---

## 3. Model — Livello di Dominio

A differenza dei DTO, i model di dominio rappresentano **stato applicativo
calcolato** — dati che sono stati elaborati e arricchiti rispetto a quanto
inviato dal backend.

### `ActiveAlarm`

**File:** `active-alarm.model.ts`
**Stereotipo:** `<<model>>`

Rappresenta un allarme attualmente attivo nel sistema, come mantenuto
da `AlarmStateService`. **Non** è un oggetto di trasporto diretto — viene
costruito a partire da un `AlarmEvent` e arricchito con stato calcolato.

La differenza fondamentale rispetto ad `AlarmEvent` è `elapsedTime`,
calcolato lato client a partire da `triggeredAt` e il tempo corrente,
corrispondente a UC17.1.1.3 (tempo trascorso dallo scatto dell'allarme).

| Campo | Tipo | Descrizione |
|---|---|---|
| `alarmId` | `string` | Identificatore univoco, corrisponde all'`AlarmEvent` di origine |
| `alarmName` | `string` | Nome visualizzato — UC17.1.1.2 |
| `dangerSignal` | `string` | Indicatore segnale di pericolo — UC17.1.1.1 |
| `triggeredAt` | `string` | Timestamp originale dello scatto, dall'`AlarmEvent` |
| `elapsedTime` | `number` | Campo calcolato — millisecondi trascorsi da `triggeredAt`. Ricalcolato periodicamente da `AlarmStateService` — UC17.1.1.3 |

> `elapsedTime` è ciò che rende `ActiveAlarm` un **model** e non un DTO:
> porta stato calcolato che non esiste nell'evento grezzo del backend.

---

## 4. Enum

### `PushEventType`

**File:** `push-event-type.enum.ts`
**Stereotipo:** `<<enum>>`

Discriminatore usato da `EventSubscriptionService` per smistare i `PushEvent`
in ingresso al corretto percorso di parsing e dispatch.
Evita l'uso di stringhe magiche (`"alarm"`, `"notification"`) nel codice.

| Valore | Descrizione |
|---|---|
| `ALARM_TRIGGERED` | Un nuovo allarme è stato scattato da un dispositivo IoT |
| `ALARM_RESOLVED` | Un allarme esistente è stato risolto |
| `NOTIFICATION` | Una nuova notifica è stata emessa dal backend |

---

### `ConnectionStatus`

**File:** `connection-status.enum.ts`
**Stereotipo:** `<<enum>>`

Rappresenta lo stato corrente della **connessione Socket.IO globale** gestita
da `EventSubscriptionService`. È riferito alla singola connessione TCP —
non alle singole room, che sono canali logici sopra di essa. Esposto come
Observable così la UI può reagire ai cambi di connettività (es. mostrare
un banner "Reconnecting...").

| Valore | Descrizione |
|---|---|
| `CONNECTED` | Connessione Socket.IO attiva e in ricezione di eventi |
| `DISCONNECTED` | Connessione terminata o persa |
| `RECONNECTING` | Il service sta tentando di ristabilire la connessione |

---

## 5. Service

### `EventSubscriptionService`

**File:** `event-subscription.service.ts`
**Stereotipo:** `<<service>>`
**Scope:** `providedIn: 'root'` — singleton globale
**Inizializzato da:** `APP_INITIALIZER` — viene eseguito prima del rendering dell'app

**Responsabilità unica:** gestire il ciclo di vita della connessione Socket.IO
e delle room per reparto, e parsare gli eventi grezzi in oggetti tipizzati.
Non conosce nulla di business logic — conosce solo il protocollo di trasporto
e la topologia delle room.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `alarmStateService` | `AlarmStateService` | `private` | Iniettato via DI. Riceve gli eventi tipizzati dopo il dispatch |
| `connectionStatus$` | `BehaviorSubject<ConnectionStatus>` | `private` | Stato corrente della connessione Socket.IO globale. Inizializzato a `DISCONNECTED`. Non riflette lo stato delle singole room — solo della connessione TCP sottostante |
| `joinedRooms` | `Set<string>` | `private` | Insieme dei `wardId` delle room a cui il client è attualmente iscritto. Usato per evitare iscrizioni duplicate e per gestire il cleanup alla disconnessione |
| `destroy$` | `Subject<void>` | `private` | Pattern Angular standard per la gestione dell'unsubscribe. Usato con `takeUntil(destroy$)` per prevenire memory leak alla distruzione del service |

### Metodi

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `initialize(wardIds)` | `void` | Chiamato da `APP_INITIALIZER`. Apre la connessione Socket.IO tramite `connect()` e si iscrive alle room dei reparti forniti tramite `joinRoom()`. È il punto di ingresso dell'intera pipeline push |
| `getConnectionStatus$()` | `Observable<ConnectionStatus>` | Espone lo stato della connessione come Observable in sola lettura. Consumato dai componenti UI che mostrano lo stato di connettività |
| `joinRoom(wardId)` | `void` | Emette l'evento `join-ward` sul socket con il `wardId` fornito. Il server esegue `socket.join('ward:<wardId>')`. Aggiunge il `wardId` a `joinedRooms` |
| `leaveRoom(wardId)` | `void` | Emette l'evento `leave-ward` sul socket. Il server rimuove il client dalla room. Rimuove il `wardId` da `joinedRooms` |
| `connect()` | `void` | `private` — Apre la connessione Socket.IO verso il backend. Aggiorna `connectionStatus$` a `CONNECTED`. Imposta lo stream di eventi con `takeUntil(destroy$)` |
| `disconnect()` | `void` | `private` — Chiude la connessione Socket.IO. Svuota `joinedRooms`. Aggiorna `connectionStatus$` a `DISCONNECTED`. Completa `destroy$` per triggerare tutti gli unsubscribe |
| `parseRawEvent(raw)` | `PushEvent` | `private` — Deserializza il messaggio Socket.IO grezzo in un `PushEvent` tipizzato. Valida il campo `eventType` contro `PushEventType` |
| `dispatchAlarmEvent(event)` | `void` | `private` — Chiamato quando `eventType` è `ALARM_TRIGGERED` o `ALARM_RESOLVED`. Esegue il narrowing del `payload` ad `AlarmEvent` e chiama il metodo appropriato su `AlarmStateService` |
| `dispatchNotificationEvent(event)` | `void` | `private` — Chiamato quando `eventType` è `NOTIFICATION`. Esegue il narrowing del `payload` a `NotificationEvent` e chiama `alarmStateService.onNotificationReceived()` |

---

### `AlarmStateService`

**File:** `alarm-state.service.ts`
**Stereotipo:** `<<state-service>>`
**Scope:** `providedIn: 'root'` — singleton globale

**Responsabilità unica:** ricevere gli eventi tipizzati da `EventSubscriptionService`,
applicare le regole di business, mantenere lo stato corrente degli allarmi attivi
e delle notifiche, ed esporlo reattivamente alla UI.

Non ha **nessuna conoscenza** di Socket.IO, rooms, connessioni push o protocolli
di trasporto. Rimane invariato rispetto alla v3.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `activeAlarms$` | `BehaviorSubject<ActiveAlarm[]>` | `private` | Lista corrente degli allarmi attivi. Inizializzata a `[]`. Ogni subscriber riceve immediatamente il valore corrente e tutti gli aggiornamenti futuri — UC17.1, UC17.2 |
| `notifications$` | `BehaviorSubject<NotificationEvent[]>` | `private` | Lista corrente delle notifiche. Inizializzata a `[]` — UC41 |

### Metodi

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `onAlarmTriggered(event)` | `void` | Chiamato da `EventSubscriptionService` all'arrivo di un nuovo allarme. Costruisce un `ActiveAlarm` dall'`AlarmEvent` (calcolando `elapsedTime`), lo aggiunge ad `activeAlarms$` e emette la lista aggiornata |
| `onAlarmResolved(alarmId)` | `void` | Chiamato da `EventSubscriptionService` quando un allarme viene risolto (UC28). Rimuove l'allarme con `alarmId` corrispondente da `activeAlarms$` e emette la lista aggiornata |
| `onNotificationReceived(event)` | `void` | Chiamato da `EventSubscriptionService` all'arrivo di una notifica. La antepone a `notifications$` e emette la lista aggiornata — UC41 |
| `getActiveAlarms$()` | `Observable<ActiveAlarm[]>` | Observable in sola lettura della lista allarmi attivi. Sottoscritto da `AlarmManagementFeature`, `DashboardFeature`, `ApartmentMonitorFeature` |
| `getActiveAlarmsCount$()` | `Observable<number>` | Observable derivato — emette il conteggio degli allarmi attivi. Usato da `DashboardFeature` per il widget statistiche allarmi — UC17.2.2 |
| `getNotifications$()` | `Observable<NotificationEvent[]>` | Observable in sola lettura della lista notifiche. Sottoscritto da `NotificationFeature` — UC41 |
| `getUnreadNotificationsCount$()` | `Observable<number>` | Observable derivato — emette il conteggio delle notifiche non lette. Usato da `NotificationFeature` per il badge contatore |

---

## 6. Feature Module (Consumer)

Sono i componenti C4 Livello 3 che si **sottoscrivono** agli Observable
esposti da `AlarmStateService`. Sono modellati come `<<feature-module>>`
perché in Angular sono NgModule completi con componenti interni,
non singoli `@Component`.

Vengono mostrati nel diagramma solo per rappresentare il **confine di output**
di `AlarmStateService` — il loro design interno è trattato in diagrammi separati.

| Feature | Si sottoscrive a | UC coperti |
|---|---|---|
| `AlarmManagementFeature` | `getActiveAlarms$()` | UC17.1, UC17.1.1, UC28 |
| `DashboardFeature` | `getActiveAlarms$()`, `getActiveAlarmsCount$()` | UC17.1, UC17.2, UC17.2.1, UC17.2.2 |
| `ApartmentMonitorFeature` | `getActiveAlarms$()` | UC30.2 (mappa allarmi) |
| `NotificationFeature` | `getNotifications$()` | UC41, UC41.1 |

---

## 7. Design Pattern

### Observer tramite RxJS (`BehaviorSubject`)

`AlarmStateService` usa `BehaviorSubject` come contenitore di stato.
È l'implementazione Angular-idiomatica del pattern **Observer**:

- Ogni subscriber riceve **immediatamente il valore corrente** al momento della sottoscrizione
- Tutti i cambiamenti di stato futuri vengono **propagati automaticamente** a tutti i subscriber
- La UI non fa mai polling — reagisce soltanto

È il pattern corretto per stato in tempo reale che più componenti UI
indipendenti devono osservare simultaneamente.

### Event-Driven Architecture

I due service insieme formano una **pipeline event-driven** minimale:

```
join room → ricezione evento push → parsing → dispatch → aggiornamento stato → reazione UI
```

Ogni step è gestito da una classe diversa con responsabilità unica.
Non serve nessun pattern aggiuntivo (Facade, Repository) — il design
è già pulito e minimale.

### Socket.IO Rooms — una connessione, molti canali

Il backend utilizza le rooms come meccanismo di routing server-side.
La differenza architetturale rispetto a una connessione per reparto è netta:

| Approccio | Connessioni TCP | Gestione lato client |
|---|---|---|
| Una connessione per ward | N connessioni attive | `Map<wardId, socket>` |
| Socket.IO rooms (adottato) | **1 connessione** | `Set<wardId>` di room logiche |

Le rooms sono più leggere, scalabili e non richiedono logica di reconnect
per ogni singolo reparto — la reconnect automatica di Socket.IO gestisce
l'unica connessione globale. `joinedRooms` viene ripopolato alla riconnessione
da `initialize()`.

### `takeUntil(destroy$)` — Prevenzione Memory Leak

`destroy$` in `EventSubscriptionService` è il pattern Angular standard
per gestire il ciclo di vita degli Observable. Quando `disconnect()`
completa `destroy$`, tutte le sottoscrizioni che usano `takeUntil(destroy$)`
vengono pulite automaticamente, prevenendo memory leak alla distruzione del service.

---

## 8. Relazioni

| Sorgente | Destinazione | Tipo | Descrizione |
|---|---|---|---|
| `EventSubscriptionService` | `AlarmStateService` | `*--` composizione | Inietta `AlarmStateService` via DI e ne chiama attivamente i metodi pubblici per inoltrare gli eventi parsati |
| `EventSubscriptionService` | `PushEvent` | `..>` dipendenza | Produce oggetti `PushEvent` tramite `parseRawEvent()` |
| `EventSubscriptionService` | `AlarmEvent` | `..>` dipendenza | Produce `AlarmEvent` tramite type narrowing su `PushEvent.payload` in `dispatchAlarmEvent()` |
| `EventSubscriptionService` | `NotificationEvent` | `..>` dipendenza | Produce `NotificationEvent` tramite type narrowing in `dispatchNotificationEvent()` |
| `EventSubscriptionService` | `PushEventType` | `-->` dipendenza | Usa l'enum per discriminare il tipo di evento e smistarlo al metodo di dispatch corretto |
| `EventSubscriptionService` | `ConnectionStatus` | `-->` dipendenza | Aggiorna `connectionStatus$` con i valori dell'enum sugli eventi di connessione/disconnessione/riconnessione della connessione Socket.IO globale |
| `AlarmStateService` | `ActiveAlarm` | `-->` dipendenza | Mantiene e gestisce la lista di `ActiveAlarm` dentro `activeAlarms$` |
| `AlarmStateService` | `AlarmEvent` | `..>` dipendenza | Riceve `AlarmEvent` come parametro di input in `onAlarmTriggered()` |
| `AlarmStateService` | `NotificationEvent` | `..>` dipendenza | Riceve `NotificationEvent` come input in `onNotificationReceived()` |
| `AlarmEvent` | `PushEvent` | `..>` dipendenza | `AlarmEvent` è prodotto dal narrowing del campo `payload` di un `PushEvent` il cui `eventType` è `ALARM_TRIGGERED`. Non è ereditarietà di classe — è type narrowing TypeScript |
| `NotificationEvent` | `PushEvent` | `..>` dipendenza | Idem per `eventType` = `NOTIFICATION` |
| `AlarmManagementFeature` | `AlarmStateService` | `..>` dipendenza | Si sottoscrive a `getActiveAlarms$()` per visualizzare la lista allarmi in tempo reale — UC17.1, UC28 |
| `DashboardFeature` | `AlarmStateService` | `..>` dipendenza | Si sottoscrive a `getActiveAlarms$()` e `getActiveAlarmsCount$()` per i widget allarmi — UC17.1, UC17.2 |
| `ApartmentMonitorFeature` | `AlarmStateService` | `..>` dipendenza | Si sottoscrive a `getActiveAlarms$()` per renderizzare la mappa allarmi — UC30.2 |
| `NotificationFeature` | `AlarmStateService` | `..>` dipendenza | Si sottoscrive a `getNotifications$()` per visualizzare la lista notifiche — UC41 |
