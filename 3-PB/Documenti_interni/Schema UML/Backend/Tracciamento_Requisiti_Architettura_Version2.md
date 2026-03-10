# Tracciamento Requisiti – Architettura View4Life

## Indice

1. [Introduzione](#1-introduzione)
2. [Legenda](#2-legenda)
3. [Modulo Autenticazione (Auth)](#3-modulo-autenticazione-auth)
4. [Modulo Gestione Utenti (User Management)](#4-modulo-gestione-utenti-user-management)
5. [Modulo Gestione Reparti (Ward Management)](#5-modulo-gestione-reparti-ward-management)
6. [Modulo Account MyVimar (PlantAuth)](#6-modulo-account-myvimar-plantauth)
7. [Modulo Dispositivi (Device)](#7-modulo-dispositivi-device)
8. [Modulo Dashboard](#8-modulo-dashboard)
9. [Modulo Visualizzazione Analytics](#9-modulo-visualizzazione-analytics)
10. [Modulo Appartamento](#10-modulo-appartamento)
11. [Modulo Gestione Allarmi (Alarm)](#11-modulo-gestione-allarmi-alarm)
12. [Modulo Notifiche e Allarmi Attivi](#12-modulo-notifiche-e-allarmi-attivi)
13. [Modulo Webhook / Ingest Timeseries](#13-modulo-webhook--ingest-timeseries)
14. [Riepilogo Copertura](#14-riepilogo-copertura)
15. [Requisiti Non Coperti](#15-requisiti-non-coperti)

---

## 1. Introduzione

Il presente documento traccia i requisiti funzionali individuati nel documento
*Analisi dei Requisiti v2.0.0* rispetto alle classi e ai componenti presenti nei
diagrammi UML di architettura prodotti dal team:

| Diagramma | Contenuto principale |
|---|---|
| `Livello_4View4Life.svg` | Device, Analytics, Webhook, PlantAuth, Timeseries |
| `Main.svg` | Auth (login, token), User Management (CRUD utenti) |
| `ward.svg` | Ward Management (CRUD reparti, assegnazioni OS/Plant) |
| `allarmi.svg` | **Alarm Management (CRUD allarmi configurati)** |
| `notifiche.svg` | Notification, Active Alarm, CheckThreshold, WebSocket, WebPush |

---

## 2. Legenda

| Simbolo | Significato |
|---------|-------------|
| ✅ | Requisito pienamente coperto da uno o più componenti |
| ⚠️ | Requisito parzialmente coperto (manca parte della catena o del flusso) |
| ❌ | Requisito non coperto da alcun componente nei diagrammi |

---

## 3. Modulo Autenticazione (Auth)

**Diagramma di riferimento:** `Main.svg`

### Componenti

| Componente | Tipo | Responsabilità |
|---|---|---|
| `AuthController` | Controller | Endpoint `+login()` |
| `GenerateTokenUseCase` | Use Case (interfaccia) | `+generate(req: GenerateTokenCmd)` |
| `GenerateTokenService` | Service | Implementazione di `GenerateTokenUseCase` |
| `LoginUserUseCase` | Use Case (interfaccia) | `+check(req: CheckCredentialsCmd)` |
| `LoginUserService` | Service | Implementazione di `LoginUserUseCase` |
| `CheckCredentialsCmd` | Comando | Contiene username e password |
| `GenerateTokenCmd` | Comando | Dati per generazione token |

### Tracciamento Requisiti

| UC | Nome | Stato | Componente(i) | Note |
|----|------|-------|---------------|------|
| UC1 | Autenticazione | ✅ | `AuthController.login()` → `LoginUserUseCase.check()` → `GenerateTokenUseCase.generate()` | Flusso completo: verifica credenziali + generazione token JWT |
| UC1.1 | Inserimento username | ✅ | `CheckCredentialsCmd.username` | Campo contenuto nel comando |
| UC1.2 | Inserimento password | ✅ | `CheckCredentialsCmd.password` | Campo contenuto nel comando |
| UC2 | Autenticazione con cambio password | ❌ | — | Nessun `ChangePasswordUseCase` presente |
| UC2.1 | Inserimento username (cambio pwd) | ❌ | — | Dipende da UC2 |
| UC2.2 | Inserimento password temporanea | ❌ | — | Dipende da UC2 |
| UC2.3 | Inserimento nuova password | ❌ | — | Dipende da UC2 |
| UC40 | Errore username non registrato o password errata | ✅ | `LoginUserUseCase.check()` | Eccezione sollevata quando le credenziali non corrispondono |
| UC41 | Errore password temporanea errata | ❌ | — | Dipende da UC2 |
| UC42 | Errore nuova password = password temporanea | ❌ | — | Dipende da UC2 |
| UC43 | Errore nuova password non valida | ❌ | — | Dipende da UC2 |

---

## 4. Modulo Gestione Utenti (User Management)

**Diagramma di riferimento:** `Main.svg`

### Componenti

| Componente | Tipo | Responsabilità |
|---|---|---|
| `UserController` | Controller | `+findAll()`, `+create(CreateUserDto)`, `+update(UpdateUserDto)`, `+delete()` |
| `FindAllUserUseCase` | Use Case (interfaccia) | `+findAll(): User` |
| `FindAllUserService` | Service | Implementazione di `FindAllUserUseCase` |
| `FindAllUserPort` | Port (interfaccia) | `+findAll(): User` |
| `FindAllUserAdapter` | Adapter | Implementazione di `FindAllUserPort` |
| `CreateUserUseCase` | Use Case (interfaccia) | `+create(req: CreateUserCmd)` |
| `CreateUserService` | Service | Implementazione di `CreateUserUseCase` |
| `CreateUserPort` | Port (interfaccia) | `+create(req: CreateUserCmd)` |
| `CreateUserAdapter` | Adapter | Implementazione di `CreateUserPort` |
| `UserRepository` | Port (interfaccia) | `+findAll()`, `+create()`, `+update()`, `+delete()` |
| `InMemoryUserRepository` | Adapter | Implementazione di `UserRepository` |
| `User` | Domain Entity | `username`, `name`, `surname`, `role` + getters |
| `CreateUserDto` | DTO | `name`, `surname`, `username` |
| `CreateUserCmd` | Comando | `username`, `surname`, `name`, `role` |

### Tracciamento Requisiti

| UC | Nome | Stato | Componente(i) | Note |
|----|------|-------|---------------|------|
| UC6 | Visualizzazione elenco utenti OS | ✅ | `UserController.findAll()` → `FindAllUserUseCase` → `FindAllUserPort` → `FindAllUserAdapter` → `UserRepository.findAll()` | Catena esagonale completa |
| UC6.1 | Visualizzazione singolo utente | ✅ | `User` (entity) | Ogni `User` ha tutte le informazioni |
| UC6.1.1 | Visualizzazione nome utente | ✅ | `User.getName()` | |
| UC6.1.2 | Visualizzazione cognome utente | ✅ | `User.getSurname()` | |
| UC6.1.3 | Visualizzazione username utente | ✅ | `User.getUsername()` | |
| UC7 | Creazione nuovo utente OS | ✅ | `UserController.create(CreateUserDto)` → `CreateUserUseCase` → `CreateUserPort` → `CreateUserAdapter` → `UserRepository.create()` | Catena esagonale completa |
| UC7.1 | Inserimento nome | ✅ | `CreateUserDto.name` / `CreateUserCmd.name` | |
| UC7.2 | Inserimento cognome | ✅ | `CreateUserDto.surname` / `CreateUserCmd.surname` | |
| UC7.3 | Inserimento username | ✅ | `CreateUserDto.username` / `CreateUserCmd.username` | |
| UC7.4 | Generazione password temporanea | ❌ | — | `CreateUserCmd` non include un campo per password temporanea; nessun `GenerateTemporaryPasswordUseCase` |
| UC8 | Eliminazione utente OS | ⚠️ | `UserController.delete()` → `UserRepository.delete(username)` | Il controller e il repository hanno il metodo, ma mancano `DeleteUserUseCase`, `DeleteUserPort`, `DeleteUserAdapter` nella catena esagonale |
| UC44 | Errore username già in uso | ⚠️ | `CreateUserService` (implicito) | La validazione di unicità non è esplicitata nel diagramma, ma sarebbe logicamente in `CreateUserService` |

---

## 5. Modulo Gestione Reparti (Ward Management)

**Diagramma di riferimento:** `ward.svg`

### Componenti

| Componente | Tipo | Responsabilità |
|---|---|---|
| `WardController` | Controller | CRUD reparti + gestione assegnazioni |
| `GetWardUseCase` | Use Case (interfaccia) | `+getWardById(wardId): Ward` |
| `CDWardUseCase` | Use Case (interfaccia) | `+createWard(w: Ward): void`, `+deleteWard(wardId): void` |
| `WardUserUseCase` | Use Case (interfaccia) | `+addUserToWard(wardId, userId)`, `+removeUserFromWard(wardId, userId)` |
| `WardPlantUseCase` | Use Case (interfaccia) | `+addPlantToWard(wardId, plantId)`, `+removePlantFromWard(wardId, plantId)` |
| `WardService` | Service | Implementa `GetWardUseCase` e `CDWardUseCase` |
| `WardRelationshipService` | Service | Implementa `WardUserUseCase` e `WardPlantUseCase` |
| `GetWardPort` | Port (interfaccia) | `+getWardById(wardId): Ward` |
| `GetWardAdapter` | Adapter | Implementa `GetWardPort`; metodo `-toDomain(Any): Ward` |
| `CDWardPort` | Port (interfaccia) | `+createWard(w: Ward)`, `+removeWard(wardId)` |
| `CDWardAdapter` | Adapter | Implementa `CDWardPort` |
| `WardUserPort` | Port (interfaccia) | `+addUserToWard()`, `+removeUserFromWard()` |
| `WardUserAdapter` | Adapter | Implementa `WardUserPort` |
| `WardPlantPort` | Port (interfaccia) | `+addPlantToWard()`, `+removePlantFromWard()` |
| `WardPlantAdapter` | Adapter | Implementa `WardPlantPort` |
| `GetWardRepositoryPort` | Repository Port | `+getWardById(wardId): Any` |
| `CDWardRepositoryPort` | Repository Port | `+createWard(w: Ward)`, `+removeWard(wardId)` |
| `WardUserRepositoryPort` | Repository Port | `+addUserToWard()`, `+removeUserFromWard()` |
| `WardPlantRepositoryPort` | Repository Port | `+addPlantToWard()`, `+removePlantFromWard()` |
| `WardRepositoryImpl` | Repository Impl | Implementa tutti i Repository Port |
| `Ward` | Domain Entity | Entità reparto |
| `WardDto` | DTO | `+fromDomain(Ward): WardDto`, `+toDomain(WardDto): Ward` |
| `RequestDto` | DTO | `WardId`, `UserId | null`, `PlantId | null` |

### Tracciamento Requisiti

| UC | Nome | Stato | Componente(i) | Note |
|----|------|-------|---------------|------|
| UC9 | Visualizzazione elenco reparti | ⚠️ | `WardController.getWardById()` → `GetWardUseCase` → `GetWardPort` → `GetWardAdapter` → `GetWardRepositoryPort` → `WardRepositoryImpl` | Presente `getWardById` ma manca `getAllWards()` per la lista completa |
| UC10 | Creazione reparto | ✅ | `WardController.createWard(WardDto)` → `CDWardUseCase.createWard(Ward)` → `CDWardPort` → `CDWardAdapter` → `CDWardRepositoryPort` → `WardRepositoryImpl` | Catena esagonale completa |
| UC11 | Modifica nome reparto | ❌ | — | Nessun metodo `updateWard()` nel controller né negli Use Cases |
| UC12 | Eliminazione reparto | ✅ | `WardController.deleteWard(wardId)` → `CDWardUseCase.deleteWard(wardId)` → `CDWardPort.removeWard()` → `CDWardAdapter` → `CDWardRepositoryPort.removeWard()` → `WardRepositoryImpl` | Catena esagonale completa |
| UC13 | Aggiunta assegnazione OS - reparto | ✅ | `WardController.addUserToWard(RequestDto)` → `WardUserUseCase.addUserToWard(wardId, userId)` → `WardUserPort` → `WardUserAdapter` → `WardUserRepositoryPort` → `WardRepositoryImpl` | Catena esagonale completa |
| UC14 | Rimozione assegnazione OS - reparto | ✅ | `WardController.removeUserFromWard(RequestDto)` → `WardUserUseCase.removeUserFromWard(wardId, userId)` → `WardUserPort` → `WardUserAdapter` → `WardUserRepositoryPort` → `WardRepositoryImpl` | Catena esagonale completa |
| UC15 | Aggiunta assegnazione appartamento - reparto | ✅ | `WardController.addPlantToWard(RequestDto)` → `WardPlantUseCase.addPlantToWard(wardId, plantId)` → `WardPlantPort` → `WardPlantAdapter` → `WardPlantRepositoryPort` → `WardRepositoryImpl` | Catena esagonale completa |
| UC16 | Rimozione assegnazione appartamento - reparto | ✅ | `WardController.removePlantFromWard(RequestDto)` → `WardPlantUseCase.removePlantFromWard(wardId, plantId)` → `WardPlantPort` → `WardPlantAdapter` → `WardPlantRepositoryPort` → `WardRepositoryImpl` | Catena esagonale completa |
| UC45 | Errore nome reparto già in uso | ⚠️ | `WardService` (implicito) | Validazione di unicità del nome non esplicitata nel diagramma |

---

## 6. Modulo Account MyVimar (PlantAuth)

**Diagramma di riferimento:** `Livello_4View4Life.svg`

### Componenti

| Componente | Tipo | Responsabilità |
|---|---|---|
| `PlantAuthController` | Controller | `+Login(): GET → 302 Redirect`, `+callback(): GET → void` |
| `PlantAuthUseCase` | Use Case (interfaccia) | `+auth(): string`, `+callback(code: string): void` |
| `PlantAuthService` | Service | Implementa `PlantAuthUseCase` |
| `GetValidTokenUseCase` | Use Case (interfaccia) | `+getValidToken(): Promise<string \| null>` |
| `TokenRepoPort` | Port (interfaccia) | `+setTokens(tokens: TokenPair): void` |
| `TokenCacheRepoAdapter` | Adapter | Implementa `TokenRepoPort`; `-tokens: TokenPair` |
| `PostgresCacheDatabase` | Library | Persistenza cache token |
| `TokenPair` | Domain Value Object | `accessToken`, `refreshToken`, `expiresAt` + `isExpired()`, `getAccessToken()`, `getRefreshToken()` |

### Tracciamento Requisiti

| UC | Nome | Stato | Componente(i) | Note |
|----|------|-------|---------------|------|
| UC3 | Visualizzazione account MyVimar collegato | ⚠️ | `PlantAuthController` | Il controller gestisce il flusso OAuth ma non c'è un endpoint esplicito per "visualizzare" l'account collegato |
| UC4 | Collegamento account MyVimar | ✅ | `PlantAuthController.Login()` → redirect a Vimar → `PlantAuthController.callback()` → `PlantAuthUseCase.callback(code)` → `PlantAuthService` �� `TokenRepoPort.setTokens()` → `TokenCacheRepoAdapter` → `PostgresCacheDatabase` | Flusso OAuth2 completo |
| UC5 | Rimozione account MyVimar | ⚠️ | — | Non c'è un metodo esplicito `removeAccount()` o `revokeTokens()` nel diagramma |

---

## 7. Modulo Dispositivi (Device)

**Diagramma di riferimento:** `Livello_4View4Life.svg`

### Componenti

| Componente | Tipo | Responsabilità |
|---|---|---|
| `DeviceController` | Controller | `+Get(plantId): DeviceDto*`, `+Get(plantId, Id): DeviceDto`, `+Get(plantId, datapointId): DeviceDto` |
| `FindDeviceByIdUseCase` | Use Case (interfaccia) | `+findById(plantId, id): Device` |
| `FindDeviceByPlantIdUseCase` | Use Case (interfaccia) | `+findByPlantId(plantId): Device*` |
| `FindDeviceByDatapointIdUseCase` | Use Case (interfaccia) | `+findByDatapointId(plantId, datapointId): Device` |
| `FindDeviceService` | Service | Implementa i tre Use Cases |
| `FindDevicePort` | Port (interfaccia) | `+findById(id)`, `+findByPlantId(plantId)`, `+findByDatapointId(plantId, datapointId)` |
| `DevicePersistenceAdapter` | Adapter | Implementa `FindDevicePort`; `-toDomain(raw: any): Device` |
| `DeviceApiPort` | Port (interfaccia) | `+getDatapointValue(plantId, deviceId, datapointId): string` |
| `DeviceApiPortAdapter` | Adapter | Implementa `DeviceApiPort` |
| `DeviceRepositoryPort` | Port (interfaccia) | `+query(params: string): Any` |
| `DeviceRepositoryImpl` | Repository Impl | Implementa `DeviceRepositoryPort`; `-cache: Pool` |
| `HttpService` | Library | Comunicazione HTTP con API Vimar |
| `Device` | Domain Entity | Entità dispositivo |
| `DeviceDto` | DTO | `+fromDomain(Device): DeviceDto` |

### Tracciamento Requisiti

| UC | Nome | Stato | Componente(i) | Note |
|----|------|-------|---------------|------|
| UC28 | Visualizzazione appartamento (lista dispositivi) | ✅ | `DeviceController.Get(plantId)` → `FindDeviceByPlantIdUseCase` → `FindDeviceService` → `FindDevicePort.findByPlantId()` → `DevicePersistenceAdapter` → `DeviceRepositoryPort` → `DeviceRepositoryImpl` | Restituisce tutti i dispositivi di un impianto |
| UC28 (dettaglio) | Visualizzazione singolo dispositivo | ✅ | `DeviceController.Get(plantId, Id)` → `FindDeviceByIdUseCase` → `FindDeviceService` → `FindDevicePort.findById()` → `DevicePersistenceAdapter` | |
| UC28 (per datapoint) | Ricerca dispositivo per datapoint | ✅ | `DeviceController.Get(plantId, datapointId)` → `FindDeviceByDatapointIdUseCase` → `FindDeviceService` → `FindDevicePort.findByDatapointId()` → `DevicePersistenceAdapter` | Usato internamente per associare dati webhook ai dispositivi |

---

## 8. Modulo Dashboard

**Diagramma di riferimento:** Nessuno

### Tracciamento Requisiti

| UC | Nome | Stato | Componente(i) | Note |
|----|------|-------|---------------|------|
| UC17 | Visualizzazione Dashboard | ❌ | — | Nessun `DashboardController` presente nei diagrammi |

---

## 9. Modulo Visualizzazione Analytics

**Diagramma di riferimento:** `Livello_4View4Life.svg`

### Componenti

| Componente | Tipo | Responsabilità |
|---|---|---|
| `AnalyticsController` | Controller | `+getAnalytics(metric: string): PlotDto` |
| `AnalyticsUseCase` | Use Case (interfaccia) | `+getAnalytics(metric, id): Plot` |
| `AnalyticsService` | Service | `+strategies: map<string, AnalyticsStrategy>`, `+genSugg: GenerateSuggestionUseCase` |
| `AnalyticsStrategy` | Abstract Strategy | `-dataPort: GetDataPort`, `+execute(id: string): Plot` |
| `ResolvedAlarmAnalytics` | Strategy concreta | Analitiche allarmi risolti per reparto |
| `AlarmsFrequencyAnalytics` | Strategy concreta | Frequenza allarmi per reparto/giorno |
| `ConsumptionAnalytics` | Strategy concreta | Consumi energetici per impianto |
| `PlantAnomaliesAnalytics` | Strategy concreta | Anomalie impianto |
| `PresenceAnalytics` | Strategy concreta | Presenza per singolo sensore |
| `LongPresenceAnalytics` | Strategy concreta | Presenza prolungata per sensore + tempo |
| `TemperatureAnalytics` | Strategy concreta | Temperatura per singolo termostato |
| `FallsAnalytics` | Strategy concreta | Cadute per singolo reparto |
| `GetDataPort` | Port (interfaccia) | `+getDataByDatapointId(datapointId, startDate)`, `+getDataByWardId(wardId, startDate)` |
| `GetTimeseriesDataAdapter` | Adapter | Implementa `GetDataPort`; `+toMap(any)` |
| `ReadTimeseriesRepositoryPort` | Port (interfaccia) | `+query(params): any` |
| `TimeseriesRepositoryImpl` | Repository Impl | `-timescaledb: Pool` |
| `PlotDto` | DTO | `title`, `metric`, `labels`, `data` + `fromDomain(Plot)` |
| `Plot` | Domain Entity | Entità grafico |

### Tracciamento Requisiti

| UC | Nome | Stato | Componente(i) | Note |
|----|------|-------|---------------|------|
| UC27 | Visualizzazione analytics | ✅ | `AnalyticsController.getAnalytics(metric)` → `AnalyticsUseCase` → `AnalyticsService` → `AnalyticsStrategy.execute(id)` → `GetDataPort` → `GetTimeseriesDataAdapter` → `ReadTimeseriesRepositoryPort` → `TimeseriesRepositoryImpl` | Pattern Strategy per gestire le diverse metriche |
| UC27 (allarmi risolti) | Analitiche allarmi risolti per reparto | ✅ | `ResolvedAlarmAnalytics` | Confronto allarmi inviati vs risolti |
| UC27 (frequenza allarmi) | Frequenza allarmi per reparto/giorno | ✅ | `AlarmsFrequencyAnalytics` | |
| UC27 (consumi) | Consumi energetici per impianto | ✅ | `ConsumptionAnalytics` | Somma consumi dispositivi dell'impianto |
| UC27 (anomalie) | Anomalie impianto | ✅ | `PlantAnomaliesAnalytics` | Rilevazione disconnessioni |
| UC27 (presenza) | Presenza per sensore | ✅ | `PresenceAnalytics` | |
| UC27 (presenza prolungata) | Presenza prolungata per sensore + tempo | ✅ | `LongPresenceAnalytics` | |
| UC27 (temperatura) | Temperatura per termostato | ✅ | `TemperatureAnalytics` | |
| UC27 (cadute) | Cadute per reparto | ✅ | `FallsAnalytics` | |
| UC27 (consigli) | Consigli per ridurre i consumi | ✅ | `AnalyticsService.genSugg: GenerateSuggestionUseCase` | Consigli per singolo dispositivo basati sui consumi |

---

## 10. Modulo Appartamento

**Diagramma di riferimento:** Nessuno

### Tracciamento Requisiti

| UC | Nome | Stato | Componente(i) | Note |
|----|------|-------|---------------|------|
| UC29 | Abilita appartamento | ❌ | — | Nessun endpoint di abilitazione/disabilitazione presente |
| UC30 | Disabilita appartamento | ❌ | — | Nessun endpoint di abilitazione/disabilitazione presente |

---

## 11. Modulo Gestione Allarmi (Alarm)

**Diagramma di riferimento:** `allarmi.svg`

### Componenti

| Componente | Tipo | Responsabilità |
|---|---|---|
| `AlarmController` | Controller | `+getAlarms(RequestDto): GET → AlarmDto*`, `+createAlarm(alarm: AlarmDto): POST → void`, `+updateAlarm(alarm: AlarmDto): PUT → void`, `+deleteAlarm(alarmId: string): DELETE → void` |
| `AlarmDto` | DTO | `+fromDomain(a: Alarm): AlarmDto`, `+toDomain(a: AlarmDto): Alarm` |
| `AlarmService` | Service | Implementa tutti gli Use Cases relativi agli allarmi |
| `GetAlarmsUseCase` | Use Case (interfaccia) | `+getAlarms(cmd: GetAlarmCmd): Promise<Alarm*>` |
| `CreateAlarmUseCase` | Use Case (interfaccia) | `+createAlarm(a: Alarm): void` |
| `UpdateAlarmUseCase` | Use Case (interfaccia) | `+updateAlarm(a: Alarm): void` |
| `DeleteAlarmUseCase` | Use Case (interfaccia) | `+deleteAlarm(alarmId: string): void` |
| `GetAlarmsPort` | Port (interfaccia) | `+findAllByPlantId(plantId: string): Promise<Alarm*>`, `+findAllByWardId(wardId: string): Promise<Alarm*>` |
| `CreateAlarmPort` | Port (interfaccia) | `+create(a: Alarm): void` |
| `UpdateAlarmPort` | Port (interfaccia) | `+update(a: Alarm): void` |
| `DeleteAlarmPort` | Port (interfaccia) | `+delete(alarmId: string): void` |
| `GetAlarmsAdapter` | Adapter | Implementa `GetAlarmsPort`; `-toDomain(Any): Alarm` |
| `CreateAlarmAdapter` | Adapter | Implementa `CreateAlarmPort` |
| `UpdateAlarmAdapter` | Adapter | Implementa `UpdateAlarmPort` |
| `DeleteAlarmAdapter` | Adapter | Implementa `DeleteAlarmPort` |
| `GetAlarmRepositoryPort` | Repository Port | `+findAllByPlantId(plantId): Any`, `+findAllByWardId(wardId): Any` |
| `CreateAlarmRepositoryPort` | Repository Port | `+create(a: Alarm): void` |
| `UpdateAlarmRepositoryPort` | Repository Port | `+update(a: Alarm): void` |
| `DeleteAlarmRepositoryPort` | Repository Port | `+delete(alarmId: string): void` |
| `AlarmRepositoryImpl` | Repository Impl | `-db: Pool`; implementa tutti i Repository Port |
| `Alarm` | Domain Entity | Entità allarme configurato (contiene tipo sensore, priorità, soglia, orario attivazione/disattivazione, stato abilitato/disabilitato) |

### Flusso architetturale

```
[GET allarmi]
AlarmController.getAlarms(RequestDto)
  → GetAlarmsUseCase.getAlarms(GetAlarmCmd)
    → AlarmService
      → GetAlarmsPort.findAllByPlantId()/findAllByWardId()
        → GetAlarmsAdapter → GetAlarmRepositoryPort → AlarmRepositoryImpl
  ← AlarmDto.fromDomain(Alarm) ← risposta

[POST crea allarme]
AlarmController.createAlarm(AlarmDto)
  → AlarmDto.toDomain() → Alarm
  → CreateAlarmUseCase.createAlarm(Alarm)
    → AlarmService
      → CreateAlarmPort.create(Alarm)
        → CreateAlarmAdapter → CreateAlarmRepositoryPort → AlarmRepositoryImpl

[PUT aggiorna allarme]
AlarmController.updateAlarm(AlarmDto)
  → AlarmDto.toDomain() → Alarm
  → UpdateAlarmUseCase.updateAlarm(Alarm)
    → AlarmService
      → UpdateAlarmPort.update(Alarm)
        → UpdateAlarmAdapter → UpdateAlarmRepositoryPort → AlarmRepositoryImpl

[DELETE elimina allarme]
AlarmController.deleteAlarm(alarmId)
  → DeleteAlarmUseCase.deleteAlarm(alarmId)
    → AlarmService
      → DeleteAlarmPort.delete(alarmId)
        → DeleteAlarmAdapter → DeleteAlarmRepositoryPort → AlarmRepositoryImpl
```

### Tracciamento Requisiti

| UC | Nome | Stato | Componente(i) | Note |
|----|------|-------|---------------|------|
| UC31 | Aggiunta allarme | ✅ | `AlarmController.createAlarm(AlarmDto)` → `AlarmDto.toDomain()` → `CreateAlarmUseCase.createAlarm(Alarm)` → `AlarmService` → `CreateAlarmPort.create()` → `CreateAlarmAdapter` → `CreateAlarmRepositoryPort` → `AlarmRepositoryImpl` | Catena esagonale completa. L'`AlarmDto` contiene tutti i campi (tipo sensore, priorità, soglia, orari) necessari alla creazione |
| UC31.1 | Selezione sensore | ✅ | `AlarmDto` / `Alarm` (campo sensore/datapointId) | Il campo sensore è parte dell'entità Alarm trasportata da AlarmDto |
| UC31.2 | Selezione livello priorità | ✅ | `AlarmDto` / `Alarm` (campo priorità) | Il campo priorità è parte dell'entità Alarm |
| UC31.3 | Selezione soglia intervento | ✅ | `AlarmDto` / `Alarm` (campo soglia) | Il campo soglia è parte dell'entità Alarm |
| UC31.4 | Impostazione orario attivazione | ✅ | `AlarmDto` / `Alarm` (campo orario attivazione) | Il campo orario di attivazione è parte dell'entità Alarm |
| UC31.5 | Impostazione orario disattivazione | ✅ | `AlarmDto` / `Alarm` (campo orario disattivazione) | Il campo orario di disattivazione è parte dell'entità Alarm |
| UC32 | Modifica priorità allarme | ✅ | `AlarmController.updateAlarm(AlarmDto)` → `UpdateAlarmUseCase.updateAlarm(Alarm)` → `AlarmService` → `UpdateAlarmPort.update()` → `UpdateAlarmAdapter` → `UpdateAlarmRepositoryPort` → `AlarmRepositoryImpl` | Update generico dell'allarme, il campo priorità viene modificato nell'`AlarmDto` e propagato |
| UC33 | Modifica soglia intervento allarme | ✅ | `AlarmController.updateAlarm(AlarmDto)` → stessa catena di UC32 | Il campo soglia è parte dell'`Alarm` aggiornato |
| UC34 | Modifica orario attivazione allarme | ✅ | `AlarmController.updateAlarm(AlarmDto)` → stessa catena di UC32 | Il campo orario attivazione è parte dell'`Alarm` aggiornato |
| UC35 | Modifica orario disattivazione allarme | ✅ | `AlarmController.updateAlarm(AlarmDto)` → stessa catena di UC32 | Il campo orario disattivazione è parte dell'`Alarm` aggiornato |
| UC36 | Abilita allarme | ✅ | `AlarmController.updateAlarm(AlarmDto)` → stessa catena di UC32 | Lo stato abilitato/disabilitato è un campo dell'`Alarm` aggiornato tramite PUT |
| UC37 | Disabilita allarme | ✅ | `AlarmController.updateAlarm(AlarmDto)` → stessa catena di UC32 | Lo stato abilitato/disabilitato è un campo dell'`Alarm` aggiornato tramite PUT |
| UC38 | Elimina allarme | ✅ | `AlarmController.deleteAlarm(alarmId)` → `DeleteAlarmUseCase.deleteAlarm(alarmId)` → `AlarmService` → `DeleteAlarmPort.delete()` → `DeleteAlarmAdapter` → `DeleteAlarmRepositoryPort` → `AlarmRepositoryImpl` | Catena esagonale completa |
| UC46 | Errore nessun sensore selezionato | ⚠️ | `AlarmService` (validazione implicita) | L'`AlarmService` dovrebbe validare che il sensore sia presente prima di creare l'allarme; non esplicitato nel diagramma ma la logica è nel Service |
| UC47 | Errore nessun livello di priorità selezionato | ⚠️ | `AlarmService` (validazione implicita) | Stessa logica: validazione campi obbligatori nel Service |
| UC48 | Errore nessuna soglia selezionata | ⚠️ | `AlarmService` (validazione implicita) | Stessa logica: validazione campi obbligatori nel Service |

---

## 12. Modulo Notifiche e Allarmi Attivi

**Diagramma di riferimento:** `notifiche.svg`

### Componenti

| Componente | Tipo | Responsabilità |
|---|---|---|
| `CheckThresholdUseCase` | Use Case (interfaccia) | `+check(deviceId: string, state: string): boolean` |
| `CheckThresholdService` | Service | Implementa `CheckThresholdUseCase`; verifica se il valore supera la soglia |
| `NotificationUseCase` | Use Case (interfaccia) | `+handle(notification: DeviceStateChangeDto): void` |
| `NotificationService` | Service | Implementa `NotificationUseCase`; orchestra creazione allarme attivo + invio notifiche |
| `ActiveAlarmWritePort` | Port (interfaccia) | `+createActiveAlarm(device: DeviceStateChangeDto): Alarm` |
| `ActiveAlarmWriteAdapter` | Adapter | Implementa `ActiveAlarmWritePort` |
| `ActiveAlarmRepositoryPort` | Repository Port (interfaccia) | Persistenza allarmi attivi |
| `ActiveAlarmRepositoryImpl` | Repository Impl | Implementa `ActiveAlarmRepositoryPort` |
| `WardUserPort` | Port (interfaccia) | Trova utenti del reparto da notificare (riusato dal modulo Ward) |
| `WebSocketPort` | Port (interfaccia) | Invio notifica in tempo reale via WebSocket |
| `WebPushNotificationPort` | Port (interfaccia) | Invio push notification al browser/device |
| `DeviceStateChangeDto` | DTO | Cambio di stato del dispositivo ricevuto dal webhook |

### Flusso architetturale

```
Webhook → CheckThresholdUseCase.check(deviceId, state)
  └─ se true → NotificationUseCase.handle(DeviceStateChangeDto)
       ├─ ActiveAlarmWritePort.createActiveAlarm() → DB
       ├─ WardUserPort → trova utenti del reparto
       ├─ WebSocketPort → notifica real-time
       └─ WebPushNotificationPort → push notification
```

### Tracciamento Requisiti

| UC | Nome | Stato | Componente(i) | Note |
|----|------|-------|---------------|------|
| UC39 | Visualizzazione notifiche | ✅ | `WebSocketPort` (real-time) + `WebPushNotificationPort` (push) | Le notifiche vengono inviate automaticamente agli OS del reparto |
| (Infra) | Creazione allarme attivo automatico | ✅ | `ActiveAlarmWritePort.createActiveAlarm()` → `ActiveAlarmWriteAdapter` → `ActiveAlarmRepositoryImpl` | Allarme creato quando soglia superata |
| (Infra) | Verifica soglia dispositivo | ✅ | `CheckThresholdUseCase.check()` → `CheckThresholdService` | |
| (Infra) | Identificazione utenti da notificare | ✅ | `WardUserPort` (riuso modulo Ward) | Trova gli OS assegnati al reparto dell'appartamento |

---

## 13. Modulo Webhook / Ingest Timeseries

**Diagramma di riferimento:** `Livello_4View4Life.svg`

### Componenti

| Componente | Tipo | Responsabilità |
|---|---|---|
| `WebhookController` | Controller | `+onDatapointUpdate(body: webhookDto): POST → void`, `-verifySignature(requestBody, secret): boolean` |
| `IngestTimeseriesUseCase` | Use Case (interfaccia) | `+ingest(data: webhookDto): Promise<void>` |
| `IngestTimeseriesService` | Service | Implementa `IngestTimeseriesUseCase` |
| `TimeseriesWritePort` | Port (interfaccia) | `+write(data: TimeseriesDto): Promise<void>` |
| `TimeseriesRepositoryImpl` | Repository Impl | `-timescaledb: Pool` |
| `WebhookDto` | DTO (interfaccia) | `data[].id`, `data[].type`, `data[].attributes.value/timestamp`, `data[].links.self` |
| `TimeseriesDto` | DTO (interfaccia) | `datapointId`, `value`, `timestamp` |

### Flusso architetturale

```
Vimar Cloud → WebhookController.onDatapointUpdate(webhookDto)
  ├─ verifySignature() → valida la firma del webhook
  └─ IngestTimeseriesUseCase.ingest(webhookDto)
       └─ TimeseriesWritePort.write(TimeseriesDto) → TimescaleDB
```

### Tracciamento Requisiti

| UC | Nome | Stato | Componente(i) | Note |
|----|------|-------|---------------|------|
| (Infra) | Ricezione dati sensori in tempo reale | ✅ | `WebhookController.onDatapointUpdate()` | Endpoint per ricevere aggiornamenti datapoint da Vimar |
| (Infra) | Persistenza dati time-series | ✅ | `IngestTimeseriesUseCase` → `TimeseriesWritePort` → `TimeseriesRepositoryImpl` | Salvataggio in TimescaleDB |
| (Infra) | Validazione webhook | ✅ | `WebhookController.verifySignature()` | Verifica firma per sicurezza |

---

## 14. Riepilogo Copertura

### Tabella riassuntiva per Use Case

| UC | Nome | Stato |
|----|------|-------|
| UC1 | Autenticazione | ✅ |
| UC1.1 | Inserimento username | ✅ |
| UC1.2 | Inserimento password | ✅ |
| UC2 | Autenticazione con cambio password | ❌ |
| UC2.1 | Inserimento username (cambio pwd) | ❌ |
| UC2.2 | Inserimento password temporanea | ❌ |
| UC2.3 | Inserimento nuova password | ❌ |
| UC3 | Visualizzazione account MyVimar | ⚠️ |
| UC4 | Collegamento account MyVimar | ✅ |
| UC5 | Rimozione account MyVimar | ⚠️ |
| UC6 | Visualizzazione elenco utenti | ✅ |
| UC6.1 | Visualizzazione singolo utente | ✅ |
| UC6.1.1 | Visualizzazione nome | ✅ |
| UC6.1.2 | Visualizzazione cognome | ✅ |
| UC6.1.3 | Visualizzazione username | ✅ |
| UC7 | Creazione nuovo utente OS | ✅ |
| UC7.1 | Inserimento nome | ✅ |
| UC7.2 | Inserimento cognome | ✅ |
| UC7.3 | Inserimento username | ✅ |
| UC7.4 | Generazione password temporanea | ❌ |
| UC8 | Eliminazione utente OS | ⚠️ |
| UC9 | Visualizzazione elenco reparti | ⚠️ |
| UC10 | Creazione reparto | ✅ |
| UC11 | Modifica nome reparto | ❌ |
| UC12 | Eliminazione reparto | ✅ |
| UC13 | Aggiunta assegnazione OS - reparto | ✅ |
| UC14 | Rimozione assegnazione OS - reparto | ✅ |
| UC15 | Aggiunta assegnazione appartamento - reparto | ✅ |
| UC16 | Rimozione assegnazione appartamento - reparto | ✅ |
| UC17 | Visualizzazione Dashboard | ❌ |
| UC27 | Visualizzazione analytics | ✅ |
| UC28 | Visualizzazione appartamento (dispositivi) | ✅ |
| UC29 | Abilita appartamento | ❌ |
| UC30 | Disabilita appartamento | ❌ |
| UC31 | Aggiunta allarme | ✅ |
| UC32 | Modifica priorità allarme | ✅ |
| UC33 | Modifica soglia intervento allarme | ✅ |
| UC34 | Modifica orario attivazione allarme | ✅ |
| UC35 | Modifica orario disattivazione allarme | ✅ |
| UC36 | Abilita allarme | ✅ |
| UC37 | Disabilita allarme | ✅ |
| UC38 | Elimina allarme | ✅ |
| UC39 | Visualizzazione notifiche | ✅ |
| UC40 | Errore username/password errata | ✅ |
| UC41 | Errore password temporanea errata | ❌ |
| UC42 | Errore nuova password = temporanea | ❌ |
| UC43 | Errore nuova password non valida | ❌ |
| UC44 | Errore username già in uso | ⚠️ |
| UC45 | Errore nome reparto già in uso | ⚠️ |
| UC46 | Errore nessun sensore selezionato | ⚠️ |
| UC47 | Errore nessun livello priorità | ⚠️ |
| UC48 | Errore nessuna soglia selezionata | ⚠️ |

### Statistiche

| Stato | Conteggio | Percentuale |
|-------|-----------|-------------|
| ✅ Coperto | 32 | **65%** |
| ⚠️ Parziale | 9 | **18%** |
| ❌ Non coperto | 8 | **16%** |
| **Totale** | **49** | **100%** |

---

## 15. Requisiti Non Coperti

### Requisiti mancanti (da aggiungere ai diagrammi)

| Priorità | UC | Descrizione | Modulo suggerito | Componenti suggeriti |
|----------|-----|-------------|-----------------|---------------------|
| 🔴 Alta | UC2, UC2.1-2.3, UC41-43 | Autenticazione con cambio password (primo accesso) | Auth | `ChangePasswordUseCase`, `ChangePasswordPort`, `ChangePasswordCmd`, `PasswordValidationService` |
| 🟡 Media | UC17 | Visualizzazione Dashboard | Dashboard | `DashboardController`, `GetDashboardUseCase`, `DashboardConfigPort` |
| 🟡 Media | UC29, UC30 | Abilita/Disabilita appartamento | Apartment | `ApartmentController.enable()/.disable()` oppure estensione di `DeviceController` |
| 🟡 Media | UC11 | Modifica nome reparto | Ward | Aggiungere `updateWard(wardId, newName)` a `WardController` e `CDWardUseCase` |
| 🟢 Bassa | UC7.4 | Generazione password temporanea | User | Estendere `CreateUserUseCase` con generazione password + invio credenziali |
| 🟢 Bassa | UC8 | Eliminazione utente (catena completa) | User | Aggiungere `DeleteUserUseCase`, `DeleteUserPort`, `DeleteUserAdapter` |
| 🟢 Bassa | UC9 | Lista tutti i reparti | Ward | Aggiungere `getAllWards()` a `WardController` e `GetWardUseCase` |