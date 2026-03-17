# Spiegazione: Apartment Monitor Feature & Apartment API Service UML

Documento di riferimento per il class diagram `apartment-monitor-uml.mermaid`,
relativo ai componenti `ApartmentMonitorFeature` e `ApartmentApiService`
del Frontend Angular dell'applicazione **View4Life**.

---

## Indice

1. [Panoramica Architetturale](#1-panoramica-architetturale)
2. [DTO](#2-dto)
   - [ApartmentDto](#apartmentdto)
   - [RoomDto](#roomdto)
   - [DeviceDto](#devicedto)
   - [DeviceAction](#deviceaction)
3. [Enum](#3-enum)
   - [DeviceType](#devicetype)
4. [Service](#4-service)
   - [ApartmentApiService](#apartmentapiservice)
5. [Component](#5-component)
   - [ApartmentMonitorComponent](#apartmentmonitorcomponent)
   - [AlarmMapComponent](#alarmmapcomponent)
   - [RoomListComponent](#roomlistcomponent)
6. [Module](#6-module)
   - [ApartmentMonitorModule](#apartmentmonitormodule)
   - [ApartmentMonitorRoutingModule](#apartmentmonitorroutingmodule)
7. [Riferimenti Esterni](#7-riferimenti-esterni)
8. [Design Pattern](#8-design-pattern)
9. [Relazioni](#9-relazioni)

---

## 1. Panoramica Architetturale

`ApartmentMonitorFeature` è la schermata di dettaglio del singolo appartamento
(UC30). Il suo ruolo è mostrare all'utente tre informazioni in parallelo:
il nome dell'appartamento (UC30.1), la mappa degli allarmi attivi su
quell'appartamento (UC30.2), e l'elenco delle stanze con i relativi dispositivi
(UC30.3).

La feature ha due sorgenti di dati distinte con responsabilità diverse:

| Sorgente | Tipo di dato | Canale |
|---|---|---|
| `ApartmentApiService` | Struttura statica dell'appartamento (stanze, dispositivi) | HTTP REST |
| `AlarmStateService` | Allarmi attivi in tempo reale | Observable reattivo (push) |

Questa separazione è intenzionale: la struttura dell'appartamento cambia
raramente e si carica una volta sola in `ngOnInit()`, mentre gli allarmi
arrivano in tempo reale via push e non devono triggerare un reload dell'intera
pagina.

---

## 2. DTO

I DTO di questa feature modellano la gerarchia strutturale di un appartamento
così come restituita dal backend in un'unica chiamata GET. La composizione
`ApartmentDto → RoomDto → DeviceDto` riflette direttamente la struttura
annidiata della risposta HTTP, evitando chiamate N+1.

### `ApartmentDto`

**File:** `apartment.model.ts`
**Stereotipo:** `<<DTO>>`

Rappresenta l'appartamento completo restituito dal backend.
È il DTO radice della gerarchia: contiene le stanze, che a loro volta
contengono i dispositivi.

| Campo | Tipo | Descrizione |
|---|---|---|
| `apartmentId` | `string` | Identificatore univoco dell'appartamento |
| `name` | `string` | Nome dell'appartamento — visualizzato in UC30.1 |
| `isEnabled` | `boolean` | Stato di abilitazione dell'appartamento. Determina se i pulsanti Abilita (UC31) o Disabilita (UC32) sono visibili |
| `rooms` | `RoomDto[]` | Lista delle stanze dell'appartamento — UC30.3 |

---

### `RoomDto`

**File:** `room.model.ts`
**Stereotipo:** `<<DTO>>`

Rappresenta una singola stanza all'interno di un appartamento.
Corrisponde a UC30.3.1 (visualizzazione elemento elenco stanze).

| Campo | Tipo | Descrizione |
|---|---|---|
| `roomId` | `string` | Identificatore univoco della stanza |
| `name` | `string` | Nome della stanza — UC30.3.1.1 |
| `devices` | `DeviceDto[]` | Lista dei dispositivi presenti nella stanza — UC30.3.1.2 |

---

### `DeviceDto`

**File:** `device.model.ts`
**Stereotipo:** `<<DTO>>`

Rappresenta un singolo dispositivo IoT presente in una stanza.
Corrisponde a UC30.3.1.2.1 (visualizzazione elemento elenco dispositivi).
Ogni dispositivo espone nome, stato corrente e azioni eseguibili — campi
comuni a tutti i tipi di dispositivo (UC30.3.1.2.1.1, UC30.3.1.2.1.2,
UC30.3.1.2.1.3).

| Campo | Tipo | Descrizione |
|---|---|---|
| `deviceId` | `string` | Identificatore univoco del dispositivo |
| `name` | `string` | Nome del dispositivo — UC30.3.1.2.1.1 |
| `type` | `DeviceType` | Tipo del dispositivo. Determina quale card viene renderizzata in `DeviceInteractionFeature` — UC30.3.1.2.2–UC30.3.1.2.8 |
| `currentStatus` | `string` | Stato corrente del dispositivo — UC30.3.1.2.1.2 |
| `availableActions` | `DeviceAction[]` | Azioni eseguibili sul dispositivo — UC30.3.1.2.1.3 |

---

### `DeviceAction`

**File:** `device-action.model.ts`
**Stereotipo:** `<<DTO>>`

Rappresenta una singola azione eseguibile su un dispositivo.
Non contiene logica — è solo il contratto che descrive cosa può essere
fatto, con un `actionId` da inviare al backend e una `label` da mostrare
in UI.

| Campo | Tipo | Descrizione |
|---|---|---|
| `actionId` | `string` | Identificatore dell'azione, inviato al backend in `ExecuteActionDto` |
| `label` | `string` | Etichetta leggibile mostrata sul pulsante in UI — UC30.3.1.2.1.3 |

---

## 3. Enum

### `DeviceType`

**File:** `device-type.enum.ts`
**Stereotipo:** `<<enum>>`

Enumera tutti i tipi di dispositivo IoT supportati dall'applicazione.
Corrisponde alle generalizzazioni di UC30.3.1.2.1 definite nell'AdR
(UC30.3.1.2.2–UC30.3.1.2.8). Viene usato da `RoomDetailComponent`
in `DeviceInteractionFeature` per selezionare quale card renderizzare.

| Valore | UC corrispondente | Descrizione |
|---|---|---|
| `THERMOSTAT` | UC30.3.1.2.2 | Termostato |
| `FALL_SENSOR` | UC30.3.1.2.3 | Sensore di caduta |
| `PRESENCE_SENSOR` | UC30.3.1.2.4 | Sensore di presenza |
| `LIGHT` | UC30.3.1.2.5 | Punto luce |
| `ALARM_BUTTON` | UC30.3.1.2.6 | Pulsante di allarme |
| `ENTRANCE_DOOR` | UC30.3.1.2.7 | Porta di ingresso |
| `BLIND` | UC30.3.1.2.8 | Tapparella |

---

## 4. Service

### `ApartmentApiService`

**File:** `apartment-api.service.ts`
**Stereotipo:** `<<service>>`
**Scope:** `providedIn: 'root'` — singleton globale

**Responsabilità unica:** astrarre tutte le chiamate HTTP verso il backend
relative alla struttura e alla gestione degli appartamenti.
I componenti non conoscono endpoint, metodi HTTP o URL.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `http` | `HttpClient` | `private` | Client HTTP Angular iniettato via DI. Usato internamente per tutte le chiamate REST |

### Metodi

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `getApartment(apartmentId)` | `Observable<ApartmentDto>` | Chiama `GET /apartments/:id` e ritorna l'intero appartamento con stanze e dispositivi annidati. Chiamato da `ApartmentMonitorComponent` in `ngOnInit()` — UC30 |
| `enableApartment(apartmentId)` | `Observable<void>` | Chiama `PATCH /apartments/:id/enable`. Chiamato da `ApartmentMonitorComponent.onEnableApartment()` — UC31 |
| `disableApartment(apartmentId)` | `Observable<void>` | Chiama `PATCH /apartments/:id/disable`. Chiamato da `ApartmentMonitorComponent.onDisableApartment()` — UC32 |

---

## 5. Component

### `ApartmentMonitorComponent`

**File:** `apartment-monitor.component.ts`
**Stereotipo:** `<<component>>`
**UC coperti:** UC30, UC30.1, UC30.2, UC30.3, UC31, UC32

È il componente radice della feature. Coordina il caricamento dei dati
e funge da collante tra le due sorgenti dati (`ApartmentApiService` per
la struttura, `AlarmStateService` per gli allarmi in tempo reale) e i
componenti figli (`AlarmMapComponent`, `RoomListComponent`).

Non renderizza direttamente nulla di complesso — delega la visualizzazione
ai componenti figli, mantenendo la propria responsabilità sulla logica
di orchestrazione.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `apartmentApiService` | `ApartmentApiService` | `private` | Iniettato via DI. Usato per caricare la struttura dell'appartamento e per abilita/disabilita |
| `alarmStateService` | `AlarmStateService` | `private` | Iniettato via DI. Sottoscritto per ricevere in tempo reale gli allarmi attivi relativi all'appartamento |
| `apartment` | `ApartmentDto \| null` | `public` | Dati dell'appartamento caricati dal backend. `null` durante il caricamento iniziale. Passato ai componenti figli via `@Input()` |
| `activeAlarms` | `ActiveAlarm[]` | `public` | Lista degli allarmi attivi ricevuti da `AlarmStateService`. Passata ad `AlarmMapComponent` via `@Input()` |
| `isLoading` | `boolean` | `public` | Usato dal template per mostrare uno spinner durante il caricamento iniziale |

### Metodi

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `ngOnInit()` | `void` | Lifecycle hook Angular. Carica l'appartamento via `apartmentApiService.getApartment()` e si sottoscrive a `alarmStateService.getActiveAlarms$()` |
| `onEnableApartment()` | `void` | Chiamato dal template quando l'Amministratore clicca "Abilita". Chiama `apartmentApiService.enableApartment()` — UC31 |
| `onDisableApartment()` | `void` | Chiamato dal template quando l'Amministratore clicca "Disabilita". Chiama `apartmentApiService.disableApartment()` — UC32 |
| `onRoomSelected(room)` | `void` | Navigazione verso `DeviceInteractionFeature` passando il `roomId` selezionato via routing — UC30.3 |

---

### `AlarmMapComponent`

**File:** `alarm-map.component.ts`
**Stereotipo:** `<<component>>`
**UC coperti:** UC30.2

Componente presentazionale puro. Riceve la lista degli allarmi attivi
via `@Input()` e la renderizza come mappa visiva degli allarmi
dell'appartamento. Non inietta nessun service — tutta la logica di
aggiornamento è gestita dal padre `ApartmentMonitorComponent`.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `activeAlarms` | `ActiveAlarm[]` | `public` | Lista degli allarmi attivi da mostrare nella mappa. Ricevuta via `@Input()` da `ApartmentMonitorComponent` |

### Metodi

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `onAlarmSelected(alarm)` | `void` | Emette un `@Output()` verso il padre quando l'utente seleziona un allarme specifico nella mappa |

---

### `RoomListComponent`

**File:** `room-list.component.ts`
**Stereotipo:** `<<component>>`
**UC coperti:** UC30.3, UC30.3.1, UC30.3.1.1

Componente presentazionale puro. Riceve la lista delle stanze via `@Input()`
e la renderizza come elenco. Non inietta nessun service.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `rooms` | `RoomDto[]` | `public` | Lista delle stanze da visualizzare. Ricevuta via `@Input()` da `ApartmentMonitorComponent` |

### Metodi

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `onRoomSelected(room)` | `void` | Emette un `@Output()` verso il padre quando l'utente seleziona una stanza. Il padre gestisce la navigazione verso `DeviceInteractionFeature` |

---

## 6. Module

### `ApartmentMonitorModule`

**File:** `apartment-monitor.module.ts`
**Stereotipo:** `<<module>>`

NgModule Angular che impacchetta tutta la feature di monitoraggio appartamento.
Dichiara i tre componenti e importa il routing.

---

### `ApartmentMonitorRoutingModule`

**File:** `apartment-monitor-routing.module.ts`
**Stereotipo:** `<<module>>`

Definisce le route interne alla feature.

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `routes` | `Routes` | `public` | Tipicamente: `{ path: ':id', component: ApartmentMonitorComponent }` |

---

## 7. Riferimenti Esterni

Classi definite in altri diagrammi e referenziate qui per completare
il quadro delle dipendenze.

| Classe | Diagramma di origine | Ruolo in questo diagramma |
|---|---|---|
| `AlarmStateService` | `event-alarm-state-uml-v3` | Iniettato in `ApartmentMonitorComponent` per ricevere gli allarmi attivi in tempo reale — UC30.2 |
| `ActiveAlarm` | `event-alarm-state-uml-v3` | Tipo degli elementi nella lista `activeAlarms`. Passato via `@Input()` ad `AlarmMapComponent` |
| `DeviceInteractionFeature` | `device-interaction-uml` | Destinazione di navigazione quando l'utente seleziona una stanza da `RoomListComponent` |

---

## 8. Design Pattern

### Componenti Presentazionali vs Contenitore (Smart/Dumb)

`ApartmentMonitorComponent` è un **componente contenitore (smart)**: inietta
i service, gestisce lo stato, coordina i figli. `AlarmMapComponent` e
`RoomListComponent` sono **componenti presentazionali (dumb)**: ricevono
dati via `@Input()`, emettono eventi via `@Output()`, non iniettano nulla.

Questa separazione rende i componenti presentazionali facilmente testabili
e riutilizzabili in altri contesti, e concentra tutta la logica in un
solo posto.

### Composizione gerarchica dei DTO

`ApartmentDto *-- RoomDto *-- DeviceDto` è una scelta architetturale
deliberata: il backend restituisce l'intera gerarchia in un'unica chiamata.
Questo evita il problema N+1 (una chiamata per stanza, poi una per ogni
dispositivo) e semplifica la gestione dello stato nel frontend, che ha
sempre una visione completa e consistente dell'appartamento.

---

## 9. Relazioni

| Sorgente | Destinazione | Tipo | Descrizione |
|---|---|---|---|
| `ApartmentApiService` | `ApartmentDto` | `..>` dipendenza | Ritorna `ApartmentDto` come output di `getApartment()` |
| `ApartmentDto` | `RoomDto` | `*--` composizione | Un appartamento contiene le sue stanze. Le stanze non esistono fuori dal contesto di un appartamento |
| `RoomDto` | `DeviceDto` | `*--` composizione | Una stanza contiene i suoi dispositivi. I dispositivi non esistono fuori dal contesto di una stanza |
| `DeviceDto` | `DeviceType` | `-->` associazione | Il campo `type` referenzia l'enum `DeviceType` per identificare il tipo di dispositivo |
| `DeviceDto` | `DeviceAction` | `*--` composizione | Un dispositivo contiene le sue azioni eseguibili. Le azioni non hanno senso fuori dal contesto del dispositivo |
| `ApartmentMonitorComponent` | `ApartmentApiService` | `-->` dipendenza (inietta) | Iniettato via DI. Chiama `getApartment()`, `enableApartment()`, `disableApartment()` |
| `ApartmentMonitorComponent` | `AlarmStateService` | `-->` dipendenza | Si sottoscrive a `getActiveAlarms$()` per ricevere gli allarmi in tempo reale — UC30.2 |
| `ApartmentMonitorComponent` | `ApartmentDto` | `-->` dipendenza | Mantiene l'istanza corrente dell'appartamento caricata da `ApartmentApiService` |
| `ApartmentMonitorComponent` | `ActiveAlarm` | `-->` dipendenza | Mantiene la lista corrente degli allarmi attivi ricevuta da `AlarmStateService` |
| `ApartmentMonitorComponent` | `AlarmMapComponent` | `*--` composizione | Il padre contiene e istanzia il figlio nel proprio template |
| `ApartmentMonitorComponent` | `RoomListComponent` | `*--` composizione | Il padre contiene e istanzia il figlio nel proprio template |
| `ApartmentMonitorComponent` | `DeviceInteractionFeature` | `..>` dipendenza | Naviga verso la feature di interazione dispositivi quando una stanza viene selezionata |
| `AlarmMapComponent` | `ActiveAlarm` | `..>` dipendenza | Riceve e visualizza oggetti `ActiveAlarm` via `@Input()` |
| `RoomListComponent` | `RoomDto` | `..>` dipendenza | Riceve e visualizza oggetti `RoomDto` via `@Input()` |
| `ApartmentMonitorModule` | `ApartmentMonitorComponent` | `-->` dichiarazione | Angular ownership |
| `ApartmentMonitorModule` | `AlarmMapComponent` | `-->` dichiarazione | Angular ownership |
| `ApartmentMonitorModule` | `RoomListComponent` | `-->` dichiarazione | Angular ownership |
| `ApartmentMonitorModule` | `ApartmentMonitorRoutingModule` | `-->` importazione | Il modulo registra le proprie route |
| `ApartmentMonitorModule` | `ApartmentApiService` | `..>` tratteggiata | Il service è `providedIn: 'root'` — non dichiarato nel modulo ma disponibile globalmente |
