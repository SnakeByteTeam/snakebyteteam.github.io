# Spiegazione: Device Interaction Feature & Device API Service UML (v2)

Documento di riferimento per il class diagram `device-interaction-uml-v2.mermaid`,
relativo ai componenti `DeviceInteractionFeature` e `DeviceApiService`
del Frontend Angular dell'applicazione **View4Life**.

---

## Indice

1. [Panoramica Architetturale](#1-panoramica-architetturale)
2. [DTO](#2-dto)
   - [ExecuteActionDto](#executeactiondto)
3. [Enum](#3-enum)
   - [DeviceType](#devicetype)
4. [Service](#4-service)
   - [DeviceApiService](#deviceapiservice)
5. [Interfaccia — Strategy](#5-interfaccia--strategy)
   - [IDeviceCard](#idevicecard)
6. [Component](#6-component)
   - [RoomDetailComponent](#roomdetailcomponent)
   - [DeviceCardComponent](#devicecardcomponent)
   - [ThermostatCardComponent](#thermostatcardcomponent)
   - [FallSensorCardComponent](#fallsensorcardcomponent)
   - [PresenceSensorCardComponent](#presencesensorcardcomponent)
   - [LightCardComponent](#lightcardcomponent)
   - [AlarmButtonCardComponent](#alarmbuttoncardcomponent)
   - [EntranceDoorCardComponent](#entrancedoorcardcomponent)
   - [BlindCardComponent](#blindcardcomponent)
7. [Module](#7-module)
   - [DeviceInteractionModule](#deviceinteractionmodule)
   - [DeviceInteractionRoutingModule](#deviceinteractionroutingmodule)
8. [Riferimenti Esterni](#8-riferimenti-esterni)
9. [Design Pattern](#9-design-pattern)
10. [Relazioni](#10-relazioni)

---

## 1. Panoramica Architetturale

`DeviceInteractionFeature` è la schermata di dettaglio di una singola stanza
(UC30.3.1.2). Viene raggiunta tramite navigazione da `ApartmentMonitorFeature`
quando l'utente seleziona una stanza dall'elenco.

Il suo scopo è duplice: visualizzare lo stato di ogni dispositivo presente
nella stanza (UC30.3.1.2.1.1, UC30.3.1.2.1.2) e permettere all'utente
di eseguire le azioni disponibili su ciascun dispositivo (UC30.3.1.2.1.3).

La caratteristica architetturale principale è la gestione dei **sette tipi
di dispositivo eterogenei** definiti nell'AdR (UC30.3.1.2.2–UC30.3.1.2.8).
Ogni tipo ha la stessa struttura dati (`DeviceDto`) ma una resa visiva e
un set di azioni differente.

Il design applica il **Pattern Strategy** tramite l'interfaccia `IDeviceCard`:
`RoomDetailComponent` dipende esclusivamente dall'astrazione — non conosce
nessuna card concreta. Le card concrete implementano `IDeviceCard` e
costituiscono le strategie intercambiabili.

```
RoomDetailComponent (Context)
    └── *-- IDeviceCard (Abstraction)
              ..|> DeviceCardComponent        (fallback)
              ..|> ThermostatCardComponent    (THERMOSTAT)
              ..|> FallSensorCardComponent    (FALL_SENSOR)
              ..|> PresenceSensorCardComponent(PRESENCE_SENSOR)
              ..|> LightCardComponent         (LIGHT)
              ..|> AlarmButtonCardComponent   (ALARM_BUTTON)
              ..|> EntranceDoorCardComponent  (ENTRANCE_DOOR)
              ..|> BlindCardComponent         (BLIND)
```

`DeviceApiService` ha responsabilità esclusivamente di **scrittura**: invia
comandi al backend. La lettura dello stato dei dispositivi avviene già
in `ApartmentMonitorFeature` tramite `ApartmentDto`, che include `DeviceDto[]`
con `currentStatus` e `availableActions`.

---

## 2. DTO

### `ExecuteActionDto`

**File:** `execute-action.model.ts`
**Stereotipo:** `<<DTO>>`

Rappresenta il payload inviato al backend quando l'utente esegue un'azione
su un dispositivo (UC30.3.1.2.1.3). È composto da `RoomDetailComponent`
in `onActionExecuted()` a partire dal `deviceId` del dispositivo e
dall'`actionId` dell'azione selezionata dall'utente tramite la card.

| Campo | Tipo | Descrizione |
|---|---|---|
| `deviceId` | `string` | Identificatore del dispositivo su cui eseguire l'azione. Preso da `DeviceDto.deviceId` |
| `actionId` | `string` | Identificatore dell'azione da eseguire. Preso da `DeviceAction.actionId` emesso dalla card via `onActionSelected()` |

---

## 3. Enum

### `DeviceType`

**File:** `device-type.enum.ts`
**Stereotipo:** `<<enum>>`

Definito nel diagramma `apartment-monitor-uml` e referenziato qui.
Usato da `RoomDetailComponent` per selezionare a runtime quale implementazione
concreta di `IDeviceCard` istanziare per ciascun `DeviceDto` della stanza.

| Valore | UC corrispondente | Card istanziata |
|---|---|---|
| `THERMOSTAT` | UC30.3.1.2.2 | `ThermostatCardComponent` |
| `FALL_SENSOR` | UC30.3.1.2.3 | `FallSensorCardComponent` |
| `PRESENCE_SENSOR` | UC30.3.1.2.4 | `PresenceSensorCardComponent` |
| `LIGHT` | UC30.3.1.2.5 | `LightCardComponent` |
| `ALARM_BUTTON` | UC30.3.1.2.6 | `AlarmButtonCardComponent` |
| `ENTRANCE_DOOR` | UC30.3.1.2.7 | `EntranceDoorCardComponent` |
| `BLIND` | UC30.3.1.2.8 | `BlindCardComponent` |

---

## 4. Service

### `DeviceApiService`

**File:** `device-api.service.ts`
**Stereotipo:** `<<service>>`
**Scope:** `providedIn: 'root'` — singleton globale

**Responsabilità unica:** inviare comandi di azione sui dispositivi al backend.
È un service esclusivamente di scrittura — non espone metodi di lettura perché
lo stato dei dispositivi è già incluso in `ApartmentDto` e non richiede
una chiamata separata.

> Il `(?)` nel nome C4 riflette l'incertezza in fase di progettazione
> sull'effettiva necessità di questo service. Il design lo giustifica
> come layer di astrazione HTTP per i comandi, coerente con il principio
> di separazione delle responsabilità.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `http` | `HttpClient` | `private` | Client HTTP Angular iniettato via DI |

### Metodi

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `executeAction(dto)` | `Observable<void>` | Chiama `POST /devices/action` con il payload `ExecuteActionDto`. Non ritorna dati — solo conferma dell'avvenuta esecuzione. Chiamato da `RoomDetailComponent.onActionExecuted()` — UC30.3.1.2.1.3 |

---

## 5. Interfaccia — Strategy

### `IDeviceCard`

**File:** `device-card.interface.ts`
**Stereotipo:** `<<interface>>`

È il **cuore del Pattern Strategy** applicato a questa feature.
Definisce il contratto comune che tutte le card di dispositivo devono
rispettare. `RoomDetailComponent` dipende esclusivamente da questa
interfaccia — non conosce nessuna implementazione concreta.

Questo rispetta il **principio Open/Closed**: aggiungere un nuovo tipo
di dispositivo significa solo creare una nuova card che implementa
`IDeviceCard`, senza toccare `RoomDetailComponent`.

| Membro | Tipo | Descrizione |
|---|---|---|
| `device` | `DeviceDto` | Dati del dispositivo da visualizzare. Ricevuto via `@Input()` da `RoomDetailComponent`. Contiene nome (UC30.3.1.2.1.1), stato corrente (UC30.3.1.2.1.2) e azioni disponibili (UC30.3.1.2.1.3) |
| `onActionSelected(action)` | `void` | Emette via `@Output()` l'azione selezionata dall'utente verso `RoomDetailComponent`. Il padre non sa quale card specifica ha emesso — conosce solo il contratto |

---

## 6. Component

### `RoomDetailComponent`

**File:** `room-detail.component.ts`
**Stereotipo:** `<<component>>`
**Ruolo Pattern Strategy:** Context
**UC coperti:** UC30.3.1, UC30.3.1.1, UC30.3.1.2, UC30.3.1.2.1, UC30.3.1.2.1.3

È il componente radice della feature e il **Context** del Pattern Strategy.
Riceve il contesto della stanza via routing da `ApartmentMonitorComponent`,
seleziona a runtime la card corretta per ciascun dispositivo in base a
`DeviceDto.type`, e gestisce la logica di esecuzione delle azioni ricevute
dalle card tramite `IDeviceCard.onActionSelected()`.

Non dipende da nessuna card concreta — comunica esclusivamente tramite
l'interfaccia `IDeviceCard`.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `deviceApiService` | `DeviceApiService` | `private` | Iniettato via DI. Chiamato in `onActionExecuted()` per inviare il comando al backend |
| `room` | `RoomDto` | `public` | Dati della stanza ricevuti via routing da `ApartmentMonitorFeature`. Contiene nome e lista `DeviceDto[]` da cui vengono istanziate le card |
| `isLoading` | `boolean` | `public` | Usato dal template per mostrare uno spinner durante l'esecuzione di un'azione |

### Metodi

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `onActionExecuted(dto)` | `void` | Chiamato quando una card emette `onActionSelected()`. Compone un `ExecuteActionDto` e chiama `deviceApiService.executeAction()` — UC30.3.1.2.1.3 |
| `onSuccess()` | `void` | `private` — Chiamato dopo l'esecuzione riuscita. Reimposta `isLoading` a `false` e mostra feedback visivo all'utente |
| `onError(err)` | `void` | `private` — Gestisce gli errori HTTP. Reimposta `isLoading` a `false` e mostra un messaggio di errore |

---

### `DeviceCardComponent`

**File:** `device-card.component.ts`
**Stereotipo:** `<<component>>`
**Ruolo Pattern Strategy:** Strategia concreta — fallback generico
**UC coperti:** UC30.3.1.2.1, UC30.3.1.2.1.1, UC30.3.1.2.1.2, UC30.3.1.2.1.3

Implementazione generica di `IDeviceCard`. Usata come fallback quando il
`DeviceType` non corrisponde a nessuna card specializzata. Mostra nome,
stato corrente e lista azioni in forma generica. Implementa il contratto
`IDeviceCard` senza logica aggiuntiva specifica per un tipo di dispositivo.

---

### `ThermostatCardComponent`

**File:** `thermostat-card.component.ts`
**Stereotipo:** `<<component>>`
**Ruolo Pattern Strategy:** Strategia concreta
**UC coperti:** UC30.3.1.2.2

Implementazione specializzata di `IDeviceCard` per il termostato.
Oltre al contratto base, può rendere informazioni specifiche del tipo
(es. temperatura corrente, setpoint) nel layout della card.

---

### `FallSensorCardComponent`

**File:** `fall-sensor-card.component.ts`
**Stereotipo:** `<<component>>`
**Ruolo Pattern Strategy:** Strategia concreta
**UC coperti:** UC30.3.1.2.3

Implementazione specializzata di `IDeviceCard` per il sensore di caduta.

---

### `PresenceSensorCardComponent`

**File:** `presence-sensor-card.component.ts`
**Stereotipo:** `<<component>>`
**Ruolo Pattern Strategy:** Strategia concreta
**UC coperti:** UC30.3.1.2.4

Implementazione specializzata di `IDeviceCard` per il sensore di presenza.

---

### `LightCardComponent`

**File:** `light-card.component.ts`
**Stereotipo:** `<<component>>`
**Ruolo Pattern Strategy:** Strategia concreta
**UC coperti:** UC30.3.1.2.5

Implementazione specializzata di `IDeviceCard` per il punto luce.
Può rendere lo stato on/off e fornire pulsanti di accensione/spegnimento.

---

### `AlarmButtonCardComponent`

**File:** `alarm-button-card.component.ts`
**Stereotipo:** `<<component>>`
**Ruolo Pattern Strategy:** Strategia concreta
**UC coperti:** UC30.3.1.2.6

Implementazione specializzata di `IDeviceCard` per il pulsante di allarme.

---

### `EntranceDoorCardComponent`

**File:** `entrance-door-card.component.ts`
**Stereotipo:** `<<component>>`
**Ruolo Pattern Strategy:** Strategia concreta
**UC coperti:** UC30.3.1.2.7

Implementazione specializzata di `IDeviceCard` per la porta di ingresso.
Può rendere lo stato aperta/chiusa/bloccata e azioni come sblocco o apertura.

---

### `BlindCardComponent`

**File:** `blind-card.component.ts`
**Stereotipo:** `<<component>>`
**Ruolo Pattern Strategy:** Strategia concreta
**UC coperti:** UC30.3.1.2.8

Implementazione specializzata di `IDeviceCard` per la tapparella.
Può rendere lo stato aperta/chiusa/percentuale e azioni di apertura/chiusura.

---

## 7. Module

### `DeviceInteractionModule`

**File:** `device-interaction.module.ts`
**Stereotipo:** `<<module>>`

NgModule Angular che impacchetta tutta la feature. Dichiara
`RoomDetailComponent`, tutte le card concrete e importa il routing.

---

### `DeviceInteractionRoutingModule`

**File:** `device-interaction-routing.module.ts`
**Stereotipo:** `<<module>>`

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `routes` | `Routes` | `public` | Tipicamente: `{ path: ':roomId', component: RoomDetailComponent }` |

---

## 8. Riferimenti Esterni

Classi definite nel diagramma `apartment-monitor-uml` e referenziate
qui perché `DeviceInteractionFeature` le riceve come input via routing.

| Classe | Diagramma di origine | Ruolo in questo diagramma |
|---|---|---|
| `RoomDto` | `apartment-monitor-uml` | Ricevuto da `RoomDetailComponent` via routing. Contiene nome e lista `DeviceDto[]` da renderizzare |
| `DeviceDto` | `apartment-monitor-uml` | Passato via `@Input()` alle card tramite il contratto `IDeviceCard` |
| `DeviceAction` | `apartment-monitor-uml` | Emessa via `@Output()` dalle card tramite `IDeviceCard.onActionSelected()` |
| `DeviceType` | `apartment-monitor-uml` | Usato da `RoomDetailComponent` per selezionare quale strategia concreta istanziare |

---

## 9. Design Pattern

### Pattern Strategy tramite `IDeviceCard`

Il problema da risolvere è: come gestire sette tipi di dispositivo con
renderizzazione diversa senza `*ngIf` a cascata nel template di
`RoomDetailComponent` e senza accoppiamento diretto con ogni card?

La soluzione è il **Pattern Strategy**:

| Ruolo Strategy | Classe |
|---|---|
| Context | `RoomDetailComponent` |
| Strategy (astrazione) | `IDeviceCard` |
| Concrete Strategy | `DeviceCardComponent`, `ThermostatCardComponent`, … |

`RoomDetailComponent` conosce solo `IDeviceCard`. A runtime, seleziona
la strategia concreta in base a `DeviceDto.type` e la istanzia nel
template con Angular `*ngComponentOutlet` o direttive strutturali.

La modellazione tramite interfaccia riduce drasticamente le relazioni nel
diagramma: da oltre 20 frecce incrociate (ogni card collegata direttamente
a `RoomDetailComponent`, `DeviceDto` e `DeviceAction`) a tre gruppi netti:

- `RoomDetailComponent *-- IDeviceCard` — il context contiene l'astrazione
- `IDeviceCard --> DeviceDto` e `IDeviceCard ..> DeviceAction` — il contratto
- `ConcreteCard ..|> IDeviceCard` — le implementazioni realizzano l'interfaccia

Questo rispetta il **principio Open/Closed**: aggiungere un nuovo tipo di
dispositivo richiede solo una nuova card che implementa `IDeviceCard`,
senza nessuna modifica a `RoomDetailComponent`.

### Separazione lettura/scrittura (Command Query Separation)

`DeviceApiService` espone solo `executeAction()` — nessun metodo di lettura.
La lettura dello stato dei dispositivi avviene in `ApartmentMonitorFeature`
tramite `ApartmentApiService.getApartment()`, che restituisce l'intera
gerarchia inclusi i `DeviceDto` con `currentStatus`.

Questo rispetta il principio **CQS (Command Query Separation)**: comandi
e query passano per service e endpoint distinti, con responsabilità nette.

---

## 10. Relazioni

| Sorgente | Destinazione | Tipo | Descrizione |
|---|---|---|---|
| `DeviceApiService` | `ExecuteActionDto` | `..>` dipendenza | Accetta `ExecuteActionDto` come parametro di `executeAction()` |
| `RoomDetailComponent` | `DeviceApiService` | `-->` dipendenza (inietta) | Iniettato via DI. Chiama `executeAction()` in `onActionExecuted()` |
| `RoomDetailComponent` | `RoomDto` | `-->` dipendenza | Riceve `RoomDto` come input via routing da `ApartmentMonitorFeature` |
| `RoomDetailComponent` | `ExecuteActionDto` | `..>` dipendenza | Compone `ExecuteActionDto` in `onActionExecuted()` a partire da `deviceId` e `actionId` |
| `RoomDetailComponent` | `DeviceType` | `..>` dipendenza | Usa l'enum per selezionare quale strategia concreta istanziare a runtime |
| `RoomDetailComponent` | `IDeviceCard` | `*--` composizione | Il context contiene l'astrazione. Dipende solo da `IDeviceCard`, mai dalle card concrete |
| `IDeviceCard` | `DeviceDto` | `-->` dipendenza | Il contratto espone `device : DeviceDto` come `@Input()` — UC30.3.1.2.1.1, UC30.3.1.2.1.2 |
| `IDeviceCard` | `DeviceAction` | `..>` dipendenza | Il contratto espone `onActionSelected()` che emette `DeviceAction` via `@Output()` — UC30.3.1.2.1.3 |
| `DeviceCardComponent` | `IDeviceCard` | `..|>` realizzazione | Implementa il contratto come card generica di fallback |
| `ThermostatCardComponent` | `IDeviceCard` | `..|>` realizzazione | Implementa il contratto per `THERMOSTAT` — UC30.3.1.2.2 |
| `FallSensorCardComponent` | `IDeviceCard` | `..|>` realizzazione | Implementa il contratto per `FALL_SENSOR` — UC30.3.1.2.3 |
| `PresenceSensorCardComponent` | `IDeviceCard` | `..|>` realizzazione | Implementa il contratto per `PRESENCE_SENSOR` — UC30.3.1.2.4 |
| `LightCardComponent` | `IDeviceCard` | `..|>` realizzazione | Implementa il contratto per `LIGHT` — UC30.3.1.2.5 |
| `AlarmButtonCardComponent` | `IDeviceCard` | `..|>` realizzazione | Implementa il contratto per `ALARM_BUTTON` — UC30.3.1.2.6 |
| `EntranceDoorCardComponent` | `IDeviceCard` | `..|>` realizzazione | Implementa il contratto per `ENTRANCE_DOOR` — UC30.3.1.2.7 |
| `BlindCardComponent` | `IDeviceCard` | `..|>` realizzazione | Implementa il contratto per `BLIND` — UC30.3.1.2.8 |
| `DeviceInteractionModule` | `RoomDetailComponent` | `-->` dichiarazione | Angular ownership |
| `DeviceInteractionModule` | `DeviceCardComponent` | `-->` dichiarazione | Angular ownership |
| `DeviceInteractionModule` | `ThermostatCardComponent` | `-->` dichiarazione | Angular ownership |
| `DeviceInteractionModule` | `FallSensorCardComponent` | `-->` dichiarazione | Angular ownership |
| `DeviceInteractionModule` | `PresenceSensorCardComponent` | `-->` dichiarazione | Angular ownership |
| `DeviceInteractionModule` | `LightCardComponent` | `-->` dichiarazione | Angular ownership |
| `DeviceInteractionModule` | `AlarmButtonCardComponent` | `-->` dichiarazione | Angular ownership |
| `DeviceInteractionModule` | `EntranceDoorCardComponent` | `-->` dichiarazione | Angular ownership |
| `DeviceInteractionModule` | `BlindCardComponent` | `-->` dichiarazione | Angular ownership |
| `DeviceInteractionModule` | `DeviceInteractionRoutingModule` | `-->` importazione | Il modulo registra le proprie route |
| `DeviceInteractionModule` | `DeviceApiService` | `..>` tratteggiata | Il service è `providedIn: 'root'` — non dichiarato nel modulo ma disponibile globalmente |
