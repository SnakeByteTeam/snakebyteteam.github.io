# Spiegazione: Analytics Feature & Analytics API Service UML (v2)

Documento di riferimento per il class diagram `analytics-uml-v2.mermaid`,
relativo ai componenti `AnalyticsFeature` e `AnalyticsApiService`
del Frontend Angular dell'applicazione **View4Life**.

---

## Indice

1. [Panoramica Architetturale](#1-panoramica-architetturale)
2. [DTO](#2-dto)
   - [AnalyticsDto](#analyticsdto)
   - [ChartDataDto](#chartdatadto)
   - [ChartDatasetDto](#chartdatasetdto)
   - [EnergySavingSuggestionDto](#energysavingsuggestiondto)
3. [Service](#3-service)
   - [AnalyticsApiService](#analyticsapiservice)
4. [Interfaccia](#4-interfaccia)
   - [IChartComponent](#ichartcomponent)
5. [Component](#5-component)
   - [AnalyticsComponent](#analyticscomponent)
   - [EnergySavingListComponent](#energysavinglistcomponent)
   - [EnergyConsumptionChartComponent](#energyconsumptionchartcomponent)
   - [PlantAnomaliesChartComponent](#plantanomalieschartcomponent)
   - [PresenceDetectionChartComponent](#presencedetectionchartcomponent)
   - [ProlongedPresenceChartComponent](#prolongedpresencechartcomponent)
   - [TemperatureVariationsChartComponent](#temperaturevariationschartcomponent)
   - [AlarmsSentResolvedChartComponent](#alarmssentresolvedchartcomponent)
   - [AlarmFrequencyChartComponent](#alarmfrequencychartcomponent)
   - [FallFrequencyChartComponent](#fallfrequencychartcomponent)
6. [Module](#6-module)
   - [AnalyticsModule](#analyticsmodule)
   - [AnalyticsRoutingModule](#analyticsroutingmodule)
7. [Riferimenti Esterni](#7-riferimenti-esterni)
8. [Design Pattern](#8-design-pattern)
9. [Relazioni](#9-relazioni)

---

## 1. Panoramica Architetturale

`AnalyticsFeature` è la sezione dedicata alle statistiche dell'applicazione
(UC29). L'utente seleziona un appartamento e visualizza i dati aggregati
degli ultimi 30 giorni, composti da nove moduli: un elenco di suggerimenti
per il risparmio energetico (UC29.1) e otto grafici su consumo, anomalie,
presenze, cadute, temperatura e allarmi (UC29.2–UC29.9).

Il C4 descrive esplicitamente che `AnalyticsApiService` riceve payload
JSON **già pre-elaborati** dal backend — il quale a sua volta aggrega
i dati di telemetria da TimescaleDB/InfluxDB. Questo implica
un'unica chiamata HTTP per tutta la pagina, non una per grafico.

La caratteristica architetturale centrale è la gestione degli **otto
componenti grafici con contratto identico**. Tutti ricevono un `ChartDataDto`
via `@Input()` e non hanno altra responsabilità. L'interfaccia `IChartComponent`
astrae questo contratto comune, riducendo drasticamente le relazioni nel
diagramma e rendendo il design aperto all'aggiunta di nuovi grafici.

```
AnalyticsComponent (smart container)
    ├── *-- EnergySavingListComponent          (lista suggerimenti — UC29.1)
    └── *-- IChartComponent (abstraction)
              ..|> EnergyConsumptionChartComponent     (UC29.2)
              ..|> PlantAnomaliesChartComponent         (UC29.3)
              ..|> PresenceDetectionChartComponent      (UC29.4)
              ..|> ProlongedPresenceChartComponent      (UC29.5)
              ..|> TemperatureVariationsChartComponent  (UC29.6)
              ..|> AlarmsSentResolvedChartComponent     (UC29.7)
              ..|> AlarmFrequencyChartComponent         (UC29.8)
              ..|> FallFrequencyChartComponent          (UC29.9)
```

---

## 2. DTO

I DTO di questa feature modellano la risposta HTTP pre-aggregata dal backend.
La struttura è gerarchica: `AnalyticsDto` è il DTO radice che contiene
tutte le slice di dati necessarie per popolare l'intera pagina in un'unica
chiamata GET.

### `AnalyticsDto`

**File:** `analytics.model.ts`
**Stereotipo:** `<<DTO>>`

DTO radice restituito da `AnalyticsApiService.getAnalytics()`.
Contiene tutte le slice di dati necessarie per popolare la pagina UC29:
i suggerimenti energetici e un campo `ChartDataDto` per ciascuno degli
otto grafici. `AnalyticsComponent` lo riceve e distribuisce le singole
slice ai componenti figli via `@Input()`.

| Campo | Tipo | Descrizione |
|---|---|---|
| `apartmentId` | `string` | Identificatore dell'appartamento a cui si riferiscono i dati |
| `suggestions` | `EnergySavingSuggestionDto[]` | Elenco dei suggerimenti per il risparmio energetico — UC29.1 |
| `energyConsumption` | `ChartDataDto` | Dati per il grafico sul consumo energetico — UC29.2 |
| `plantAnomalies` | `ChartDataDto` | Dati per il grafico sulle anomalie dell'impianto — UC29.3 |
| `presenceDetection` | `ChartDataDto` | Dati per il grafico sul rilevamento di presenza — UC29.4 |
| `prolongedPresence` | `ChartDataDto` | Dati per il grafico sulla presenza prolungata — UC29.5 |
| `temperatureVariations` | `ChartDataDto` | Dati per il grafico sulle variazioni di temperatura — UC29.6 |
| `alarmsSentAndResolved` | `ChartDataDto` | Dati per il grafico sugli allarmi inviati e risolti — UC29.7 |
| `alarmFrequency` | `ChartDataDto` | Dati per il grafico sulla frequenza degli allarmi — UC29.8 |
| `fallFrequency` | `ChartDataDto` | Dati per il grafico sulla frequenza delle cadute — UC29.9 |

---

### `ChartDataDto`

**File:** `chart-data.model.ts`
**Stereotipo:** `<<DTO>>`

Struttura dati condivisa da tutti gli otto grafici. Modella una serie
storica nel formato standard delle librerie grafiche (es. Chart.js):
etichette sull'asse X e uno o più dataset con i valori corrispondenti.

Essere un DTO condiviso è una scelta deliberata: tutti gli UC da UC29.2
a UC29.9 producono grafici con la stessa struttura. Creare un DTO distinto
per ogni grafico sarebbe over-engineering — il tipo di grafico è un dettaglio
di rendering, non di struttura dati.

| Campo | Tipo | Descrizione |
|---|---|---|
| `labels` | `string[]` | Etichette dell'asse X (es. date, ore, nomi di stanze) |
| `datasets` | `ChartDatasetDto[]` | Uno o più dataset da renderizzare nel grafico |

---

### `ChartDatasetDto`

**File:** `chart-dataset.model.ts`
**Stereotipo:** `<<DTO>>`

Rappresenta una singola serie di dati all'interno di un grafico.
Un `ChartDataDto` può contenerne più di uno (es. grafico con più linee).

| Campo | Tipo | Descrizione |
|---|---|---|
| `label` | `string` | Nome della serie, mostrato nella legenda del grafico |
| `data` | `number[]` | Valori numerici della serie, in corrispondenza uno-a-uno con `ChartDataDto.labels` |

---

### `EnergySavingSuggestionDto`

**File:** `energy-saving-suggestion.model.ts`
**Stereotipo:** `<<DTO>>`

Rappresenta un singolo suggerimento per il risparmio energetico.
Corrisponde a UC29.1.1 (visualizzazione elemento elenco suggerimenti).

| Campo | Tipo | Descrizione |
|---|---|---|
| `suggestionId` | `string` | Identificatore univoco del suggerimento |
| `description` | `string` | Testo del suggerimento mostrato in lista — UC29.1.1 |

---

## 3. Service

### `AnalyticsApiService`

**File:** `analytics-api.service.ts`
**Stereotipo:** `<<service>>`
**Scope:** `providedIn: 'root'` — singleton globale

**Responsabilità unica:** astrarre le chiamate HTTP GET verso il backend
per recuperare i dati analytics aggregati. Riceve payload già pre-elaborati
dal backend — non esegue nessuna trasformazione dei dati.

Viene consumato sia da `AnalyticsFeature` (UC29) sia da `DashboardFeature`
per i widget clima, consumi, presenze e statistiche allarmi (UC17.2,
UC17.4, UC17.5, UC17.6).

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `http` | `HttpClient` | `private` | Client HTTP Angular iniettato via DI |

### Metodi

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `getAnalytics(apartmentId)` | `Observable<AnalyticsDto>` | Chiama `GET /analytics/:apartmentId` e ritorna l'intero `AnalyticsDto` con tutti i dati aggregati degli ultimi 30 giorni. Chiamato da `AnalyticsComponent.ngOnInit()` — UC29 |

---

## 4. Interfaccia

### `IChartComponent`

**File:** `chart-component.interface.ts`
**Stereotipo:** `<<interface>>`

Definisce il contratto comune a tutti gli otto componenti grafici della
feature. `AnalyticsComponent` dipende esclusivamente da questa astrazione
per contenere i grafici — non conosce nessuna implementazione concreta.

La motivazione è identica a quella di `IDeviceCard` in `DeviceInteractionFeature`:
senza questa interfaccia il diagramma avrebbe 8 frecce duplicate verso
`ChartDataDto` e 8 frecce duplicate da `AnalyticsComponent` verso ogni
grafico concreto. Con l'interfaccia le relazioni si riducono a tre gruppi
netti.

Rispetta il **principio Open/Closed**: aggiungere un nuovo grafico richiede
solo un nuovo componente che implementa `IChartComponent`, senza modificare
`AnalyticsComponent`.

| Membro | Tipo | Descrizione |
|---|---|---|
| `chartData` | `ChartDataDto` | Dati del grafico da renderizzare. Ricevuto via `@Input()` da `AnalyticsComponent` |

---

## 5. Component

### `AnalyticsComponent`

**File:** `analytics.component.ts`
**Stereotipo:** `<<component>>`
**UC coperti:** UC29, UC29.1–UC29.9

È il componente radice della feature e il **container smart**. Carica
l'intero `AnalyticsDto` in `ngOnInit()` e distribuisce le singole slice
ai componenti figli via `@Input()`. Non renderizza direttamente nessun
grafico — delega tutto ai componenti figli.

Dipende da `IChartComponent` per i grafici e direttamente da
`EnergySavingListComponent` per i suggerimenti, che ha un contratto
diverso e non rientra nell'interfaccia comune.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `analyticsApiService` | `AnalyticsApiService` | `private` | Iniettato via DI. Chiamato in `ngOnInit()` per caricare i dati |
| `analytics` | `AnalyticsDto \| null` | `public` | Dati analytics caricati dal backend. `null` durante il caricamento iniziale. Le sue slice vengono passate ai figli via `@Input()` |
| `isLoading` | `boolean` | `public` | Usato dal template per mostrare uno spinner durante il caricamento iniziale |

### Metodi

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `ngOnInit()` | `void` | Lifecycle hook Angular. Recupera l'`apartmentId` dai parametri di routing e chiama `analyticsApiService.getAnalytics()` per popolare `analytics` |

---

### `EnergySavingListComponent`

**File:** `energy-saving-list.component.ts`
**Stereotipo:** `<<component>>`
**UC coperti:** UC29.1, UC29.1.1

Componente presentazionale puro. Riceve la lista dei suggerimenti energetici
via `@Input()` e la renderizza come elenco. Non implementa `IChartComponent`
perché il suo contratto è strutturalmente diverso: riceve
`EnergySavingSuggestionDto[]`, non `ChartDataDto`.

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `suggestions` | `EnergySavingSuggestionDto[]` | `public` | Lista dei suggerimenti ricevuta via `@Input()` da `AnalyticsComponent` |

---

### `EnergyConsumptionChartComponent`

**File:** `energy-consumption-chart.component.ts`
**Stereotipo:** `<<component>>`
**Implementa:** `IChartComponent`
**UC coperti:** UC29.2

Implementazione concreta di `IChartComponent` per il grafico del consumo
energetico dell'illuminazione. Riceve `chartData` via `@Input()` e lo
renderizza tramite la libreria grafica pre-esistente concordata con la
Proponente.

---

### `PlantAnomaliesChartComponent`

**File:** `plant-anomalies-chart.component.ts`
**Stereotipo:** `<<component>>`
**Implementa:** `IChartComponent`
**UC coperti:** UC29.3

Implementazione concreta di `IChartComponent` per il grafico delle
anomalie dell'impianto.

---

### `PresenceDetectionChartComponent`

**File:** `presence-detection-chart.component.ts`
**Stereotipo:** `<<component>>`
**Implementa:** `IChartComponent`
**UC coperti:** UC29.4

Implementazione concreta di `IChartComponent` per il grafico del
rilevamento di presenza, assenza e caduta.

---

### `ProlongedPresenceChartComponent`

**File:** `prolonged-presence-chart.component.ts`
**Stereotipo:** `<<component>>`
**Implementa:** `IChartComponent`
**UC coperti:** UC29.5

Implementazione concreta di `IChartComponent` per il grafico della
presenza prolungata nello stesso ambiente.

---

### `TemperatureVariationsChartComponent`

**File:** `temperature-variations-chart.component.ts`
**Stereotipo:** `<<component>>`
**Implementa:** `IChartComponent`
**UC coperti:** UC29.6

Implementazione concreta di `IChartComponent` per il grafico delle
variazioni e cambi di temperatura.

---

### `AlarmsSentResolvedChartComponent`

**File:** `alarms-sent-resolved-chart.component.ts`
**Stereotipo:** `<<component>>`
**Implementa:** `IChartComponent`
**UC coperti:** UC29.7

Implementazione concreta di `IChartComponent` per il grafico degli
allarmi inviati e risolti per giorno dagli operatori sanitari.

---

### `AlarmFrequencyChartComponent`

**File:** `alarm-frequency-chart.component.ts`
**Stereotipo:** `<<component>>`
**Implementa:** `IChartComponent`
**UC coperti:** UC29.8

Implementazione concreta di `IChartComponent` per il grafico della
frequenza degli allarmi rilevati.

---

### `FallFrequencyChartComponent`

**File:** `fall-frequency-chart.component.ts`
**Stereotipo:** `<<component>>`
**Implementa:** `IChartComponent`
**UC coperti:** UC29.9

Implementazione concreta di `IChartComponent` per il grafico della
frequenza delle cadute rilevate.

---

## 6. Module

### `AnalyticsModule`

**File:** `analytics.module.ts`
**Stereotipo:** `<<module>>`

NgModule Angular che impacchetta tutta la feature analytics. Dichiara
`AnalyticsComponent`, `EnergySavingListComponent` e tutte le otto
implementazioni concrete di `IChartComponent`.

---

### `AnalyticsRoutingModule`

**File:** `analytics-routing.module.ts`
**Stereotipo:** `<<module>>`

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `routes` | `Routes` | `public` | Tipicamente: `{ path: ':apartmentId', component: AnalyticsComponent }` |

---

## 7. Riferimenti Esterni

| Classe | Diagramma di origine | Ruolo in questo diagramma |
|---|---|---|
| `DashboardFeature` | `dashboard-uml` (da progettare) | Consumer esterno di `AnalyticsApiService`. La Dashboard lo usa per popolare i widget clima, consumi, presenze e statistiche allarmi — UC17.2, UC17.4, UC17.5, UC17.6 |

---

## 8. Design Pattern

### Interfaccia comune `IChartComponent`

Il problema da risolvere è: come gestire otto componenti grafici con
lo stesso contratto senza duplicare 8 × 2 = 16 frecce nel diagramma
(ognuno collegato ad `AnalyticsComponent` e a `ChartDataDto`)?

La soluzione è la stessa adottata per `IDeviceCard` in `DeviceInteractionFeature`:
un'interfaccia che astrae il contratto comune. I benefici sono identici:

| Senza interfaccia | Con `IChartComponent` |
|---|---|
| 8 frecce `AnalyticsComponent → ChartComponent` | 1 freccia `AnalyticsComponent *-- IChartComponent` |
| 8 frecce `ChartComponent → ChartDataDto` | 1 freccia `IChartComponent --> ChartDataDto` |
| 16 frecce totali | 2 frecce totali + 8 realizzazioni `..|>` |

Rispetta il **principio Open/Closed**: aggiungere un nuovo grafico richiede
solo un nuovo componente che implementa `IChartComponent`. `AnalyticsComponent`
non va mai modificato.

### `EnergySavingListComponent` fuori dall'interfaccia

`EnergySavingListComponent` non implementa `IChartComponent` perché il
suo contratto è semanticamente diverso: riceve `EnergySavingSuggestionDto[]`,
non `ChartDataDto`. Forzarlo nell'interfaccia solo per uniformità visiva
sarebbe una violazione del **principio di segregazione delle interfacce
(ISP)**: le interfacce devono riflettere contratti reali, non convenzioni
estetiche.

### Smart/Dumb Components

`AnalyticsComponent` è il **container smart**: inietta il service, carica
i dati, distribuisce le slice di `AnalyticsDto`. Tutti i componenti figli
sono **presentazionali (dumb)**: ricevono dati via `@Input()`, non iniettano
nulla, sono testabili in isolamento con qualsiasi `ChartDataDto` di test.

### Unica chiamata HTTP per tutta la pagina

`AnalyticsApiService` espone un solo metodo `getAnalytics(apartmentId)`.
Il backend pre-aggrega tutti i dati in un'unica risposta. Questo evita
il problema N+1 (una chiamata per grafico) e semplifica la gestione
dello stato nel frontend: `AnalyticsComponent` ha sempre una visione
completa e consistente dei dati.

---

## 9. Relazioni

| Sorgente | Destinazione | Tipo | Descrizione |
|---|---|---|---|
| `AnalyticsApiService` | `AnalyticsDto` | `..>` dipendenza | Ritorna `AnalyticsDto` come output di `getAnalytics()` |
| `AnalyticsDto` | `EnergySavingSuggestionDto` | `*--` composizione | L'`AnalyticsDto` contiene la lista dei suggerimenti energetici |
| `AnalyticsDto` | `ChartDataDto` | `*--` composizione | L'`AnalyticsDto` contiene una slice `ChartDataDto` per ciascuno degli otto grafici |
| `ChartDataDto` | `ChartDatasetDto` | `*--` composizione | Un `ChartDataDto` contiene uno o più dataset |
| `IChartComponent` | `ChartDataDto` | `-->` dipendenza | Il contratto espone `chartData : ChartDataDto` come `@Input()` |
| `EnergyConsumptionChartComponent` | `IChartComponent` | `..|>` realizzazione | Implementa il contratto per UC29.2 |
| `PlantAnomaliesChartComponent` | `IChartComponent` | `..|>` realizzazione | Implementa il contratto per UC29.3 |
| `PresenceDetectionChartComponent` | `IChartComponent` | `..|>` realizzazione | Implementa il contratto per UC29.4 |
| `ProlongedPresenceChartComponent` | `IChartComponent` | `..|>` realizzazione | Implementa il contratto per UC29.5 |
| `TemperatureVariationsChartComponent` | `IChartComponent` | `..|>` realizzazione | Implementa il contratto per UC29.6 |
| `AlarmsSentResolvedChartComponent` | `IChartComponent` | `..|>` realizzazione | Implementa il contratto per UC29.7 |
| `AlarmFrequencyChartComponent` | `IChartComponent` | `..|>` realizzazione | Implementa il contratto per UC29.8 |
| `FallFrequencyChartComponent` | `IChartComponent` | `..|>` realizzazione | Implementa il contratto per UC29.9 |
| `AnalyticsComponent` | `AnalyticsApiService` | `-->` dipendenza (inietta) | Iniettato via DI. Chiama `getAnalytics()` in `ngOnInit()` |
| `AnalyticsComponent` | `AnalyticsDto` | `-->` dipendenza | Mantiene l'istanza corrente di `AnalyticsDto` e ne distribuisce le slice ai figli |
| `AnalyticsComponent` | `EnergySavingListComponent` | `*--` composizione | Contiene e istanzia il componente lista nel proprio template — UC29.1 |
| `AnalyticsComponent` | `IChartComponent` | `*--` composizione | Contiene le implementazioni grafiche tramite l'astrazione. Non dipende da nessuna card concreta |
| `EnergySavingListComponent` | `EnergySavingSuggestionDto` | `..>` dipendenza | Riceve e visualizza `EnergySavingSuggestionDto[]` via `@Input()` — UC29.1.1 |
| `DashboardFeature` | `AnalyticsApiService` | `..>` dipendenza | Consumer esterno. Usa `getAnalytics()` per popolare i widget clima, consumi, presenze e statistiche nella Dashboard — UC17.2, UC17.4, UC17.5, UC17.6 |
| `AnalyticsModule` | `AnalyticsComponent` | `-->` dichiarazione | Angular ownership |
| `AnalyticsModule` | `EnergySavingListComponent` | `-->` dichiarazione | Angular ownership |
| `AnalyticsModule` | `EnergyConsumptionChartComponent` | `-->` dichiarazione | Angular ownership |
| `AnalyticsModule` | `PlantAnomaliesChartComponent` | `-->` dichiarazione | Angular ownership |
| `AnalyticsModule` | `PresenceDetectionChartComponent` | `-->` dichiarazione | Angular ownership |
| `AnalyticsModule` | `ProlongedPresenceChartComponent` | `-->` dichiarazione | Angular ownership |
| `AnalyticsModule` | `TemperatureVariationsChartComponent` | `-->` dichiarazione | Angular ownership |
| `AnalyticsModule` | `AlarmsSentResolvedChartComponent` | `-->` dichiarazione | Angular ownership |
| `AnalyticsModule` | `AlarmFrequencyChartComponent` | `-->` dichiarazione | Angular ownership |
| `AnalyticsModule` | `FallFrequencyChartComponent` | `-->` dichiarazione | Angular ownership |
| `AnalyticsModule` | `AnalyticsRoutingModule` | `-->` importazione | Il modulo registra le proprie route |
| `AnalyticsModule` | `AnalyticsApiService` | `..>` tratteggiata | Il service è `providedIn: 'root'` — non dichiarato nel modulo ma disponibile globalmente |
