# Spiegazione Auth UML v7

Documento di riferimento per il class diagram `auth-uml-v7.mermaid`,
relativo ai componenti Angular `UserAuthenticationFeature` e `InternalAuthService`
del Frontend dell'applicazione **View4Life**.

---

## Indice

1. [DTO](#1-dto)
   - [UserSession](#usersession)
2. [Enum](#2-enum)
   - [UserRole](#userrole)
   - [AuthErrorType](#autherrortype)
3. [Service](#3-service)
   - [InternalAuthService](#internalauthorservice)
4. [Guard](#4-guard)
   - [AuthGuard](#authguard)
   - [RoleGuard](#roleguard)
5. [Interceptor](#5-interceptor)
   - [AuthInterceptor](#authinterceptor)
6. [Classe Astratta](#6-classe-astratta)
   - [AuthBaseComponent](#authbasecomponent)
7. [Component](#7-component)
   - [LoginComponent](#logincomponent)
   - [FirstAccessComponent](#firstaccesscomponent)
8. [Module](#8-module)
   - [UserAuthenticationModule](#userauthenticationmodule)
   - [AuthRoutingModule](#authroutingmodule)
9. [Relazioni](#9-relazioni)

---

## 1. DTO

### `UserSession`

**File:** `user-session.model.ts`
**Stereotipo:** `<<DTO>>` (Data Transfer Object)

Descrive la **forma dei dati** restituiti dal backend dopo un login riuscito.
Non ha stato proprio né logica — è solo un contratto che definisce quali campi
ci si aspetta nella risposta HTTP. In TypeScript si implementa come `interface`.

| Campo | Tipo | Descrizione |
|---|---|---|
| `userId` | `string` | Identificatore univoco dell'utente nel database |
| `username` | `string` | Username dell'utente |
| `role` | `UserRole` | Ruolo dell'utente (Amministratore o Operatore Sanitario) |
| `token` | `string` | Il JWT generato dal backend da usare nelle richieste successive |
| `isFirstAccess` | `boolean` | Se `true`, l'utente deve completare il cambio password (UC2) |

> I campi non hanno modificatori di visibilità (`+`/`-`) perché un'interfaccia
> TypeScript non ha incapsulamento — tutti i campi sono pubblici per definizione.

---

## 2. Enum

### `UserRole`

**File:** `user-role.enum.ts`
**Stereotipo:** `<<enum>>`

Evita l'uso di stringhe magiche (`"admin"`, `"operator"`) in tutto il codice.
È usato da `InternalAuthService`, `RoleGuard` e nei template Angular per
mostrare/nascondere elementi in base al ruolo.

| Valore | Descrizione |
|---|---|
| `AMMINISTRATORE` | Utente con privilegi di gestione (UC6–UC16, UC33–UC40) |
| `OPERATORE_SANITARIO` | Utente con accesso operativo (UC17–UC32) |

---

### `AuthErrorType`

**File:** `auth-error-type.enum.ts`
**Stereotipo:** `<<enum>>`

Mappa gli errori di autenticazione ai casi d'uso dell'AdR. Usato da
`LoginComponent` e `FirstAccessComponent` per mostrare il messaggio
corretto nel template senza usare stringhe libere.

| Valore | UC corrispondente | Descrizione |
|---|---|---|
| `USERNAME_OR_PASSWORD_WRONG` | UC42 | Username non registrato o password errata (login standard) |
| `USERNAME_OR_TEMP_PASSWORD_WRONG` | UC43 | Username non registrato o password temporanea errata (primo accesso) |
| `NEW_PASSWORD_EQUALS_TEMP` | UC44 | La nuova password è uguale alla password temporanea |
| `NEW_PASSWORD_NOT_VALID` | UC45 | La nuova password non rispetta i criteri richiesti |

---

## 3. Service

### `InternalAuthService`

**File:** `internal-auth.service.ts`
**Stereotipo:** `<<service>>`
**Scope:** `providedIn: 'root'` — singleton per tutta l'app

È il cuore dell'autenticazione lato frontend. Mantiene lo stato della sessione
in memoria per tutta la durata dell'app e lo espone in modo reattivo tramite RxJS.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `currentUser$` | `BehaviorSubject<UserSession \| null>` | `private` | Tiene in memoria l'utente loggato. Chiunque si iscriva riceve subito il valore corrente e ogni aggiornamento futuro. `null` se nessuno è loggato |
| `token` | `string \| null` | `private` | Il JWT ricevuto dal backend. Tenuto privato e distribuito solo tramite `getToken()` per evitare accessi diretti incontrollati |

### Metodi

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `login(username, password)` | `Observable<UserSession>` | Chiama `POST /auth/login`, riceve il JWT, popola `currentUser$` e salva il token. Il `LoginComponent` si sottoscrive al risultato |
| `setFirstAccessPassword(username, tempPwd, newPwd)` | `Observable<void>` | Specifica per UC2. Invia le tre credenziali al backend per validare la password temporanea e impostarne una nuova |
| `logout()` | `void` | Svuota `currentUser$` a `null` e cancella il token. Chiamato dal `MainLayoutComponent` quando l'utente clicca "esci" |
| `getToken()` | `string \| null` | Usato esclusivamente da `AuthInterceptor` per iniettare il JWT negli header HTTP |
| `getCurrentUser$()` | `Observable<UserSession \| null>` | Espone l'Observable dello stato utente in sola lettura. Usato dalla Dashboard per mostrare nome e ruolo (UC17.3) |
| `getRole()` | `UserRole \| null` | Ritorna direttamente il ruolo dell'utente corrente senza dover fare `subscribe`. Comodo per controlli sincroni |
| `isAuthenticated()` | `boolean` | Ritorna `true` se token e utente sono presenti. Usato da `AuthGuard` |
| `hasRole(role)` | `boolean` | Confronta il ruolo corrente con quello passato come parametro. Usato da `RoleGuard` |

---

## 4. Guard

I Guard sono classi che Angular esegue **prima** di attivare una route.
Se `canActivate()` ritorna `false` o un `UrlTree`, la navigazione viene bloccata
e il componente destinazione non viene mai istanziato.

### `AuthGuard`

**File:** `auth.guard.ts`
**Stereotipo:** `<<guard>>`

Protegge tutte le route che richiedono che l'utente sia loggato.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `authService` | `InternalAuthService` | `private` | Iniettato via DI per accedere allo stato di autenticazione |
| `router` | `Router` | `private` | Usato per redirigere a `/login` in caso di accesso negato |

### Metodi

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `canActivate(route, state)` | `boolean \| UrlTree` | Chiama `authService.isAuthenticated()`. Se `true` lascia passare, altrimenti ritorna `router.createUrlTree(['/login'])` |

---

### `RoleGuard`

**File:** `role.guard.ts`
**Stereotipo:** `<<guard>>`

Protegge le route riservate agli Amministratori. Si aggiunge ad `AuthGuard`
sulle route admin — non lo sostituisce.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `authService` | `InternalAuthService` | `private` | Iniettato via DI |
| `router` | `Router` | `private` | Per redirect in caso di ruolo insufficiente |
| `requiredRole` | `UserRole` | `private` | Il ruolo minimo richiesto per accedere alla route, configurato nel routing |

### Metodi

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `canActivate(route, state)` | `boolean \| UrlTree` | Chiama `authService.hasRole(this.requiredRole)`. Se un Operatore Sanitario prova ad accedere a `/admin/users` viene rediretto alla dashboard |

---

## 5. Interceptor

### `AuthInterceptor`

**File:** `auth.interceptor.ts`
**Stereotipo:** `<<interceptor>>`

Middleware HTTP invisibile. Intercetta **ogni** richiesta HTTP uscente
dall'app prima che arrivi al backend, centralizzando l'aggiunta del token JWT.
Senza di lui ogni API Service dovrebbe aggiungere l'header `Authorization`
manualmente ad ogni chiamata.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `authService` | `InternalAuthService` | `private` | Iniettato via DI per leggere il token corrente |

### Metodi

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `intercept(req, next)` | `Observable<HttpEvent>` | Legge il token con `getToken()`, clona la request aggiungendo l'header `Authorization: Bearer <token>`, e la lascia proseguire nella pipeline HTTP |

---

## 6. Classe Astratta

### `AuthBaseComponent`

**File:** `auth-base.component.ts`
**Stereotipo:** `<<abstract>>`

Classe base astratta condivisa da `LoginComponent` e `FirstAccessComponent`.
Raccoglie gli attributi e i metodi comuni ai due componenti, evitando
duplicazione di codice. Non può essere istanziata direttamente — esiste
solo per essere estesa.

I metodi contrassegnati con `*` nel diagramma sono **astratti**: definiscono
un contratto che ogni sottoclasse è obbligata ad implementare, senza
fornire un'implementazione nella base. In UML formale sarebbero in corsivo.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `authService` | `InternalAuthService` | `protected` | Iniettato via DI. `protected` (e non `private`) perché le sottoclassi devono poterlo usare direttamente |
| `router` | `Router` | `protected` | Iniettato via DI. `protected` per lo stesso motivo |
| `errorType` | `AuthErrorType \| null` | `public` | L'errore corrente da mostrare nel template. `null` quando non c'è errore. Condiviso perché entrambe le sottoclassi ne hanno bisogno |
| `isLoading` | `boolean` | `public` | Usato dal template per mostrare uno spinner e disabilitare il bottone durante la chiamata HTTP. Condiviso per lo stesso motivo |

### Metodi

| Metodo | Astratto | Ritorna | Descrizione |
|---|---|---|---|
| `onUsernameChange(value)` | ✅ sì | `void` | Contratto: ogni sottoclasse deve gestire il cambio username nel proprio form. La logica differisce perché i form sono diversi |
| `onSubmit()` | ✅ sì | `void` | Contratto: ogni sottoclasse deve implementare la propria logica di submit (UC1 vs UC2 chiamano API diverse) |
| `handleSuccess(session)` | ❌ no | `void` | `protected` — Logica condivisa di navigazione post-login. Se `session.isFirstAccess` è `true` naviga a `/first-access`, altrimenti a `/dashboard` |
| `handleError(err)` | ❌ no | `void` | `protected` — Logica condivisa di gestione errori HTTP. Mappa i codici di errore del backend ai valori di `AuthErrorType` |

---

## 7. Component

### `LoginComponent`

**File:** `login.component.ts`
**Stereotipo:** `<<component>>`
**Estende:** `AuthBaseComponent`
**UC coperti:** UC1, UC1.1, UC1.2, UC42

Gestisce l'interfaccia di login standard. Eredita da `AuthBaseComponent`
gli attributi e i metodi comuni, e implementa solo ciò che è specifico di UC1.

### Attributi propri

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `loginForm` | `FormGroup` | `public` | Reactive form con i controlli `username` e `password` e le relative validazioni |

### Metodi propri

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `onUsernameChange(value)` | `void` | Implementazione del metodo astratto. Aggiorna il controllo `username` in `loginForm` — UC1.1 |
| `onPasswordChange(value)` | `void` | Specifico di `LoginComponent`. Aggiorna il controllo `password` in `loginForm` — UC1.2 |
| `onSubmit()` | `void` | Implementazione del metodo astratto. Valida `loginForm` e chiama `authService.login()`, poi delega a `handleSuccess()` o `handleError()` della base |

---

### `FirstAccessComponent`

**File:** `first-access.component.ts`
**Stereotipo:** `<<component>>`
**Estende:** `AuthBaseComponent`
**UC coperti:** UC2, UC2.1, UC2.2, UC2.3, UC43, UC44, UC45

Gestisce il form a tre campi per il primo accesso dell'Operatore Sanitario,
che deve sostituire la password temporanea assegnata dall'Amministratore.
Eredita da `AuthBaseComponent` gli attributi e i metodi comuni.

### Attributi propri

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `firstAccessForm` | `FormGroup` | `public` | Reactive form con i controlli `username`, `tempPassword`, `newPassword` |

### Metodi propri

| Metodo | Ritorna | Descrizione |
|---|---|---|
| `onUsernameChange(value)` | `void` | Implementazione del metodo astratto. Aggiorna il controllo `username` in `firstAccessForm` — UC2.1 |
| `onTempPasswordChange(value)` | `void` | Specifico di `FirstAccessComponent`. Aggiorna `tempPassword` in `firstAccessForm` — UC2.2 |
| `onNewPasswordChange(value)` | `void` | Specifico di `FirstAccessComponent`. Aggiorna `newPassword` in `firstAccessForm` — UC2.3 |
| `onSubmit()` | `void` | Implementazione del metodo astratto. Esegue prima `validateNewPassword()`, poi chiama `authService.setFirstAccessPassword()`, poi delega a `handleSuccess()` o `handleError()` della base |
| `validateNewPassword(pwd)` | `boolean` | `private` — Verifica client-side che la nuova password rispetti i criteri (lunghezza, caratteri speciali). Se non valida setta `errorType = AuthErrorType.NEW_PASSWORD_NOT_VALID` — UC45 |

---

## 8. Module

### `UserAuthenticationModule`

**File:** `user-authentication.module.ts`
**Stereotipo:** `<<module>>`

NgModule Angular che "impacchetta" tutta la feature di autenticazione.
Dichiara i componenti e importa il routing. In Angular un componente
deve essere dichiarato in esattamente un modulo per esistere.

---

### `AuthRoutingModule`

**File:** `auth-routing.module.ts`
**Stereotipo:** `<<module>>`

Definisce le route della feature di autenticazione.

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `routes` | `Routes` | `public` | Array di route Angular: tipicamente `{ path: 'login', component: LoginComponent }` e `{ path: 'first-access', component: FirstAccessComponent }` |

---

## 9. Relazioni

| Sorgente | Destinazione | Tipo | Descrizione |
|---|---|---|---|
| `LoginComponent` | `AuthBaseComponent` | `--|>` generalizzazione | `LoginComponent` estende la classe astratta base ereditando attributi e metodi comuni |
| `FirstAccessComponent` | `AuthBaseComponent` | `--|>` generalizzazione | Idem |
| `AuthBaseComponent` | `InternalAuthService` | `-->` dipendenza (inietta) | La base inietta il service via DI e lo espone come `protected` alle sottoclassi |
| `AuthBaseComponent` | `AuthErrorType` | `-->` dipendenza | La base usa l'enum in `handleError()` e nell'attributo `errorType` |
| `AuthBaseComponent` | `UserSession` | `-->` dipendenza | La base usa il DTO in `handleSuccess()` per leggere `isFirstAccess` e decidere il redirect |
| `InternalAuthService` | `UserSession` | `-->` dipendenza | Il service crea e emette oggetti `UserSession` dopo il login tramite `currentUser$` |
| `InternalAuthService` | `UserRole` | `-->` dipendenza | Il service legge il ruolo dalla sessione per `getRole()` e `hasRole()` |
| `AuthGuard` | `InternalAuthService` | `-->` dipendenza (inietta) | Il guard riceve il service via DI e chiama `isAuthenticated()` |
| `RoleGuard` | `InternalAuthService` | `-->` dipendenza (inietta) | Idem, usa `hasRole()` per il controllo sul ruolo |
| `AuthInterceptor` | `InternalAuthService` | `-->` dipendenza (inietta) | L'interceptor legge il token con `getToken()` |
| `UserAuthenticationModule` | `LoginComponent` | `-->` dichiarazione | Angular ownership: il componente appartiene a questo modulo |
| `UserAuthenticationModule` | `FirstAccessComponent` | `-->` dichiarazione | Idem |
| `UserAuthenticationModule` | `AuthRoutingModule` | `-->` importazione | Il modulo registra le sue route importando il routing module |
| `UserAuthenticationModule` | `InternalAuthService` | `..>` tratteggiata | Il service non è dichiarato nel modulo ma è `providedIn: 'root'`, quindi disponibile globalmente a tutta l'app |
