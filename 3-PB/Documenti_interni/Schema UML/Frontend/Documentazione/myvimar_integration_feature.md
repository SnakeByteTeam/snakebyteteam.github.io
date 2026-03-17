# MyVimar Integration Feature — Documentazione UML

Documento di riferimento per il class diagram del modulo
`MyVimarIntegrationFeature` e `VimarCloudApiService`
del Frontend dell'applicazione **View4Life**.

---

## Indice

1. [Modelli](#1-modelli)
   - [MyVimarAccount](#myvrimaraccount)
   - [OAuthCallbackParams](#oauthcallbackparams)
2. [Interfaccia di Servizio e Token DI](#2-interfaccia-di-servizio-e-token-di)
   - [IVimarCloudApiService](#ivimarcloudapiservice)
   - [VIMAR_CLOUD_API_SERVICE](#vimar_cloud_api_service)
3. [Service](#3-service)
   - [VimarCloudApiService](#vimarcloudapiservice)
4. [Component](#4-component)
   - [MyVimarPageComponent](#myvimarpagecomponent)
   - [MyVimarAccountStatusComponent](#myvrimaraccountstatuscomponent)
   - [OAuthCallbackComponent](#oauthcallbackcomponent)
5. [Module](#5-module)
   - [MyVimarIntegrationModule](#myvrimarintegrationmodule)
   - [MyVimarIntegrationRoutingModule](#myvrimarintegrationroutingmodule)
6. [Relazioni](#6-relazioni)

---

## Note architetturali generali

### Pattern Smart/Dumb Component

La feature adotta il pattern **Smart/Dumb Component**. Un unico componente smart —
`MyVimarPageComponent` — è il solo a conoscere il service, a effettuare chiamate
HTTP e a detenere lo stato della feature. Il componente figlio presentazionale
(`MyVimarAccountStatusComponent`) riceve dati via `@Input` e comunica eventi verso
il padre via `@Output`, senza mai iniettare servizi né conoscere il layer HTTP.
Questo lo rende completamente testabile in isolamento, fornendo solo i valori di
input senza necessità di mock.

### Route Component

La feature introduce un terzo tipo di componente: il **Route Component**
(`OAuthCallbackComponent`). Questo componente non è presentazionale in senso stretto
— inietta direttamente il service e `ActivatedRoute` — ma non detiene stato
persistente né orchestra componenti figli. Il suo ruolo è esclusivamente quello di
leggere i parametri di ritorno dal portale OAuth2 di Vimar dalla URL corrente,
delegare al service la chiamata di callback verso il backend, e navigare verso la
pagina principale della feature tramite `Router`. La responsabilità è puntuale e
monouso: viene montato, esegue la callback, naviga via.

### Comunicazione tra componenti

La comunicazione padre→figlio tra `MyVimarPageComponent` e
`MyVimarAccountStatusComponent` avviene tramite property binding (`[input]`);
la comunicazione figlio→padre avviene tramite event binding (`(output)`). Non
esistono `@ViewChild` né riferimenti TypeScript diretti al figlio.

### Gestione reattiva dello stato account

Lo stato dell'account MyVimar è modellato come `account$: Observable<MyVimarAccount>`
e consumato nel template tramite `async` pipe protetto da `*ngIf ... as`, che
garantisce due proprietà critiche:

1. **Assenza di memory leak**: Angular gestisce automaticamente la sottoscrizione e
   la cancellazione quando il componente è distrutto.
2. **Null safety**: il componente figlio `MyVimarAccountStatusComponent` viene
   istanziato solo quando `account$` ha emesso un valore non null, garantendo che
   il suo `@Input account` sia sempre un `MyVimarAccount` valido, mai `null`.

L'aggiornamento dello stato dopo operazioni mutative (rimozione account) avviene
tramite un `Subject<void>` di refresh interno a `MyVimarPageComponent`, che forza
una nuova emissione di `account$` senza riassegnare il campo Observable.

### Flusso OAuth2 (UC4)

Il flusso OAuth2 richiede due componenti distinti perché coinvolge una navigazione
completa del browser fuori dalla SPA e un successivo ritorno su una route dedicata:

1. `MyVimarPageComponent` riceve l'evento `linkClicked` dal figlio e chiama
   `VimarCloudApiService.initiateOAuth()`, che reindirizza il browser al portale
   ufficiale di Vimar tramite il token `DOCUMENT` di Angular (non `window`
   direttamente — vedi §3).
2. Dopo il login sul portale Vimar, il browser viene reindirizzato a
   `/admin/vimar/callback?code=...&state=...`.
3. `OAuthCallbackComponent` viene montato dal router, legge i parametri dalla URL
   tramite `ActivatedRoute`, costruisce un `OAuthCallbackParams` e chiama
   `VimarCloudApiService.handleOAuthCallback(params)`.
4. In caso di successo naviga verso `/admin/vimar` tramite `Router`. In caso di
   errore mostra un messaggio e rimane sulla route di callback.

### Relazione con il layer di autenticazione interna

La feature MyVimar Integration si integra con il sistema di autenticazione interna
dell'applicazione tramite due meccanismi del layer `core`, entrambi trasparenti
rispetto ai componenti e al service della feature.

**Protezione delle route — `RoleGuard`**

UC3, UC4 e UC5 hanno come pre-condizione esplicita nell'Analisi dei Requisiti:
*"L'Amministratore è autenticato nel Sistema"*. Questa pre-condizione è garantita
architetturalmente da `RoleGuard`, che inietta `InternalAuthService` e ne invoca
`hasRole(UserRole.AMMINISTRATORE)` prima di attivare qualsiasi route della feature.
Entrambe le route — `/admin/vimar` e `/admin/vimar/callback` — sono protette da
`RoleGuard`. Se il controllo fallisce, `RoleGuard` reindirizza l'utente tramite
`Router` senza mai montare i componenti della feature. La protezione della route
di callback è necessaria perché il portale Vimar potrebbe teoricamente effettuare
il redirect anche in assenza di una sessione amministratore attiva.

**Trasporto del token JWT — `AuthInterceptor`**

`AuthInterceptor` intercetta trasparentemente ogni richiesta HTTP uscente
dall'applicazione e aggiunge l'header `Authorization: Bearer <token>` recuperando
il token da `InternalAuthService.getToken()`. Le tre chiamate HTTP di
`VimarCloudApiService` verso il backend — `getLinkedAccount()`,
`handleOAuthCallback()` e `unlinkAccount()` — passano automaticamente per
`AuthInterceptor` senza che il service ne sia a conoscenza. `VimarCloudApiService`
non gestisce autenticazione ed è ignaro del meccanismo JWT.

---

## 1. Modelli

I modelli descrivono la struttura dei dati scambiati tra i componenti e tra il
frontend e il backend. Sono interfacce TypeScript pure — nessuna logica, nessuno
stato, nessuna dipendenza da framework. I modelli in lettura (risposta del backend)
sono separati dai modelli transitori (dati di flusso OAuth2) perché i due tipi
hanno lifecycle e direzione di flusso completamente distinti.

---

### `MyVimarAccount`

**File:** `features/my-vimar-integration/models/my-vimar-account.model.ts`
**Stereotipo:** `<<interface>>`

Rappresenta la struttura dell'account MyVimar così come viene restituita dal backend
nella chiamata di lettura. È il contratto della risposta di `GET /api/vimar-account`.
Non ha logica né stato proprio.

Viene usato da `VimarCloudApiService.getLinkedAccount()` come tipo di ritorno, da
`MyVimarPageComponent` come tipo dell'Observable `account$` esposto al template,
e da `MyVimarAccountStatusComponent` come tipo dell'`@Input account` per la
visualizzazione (UC3, UC3.1). Il campo `isLinked` determina quale variante dell'UI
viene mostrata: se `false`, viene visualizzato il pulsante per avviare il
collegamento (UC4); se `true`, vengono mostrati l'email collegata (UC3.1) e il
pulsante di rimozione (UC5). Quando `isLinked` è `false`, il campo `email` è una
stringa vuota — il backend non restituisce email per account non collegati.

| Campo | Tipo | Descrizione |
|---|---|---|
| `email` | `string` | Indirizzo email dell'account MyVimar collegato. Visualizzato da `MyVimarAccountStatusComponent` in UC3.1. Significativo solo quando `isLinked` è `true`; stringa vuota altrimenti |
| `isLinked` | `boolean` | Indica se è presente un account MyVimar collegato al sistema. Determina la variante visiva del template in `MyVimarAccountStatusComponent` |

---

### `OAuthCallbackParams`

**File:** `features/my-vimar-integration/models/oauth-callback-params.model.ts`
**Stereotipo:** `<<interface>>`

Rappresenta i parametri restituiti dal portale OAuth2 di Vimar nella URL di
callback, dopo che l'Amministratore ha completato il login sul portale esterno.
È un modello transitorio: esiste solo per la durata del ciclo di vita di
`OAuthCallbackComponent` e non viene persistito né propagato oltre la chiamata a
`VimarCloudApiService.handleOAuthCallback()`.

È separato da `MyVimarAccount` perché ha lifecycle e direzione di flusso
completamente distinti: `OAuthCallbackParams` è un DTO in ingresso (costruito da
`OAuthCallbackComponent` leggendo i query parameter della URL corrente tramite
`ActivatedRoute`), mentre `MyVimarAccount` è un DTO in uscita dal backend.

| Campo | Tipo | Descrizione |
|---|---|---|
| `code` | `string` | Codice di autorizzazione monouso emesso dal portale OAuth2 di Vimar. Viene inviato al backend tramite `POST /api/vimar-account/oauth/callback` affinché quest'ultimo lo scambi con un token di accesso permanente. Valido per un singolo utilizzo e per un breve intervallo di tempo |
| `state` | `string` | Valore opaco generato dal backend al momento dell'avvio del flusso OAuth2. Il portale Vimar lo restituisce invariato nella URL di callback. Il backend lo verifica per garantire che la callback corrisponda a una richiesta di autorizzazione legittima, proteggendo dal CSRF |

---

## 2. Interfaccia di Servizio e Token DI

---

### `IVimarCloudApiService`

**File:** `core/services/vimar-cloud-api.service.interface.ts`
**Stereotipo:** `<<interface>>`

Contratto che `VimarCloudApiService` è tenuto a rispettare. Definisce i quattro
metodi pubblici che i componenti della feature devono poter invocare. L'interfaccia
è collocata nel layer `core/` — stesso package della classe concreta che la
implementa — per rispettare la direzione delle dipendenze tra layer: il layer `core`
non può dipendere dal layer `features`.

L'interfaccia abilita la sostituzione della classe concreta con un mock o uno stub
nei test, senza che i componenti consumatori debbano essere modificati. I componenti
non iniettano `VimarCloudApiService` direttamente ma ottengono la dipendenza tramite
il token `VIMAR_CLOUD_API_SERVICE` (vedi §2.2), dichiarando il tipo
`IVimarCloudApiService`.

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `getLinkedAccount()` | `Observable<MyVimarAccount>` | UC3, UC3.1 | Recupera lo stato dell'account MyVimar collegato al sistema. Corrisponde a `GET /api/vimar-account` |
| `initiateOAuth()` | `void` | UC4 | Avvia il flusso OAuth2 costruendo l'URL di autorizzazione Vimar e reindirizzando il browser. Non effettua chiamate HTTP al backend |
| `handleOAuthCallback(params: OAuthCallbackParams)` | `Observable<void>` | UC4 | Invia il codice di autorizzazione al backend per completare il flusso OAuth2. Corrisponde a `POST /api/vimar-account/oauth/callback` |
| `unlinkAccount()` | `Observable<void>` | UC5 | Rimuove l'associazione tra il sistema e l'account MyVimar. Corrisponde a `DELETE /api/vimar-account` |

---

### `VIMAR_CLOUD_API_SERVICE`

**File:** `core/services/vimar-cloud-api.service.interface.ts`
**Stereotipo:** `InjectionToken<IVimarCloudApiService>`

Token di iniezione Angular associato all'interfaccia `IVimarCloudApiService`.
È definito nello stesso file dell'interfaccia:

```typescript
export const VIMAR_CLOUD_API_SERVICE =
  new InjectionToken<IVimarCloudApiService>('VimarCloudApiService');
```

Il binding tra il token e la classe concreta è registrato nell'app module (o nei
`providers` radice), **non** in `MyVimarIntegrationModule`. Poiché
`VimarCloudApiService` è `providedIn: 'root'`, registrare il provider del token con
`useClass` in un modulo lazy creerebbe una seconda istanza separata dall'injector
radice. La strategia corretta è usare `useExisting` per allineare il token
all'istanza singleton già esistente:

```typescript
// In app.module.ts o app.config.ts (providers radice)
providers: [
  { provide: VIMAR_CLOUD_API_SERVICE, useExisting: VimarCloudApiService }
]
```

`useExisting` garantisce che il token risolva sempre la stessa istanza singleton
di `VimarCloudApiService` creata dall'injector radice — nessuna duplicazione.

I componenti consumatori (`MyVimarPageComponent`, `OAuthCallbackComponent`)
iniettano il token — non la classe concreta — nel costruttore:

```typescript
constructor(
  @Inject(VIMAR_CLOUD_API_SERVICE) private service: IVimarCloudApiService
) {}
```

Nei test, il token viene sostituito con un mock senza toccare il componente:

```typescript
providers: [
  { provide: VIMAR_CLOUD_API_SERVICE, useValue: mockVimarService }
]
```

---

## 3. Service

---

### `VimarCloudApiService`

**File:** `core/services/vimar-cloud-api.service.ts`
**Stereotipo:** `<<service>>`
**Scope:** `providedIn: 'root'` — singleton globale, disponibile tramite l'injector radice

Implementa `IVimarCloudApiService`. È il **repository HTTP** per il dominio account
MyVimar: la sua unica responsabilità è astrarre le interazioni con il backend e,
per il solo caso `initiateOAuth()`, con il browser. Non contiene logica di business,
non mantiene stato applicativo, non conosce i componenti che lo usano. Non gestisce
autenticazione: il token JWT viene aggiunto automaticamente ad ogni richiesta HTTP
da `AuthInterceptor`, che opera a livello di `HttpClient` pipeline in modo
trasparente rispetto a questo service.

Centralizza in un unico punto tutti gli accessi agli endpoint `/api/vimar-account`:
se un path o un contratto HTTP cambia, la modifica è circoscritta a questo file.

`initiateOAuth()` non usa `window.location.href` direttamente: per garantire
testabilità e compatibilità con ambienti privi di `window` (SSR), il metodo
riceve il token `DOCUMENT` di Angular via dependency injection e naviga tramite
`this.document.defaultView.location.href`. Nei test è sufficiente fornire un
`Document` mock tramite `{ provide: DOCUMENT, useValue: mockDocument }`.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `http` | `HttpClient` | `private` | Client HTTP Angular iniettato via DI nel costruttore. Unico punto di accesso alla rete per tutta la feature |
| `document` | `Document` | `private` | Token `DOCUMENT` di Angular iniettato via `@Inject(DOCUMENT)`. Usato esclusivamente in `initiateOAuth()` per impostare `location.href` in modo testabile |
| `baseUrl` | `string` | `private` | URL base del backend View4Life, letta da `environment.apiBaseUrl`. Prefissa tutti i path degli endpoint (`/api/vimar-account`). Derivata dall'environment Angular per supportare ambienti distinti (dev, staging, prod) senza modificare il codice sorgente |

### Metodi

| Metodo | Ritorna | Endpoint | UC | Descrizione |
|---|---|---|---|---|
| `getLinkedAccount()` | `Observable<MyVimarAccount>` | `GET /api/vimar-account` | UC3, UC3.1 | Recupera lo stato corrente dell'account MyVimar associato al sistema. Il backend risponde con `{ email, isLinked }`. Se `isLinked` è `false`, il campo `email` è stringa vuota |
| `initiateOAuth()` | `void` | — | UC4 | Costruisce l'URL di autorizzazione del portale OAuth2 di Vimar (con `client_id`, `redirect_uri`, `state` e `scope`) e imposta `this.document.defaultView.location.href` per reindirizzare il browser. Non effettua chiamate HTTP al backend. Causa una navigazione completa fuori dalla SPA: non restituisce un `Observable` perché il controllo non torna al chiamante dopo l'esecuzione |
| `handleOAuthCallback(params: OAuthCallbackParams)` | `Observable<void>` | `POST /api/vimar-account/oauth/callback` | UC4 | Invia il codice di autorizzazione monouso al backend. Il backend verifica `state`, scambia `code` con il token Vimar presso il portale OAuth2 e salva il token nel database. Il token Vimar non viene mai restituito al frontend |
| `unlinkAccount()` | `Observable<void>` | `DELETE /api/vimar-account` | UC5 | Richiede al backend la rimozione dell'associazione con l'account MyVimar. Il backend elimina il token Vimar dal database |

---

## 4. Component

---

### `MyVimarPageComponent`

**File:** `features/my-vimar-integration/pages/my-vimar/my-vimar-page.component.ts`
**Stereotipo:** `<<component>>`
**Tipo:** Smart Component — orchestratore della feature
**UC coperti:** UC3, UC3.1, UC4, UC5

È l'unico componente smart della feature. Detiene lo stato, effettua le chiamate
al service e gestisce i cicli di caricamento e gli errori. Il template renderizza
`<app-my-vimar-account-status>` passandogli i dati tramite `@Input` e ricevendo
gli eventi tramite `@Output` — senza che il componente figlio conosca il service.

La route `/admin/vimar` è protetta da `RoleGuard(AMMINISTRATORE)`: solo
l'Amministratore può montare questo componente.

Il service è iniettato tramite il token `VIMAR_CLOUD_API_SERVICE` e dichiarato
di tipo `IVimarCloudApiService`, non della classe concreta. Questo disaccoppia
il componente dall'implementazione, rendendo possibile nei test la sostituzione
con un mock senza modificare il componente.

### Template — binding principali

```html
<ng-container *ngIf="account$ | async as account">
  <app-my-vimar-account-status
    [account]="account"
    [isLoading]="isLoading"
    [error]="error"
    (linkClicked)="onLinkAccount()"
    (unlinkClicked)="onUnlinkAccount()">
  </app-my-vimar-account-status>
</ng-container>
```

Il pattern `*ngIf="account$ | async as account"` garantisce che
`MyVimarAccountStatusComponent` venga istanziato solo quando `account$` ha emesso
un valore non null. Questo assicura che l'`@Input account` del figlio sia sempre
un `MyVimarAccount` valido, evitando accessi a proprietà di un oggetto null durante
il primo ciclo di rendering (prima che l'Observable emetta).

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `service` | `IVimarCloudApiService` | `private` | Iniettato via `@Inject(VIMAR_CLOUD_API_SERVICE)`. Dichiarato come tipo interfaccia per disaccoppiare il componente dalla classe concreta. Unico punto di accesso al layer HTTP della feature |
| `account$` | `Observable<MyVimarAccount>` | `public` | Observable dell'account MyVimar corrente. Inizializzato in `ngOnInit()` tramite il Refresh Subject interno. Consumato nel template con `async` pipe protetto da `*ngIf ... as`: nessuna sottoscrizione manuale, nessun rischio di memory leak, null safety garantita |
| `isLoading` | `boolean` | `public` | Flag di caricamento globale della feature. Impostato a `true` prima delle chiamate HTTP mutative (`unlinkAccount()`) e a `false` al completamento, sia in caso di successo che di errore. Passato come `@Input` a `MyVimarAccountStatusComponent` per disabilitare i bottoni durante le operazioni in corso |
| `error` | `string` | `public` | Messaggio di errore corrente. Stringa vuota in assenza di errori. Valorizzato nel blocco `error` di `onUnlinkAccount()`. Passato come `@Input` a `MyVimarAccountStatusComponent` per mostrare l'errore nel template |
| `refresh$` | `Subject<void>` | `private` | Subject interno usato per forzare un nuovo fetch di `account$` dopo operazioni mutative. Non è esposto all'esterno né al template. Emette `void` — non trasporta dati: è un segnale puro di invalidazione della cache |

### Metodi

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `ngOnInit()` | `void` | UC3 | Lifecycle hook Angular. Inizializza `account$` come pipeline reattiva: `refresh$.pipe(startWith(void 0), switchMap(() => service.getLinkedAccount()))`. Il `startWith` garantisce l'emissione immediata al montaggio del componente senza dover chiamare `refresh$.next()` esplicitamente. L'`async` pipe nel template gestisce automaticamente sottoscrizione e cancellazione |
| `onLinkAccount()` | `void` | UC4 | Ricevuto dall'`@Output linkClicked` di `MyVimarAccountStatusComponent`. Chiama direttamente `service.initiateOAuth()`, che provoca una navigazione completa fuori dalla SPA. Non imposta `isLoading = true`: il componente viene distrutto prima che qualsiasi cambio di stato possa essere renderizzato, rendendo l'operazione priva di effetti visibili |
| `onUnlinkAccount()` | `void` | UC5 | Ricevuto dall'`@Output unlinkClicked` di `MyVimarAccountStatusComponent`. Imposta `isLoading = true`, chiama `service.unlinkAccount()`. In caso di successo imposta `isLoading = false` ed emette `refresh$.next()` per invalidare `account$` e forzare un nuovo fetch. In caso di errore valorizza `error` con un messaggio descrittivo e imposta `isLoading = false`. La sottoscrizione è protetta da `takeUntilDestroyed(this.destroyRef)` per evitare che continui ad essere attiva nel caso in cui l'utente navighi via prima del completamento della chiamata HTTP |

---

### `MyVimarAccountStatusComponent`

**File:** `features/my-vimar-integration/components/my-vimar-account-status/my-vimar-account-status.component.ts`
**Stereotipo:** `<<component>>`
**Tipo:** Dumb/Presentational Component
**UC coperti:** UC3, UC3.1, UC4 (bottone collegamento), UC5 (bottone rimozione)

È il componente presentazionale della feature. Non inietta servizi, non effettua
chiamate HTTP, non detiene stato proprio. Riceve tutti i dati via `@Input` da
`MyVimarPageComponent` e comunica le interazioni dell'utente via `@Output`. Questo
lo rende completamente testabile in isolamento: è sufficiente fornire i valori
di input nel test senza necessità di mock per i service.

Il template presenta due varianti esclusive basate su `account.isLinked`:

- se `account.isLinked` è `true`: mostra l'email collegata (UC3.1) e il bottone
  "Rimuovi account" che, alla pressione, emette `unlinkClicked`.
- se `account.isLinked` è `false`: mostra un messaggio informativo sull'assenza
  di account collegato e un bottone "Collega account MyVimar" che, alla pressione,
  emette `linkClicked`.

I bottoni di azione sono disabilitati quando `isLoading` è `true`, prevenendo
doppi invii durante operazioni in corso. Se `error` è una stringa non vuota, il
template mostra un avviso di errore contestuale.

Non esiste logica condizionale TypeScript in questo componente: tutta la
ramificazione è gestita nel template tramite `*ngIf`. L'`@Input account` è garantito
non null da `MyVimarPageComponent` tramite il pattern `*ngIf ... as` nel proprio
template (vedi §4.1).

### Attributi

| Attributo | Tipo | Visibilità | Stereotipo | Descrizione |
|---|---|---|---|---|
| `account` | `MyVimarAccount` | `public` | `@Input()` | Lo stato dell'account MyVimar da visualizzare, passato da `MyVimarPageComponent` tramite property binding. Il template lo usa per selezionare la variante visiva corretta e per mostrare l'email (UC3.1). Garantito non null dal pattern `*ngIf ... as` nel parent |
| `isLoading` | `boolean` | `public` | `@Input()` | Flag di caricamento passato da `MyVimarPageComponent`. Quando `true`, i bottoni di azione sono disabilitati nel template per prevenire interazioni durante operazioni in corso |
| `error` | `string` | `public` | `@Input()` | Messaggio di errore da mostrare nel template. Passato da `MyVimarPageComponent`. Quando valorizzato (stringa non vuota), il template mostra un avviso di errore contestuale. Stringa vuota in assenza di errori |
| `linkClicked` | `EventEmitter<void>` | `public` | `@Output()` | Emesso quando l'Amministratore preme il bottone "Collega account MyVimar". Ricevuto da `MyVimarPageComponent.onLinkAccount()`. Innesca il flusso OAuth2 (UC4). Non trasporta payload: è un segnale puro |
| `unlinkClicked` | `EventEmitter<void>` | `public` | `@Output()` | Emesso quando l'Amministratore preme il bottone "Rimuovi account". Ricevuto da `MyVimarPageComponent.onUnlinkAccount()`. Innesca la chiamata di rimozione dell'account (UC5). Non trasporta payload: è un segnale puro |

---

### `OAuthCallbackComponent`

**File:** `features/my-vimar-integration/pages/oauth-callback/oauth-callback.component.ts`
**Stereotipo:** `<<component>>`
**Tipo:** Route Component — gestore della callback OAuth2
**UC coperti:** UC4 (fase di ritorno dal portale Vimar)

Componente dedicato esclusivamente alla gestione del rientro nella SPA dopo il
completamento del flusso OAuth2. È montato dal router Angular quando il browser
viene reindirizzato alla route `/admin/vimar/callback` dal portale di Vimar, dopo
che l'Amministratore ha completato il login (UC4).

A differenza di `MyVimarAccountStatusComponent`, questo componente inietta
direttamente il service: non è puramente presentazionale perché la sua
responsabilità — leggere i parametri della URL e inviare la callback al backend —
richiede accesso al layer HTTP (`IVimarCloudApiService`) e al contesto di routing
(`ActivatedRoute`, `Router`). Non è però un componente smart nel senso tradizionale:
non detiene stato persistente della feature né orchestra componenti figli.

Il ciclo di vita è breve e lineare: viene montato, legge i parametri dalla URL
tramite `ActivatedRoute`, esegue la callback, naviga via tramite `Router`. Non è
previsto che l'utente interagisca con esso oltre alla visualizzazione transitoria
di uno stato di caricamento o di errore.

Tutte le dipendenze sono `private`: nessuna è esposta all'esterno del componente.
Il service è iniettato tramite il token `VIMAR_CLOUD_API_SERVICE` e dichiarato
di tipo `IVimarCloudApiService`, coerentemente con `MyVimarPageComponent`.

### Attributi

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `isProcessing` | `boolean` | `public` | Inizializzato a `true` in `ngOnInit()` per mostrare uno stato di attesa nel template durante la chiamata HTTP. Impostato a `false` al termine dell'operazione, sia in caso di successo che di errore |
| `callbackError` | `string \| null` | `public` | Messaggio di errore da mostrare nel template in caso di fallimento della callback. `null` in assenza di errori. Valorizzato quando `service.handleOAuthCallback()` restituisce un errore (es. codice di autorizzazione scaduto, parametro `state` non valido, backend non raggiungibile) |
| `service` | `IVimarCloudApiService` | `private` | Iniettato via `@Inject(VIMAR_CLOUD_API_SERVICE)`. Usato esclusivamente in `ngOnInit()` per delegare la chiamata di callback al backend. Dichiarato come tipo interfaccia per disaccoppiare il componente dalla classe concreta |
| `route` | `ActivatedRoute` | `private` | Iniettato via DI nel costruttore. Usato in `ngOnInit()` per leggere `code` e `state` da `route.snapshot.queryParamMap`. Fornisce accesso ai parametri della URL corrente (`/admin/vimar/callback?code=...&state=...`) senza dipendere direttamente da `window.location` |
| `router` | `Router` | `private` | Iniettato via DI nel costruttore. Usato in `ngOnInit()` per navigare programmaticamente verso `/admin/vimar` al completamento con successo della callback. Permette la navigazione interna alla SPA senza ricaricare la pagina |

### Metodi

| Metodo | Ritorna | UC | Descrizione |
|---|---|---|---|
| `ngOnInit()` | `void` | UC4 | Lifecycle hook Angular. Legge `code` e `state` da `route.snapshot.queryParamMap`. Poiché `queryParamMap.get()` ritorna `string | null`, `ngOnInit()` esegue un null check su entrambi i parametri: se uno dei due è assente, imposta `callbackError` con un messaggio di errore ("Parametri OAuth2 mancanti") e `isProcessing = false` senza chiamare il service. In caso contrario costruisce un `OAuthCallbackParams` e chiama `service.handleOAuthCallback(params)`, proteggendo la sottoscrizione con `takeUntilDestroyed(this.destroyRef)`. In caso di successo naviga verso `/admin/vimar` tramite `router.navigate(['/admin/vimar'])`. In caso di errore imposta `callbackError` con un messaggio descrittivo e `isProcessing` a `false`, mostrando l'errore nel template senza navigare |

---

## 5. Module

---

### `MyVimarIntegrationModule`

**File:** `features/my-vimar-integration/my-vimar-integration.module.ts`
**Stereotipo:** `<<ngmodule>>`

NgModule Angular che incapsula tutta la feature di integrazione MyVimar. Dichiara
i tre componenti della feature (`MyVimarPageComponent`, `MyVimarAccountStatusComponent`,
`OAuthCallbackComponent`) e importa il modulo di routing. Registra il binding tra
il token `VIMAR_CLOUD_API_SERVICE` e la classe concreta `VimarCloudApiService` nei
propri `providers`, oppure delega questo binding all'app module se il service deve
essere disponibile globalmente.

`VimarCloudApiService` è `providedIn: 'root'` e non è dichiarato in questo modulo:
è disponibile globalmente tramite l'injector radice e non è legato al ciclo di vita
del modulo.

---

### `MyVimarIntegrationRoutingModule`

**File:** `features/my-vimar-integration/my-vimar-integration-routing.module.ts`
**Stereotipo:** `<<ngmodule>>`

Definisce le route interne alla feature. Tutte le route sono relative al prefisso
`/admin/vimar` con cui il modulo è caricato (lazy) dall'app router. La feature
espone due route distinte perché il flusso OAuth2 richiede necessariamente un punto
di rientro separato nella SPA.

Entrambe le route sono protette da `RoleGuard` con ruolo `AMMINISTRATORE`.
La protezione della route di callback è necessaria perché il portale Vimar
potrebbe reindirizzare all'URL di callback anche in sessioni non amministratore.
`RoleGuard` delega la verifica del ruolo a `InternalAuthService.hasRole()` e in
caso negativo reindirizza l'utente senza montare il componente.

| Attributo | Tipo | Visibilità | Descrizione |
|---|---|---|---|
| `routes` | `Routes` | `public` | Due route: `{ path: '', component: MyVimarPageComponent, canActivate: [RoleGuard] }` — pagina principale (UC3, UC4, UC5); `{ path: 'callback', component: OAuthCallbackComponent, canActivate: [RoleGuard] }` — punto di rientro OAuth2 (UC4) |

---

## 6. Relazioni

| Sorgente | Destinazione | Tipo | Descrizione |
|---|---|---|---|
| `VimarCloudApiService` | `IVimarCloudApiService` | `..▷` realizzazione | La classe concreta implementa il contratto dell'interfaccia. Garantisce la sostituibilità nei test tramite il token `VIMAR_CLOUD_API_SERVICE` |
| `VimarCloudApiService` | `HttpClient` | `-->` dipendenza (inietta) | Client HTTP Angular — unico punto di accesso alla rete per le chiamate REST |
| `VimarCloudApiService` | `Document` | `-->` dipendenza (`@Inject(DOCUMENT)`) | Token Angular per l'accesso al DOM. Usato da `initiateOAuth()` per impostare `location.href` in modo testabile |
| `VimarCloudApiService` | `MyVimarAccount` | `..>` dipendenza tratteggiata (`«returns»`) | Ritorna `MyVimarAccount` come tipo di `getLinkedAccount()`. Non lo possiede |
| `VimarCloudApiService` | `OAuthCallbackParams` | `..>` dipendenza tratteggiata (`«accepts»`) | Accetta `OAuthCallbackParams` come parametro di `handleOAuthCallback()`. Non lo possiede |
| `MyVimarPageComponent` | `IVimarCloudApiService` | `-->` dipendenza (`@Inject(VIMAR_CLOUD_API_SERVICE)`) | Inietta il contratto, non la classe concreta. Unico componente smart della feature con accesso al layer HTTP |
| `MyVimarPageComponent` | `MyVimarAccount` | `..>` dipendenza tratteggiata | Usa `MyVimarAccount` come tipo di `account$` e come tipo dell'`@Input` passato a `MyVimarAccountStatusComponent` |
| `MyVimarPageComponent` | `MyVimarAccountStatusComponent` | `*--` composizione di template (`«composes»`) | Il template di `MyVimarPageComponent` renderizza `<app-my-vimar-account-status>` tramite `*ngIf ... as`. Il ciclo di vita del figlio è controllato dal parent. Non si traduce in un campo TypeScript |
| `MyVimarAccountStatusComponent` | `MyVimarAccount` | `..>` dipendenza tratteggiata (`«input»`) | Riceve `MyVimarAccount` via `@Input account` e lo renderizza nel template per mostrare email e stato collegamento (UC3, UC3.1) |
| `MyVimarAccountStatusComponent` | `MyVimarPageComponent` | `-->` evento (`linkClicked`) | Emette `EventEmitter<void>` quando l'Amministratore preme "Collega account". Ricevuto da `MyVimarPageComponent.onLinkAccount()` |
| `MyVimarAccountStatusComponent` | `MyVimarPageComponent` | `-->` evento (`unlinkClicked`) | Emette `EventEmitter<void>` quando l'Amministratore preme "Rimuovi account". Ricevuto da `MyVimarPageComponent.onUnlinkAccount()` |
| `OAuthCallbackComponent` | `IVimarCloudApiService` | `-->` dipendenza (`@Inject(VIMAR_CLOUD_API_SERVICE)`) | Inietta il contratto per delegare la gestione della callback OAuth2 verso il backend (UC4). Dichiarato `private` |
| `OAuthCallbackComponent` | `OAuthCallbackParams` | `..>` dipendenza tratteggiata (`«builds»`) | Costruisce `OAuthCallbackParams` leggendo `code` e `state` da `route.snapshot.queryParamMap` in `ngOnInit()` |
| `OAuthCallbackComponent` | `ActivatedRoute` | `-->` dipendenza (inietta) | Fornisce accesso ai query parameter della URL di callback (`?code=...&state=...`). Dichiarato `private`, usato solo in `ngOnInit()` |
| `OAuthCallbackComponent` | `Router` | `-->` dipendenza (inietta) | Permette la navigazione programmatica verso `/admin/vimar` al completamento della callback. Dichiarato `private`, usato solo in `ngOnInit()` |
| `MyVimarIntegrationModule` | `MyVimarPageComponent` | `-->` dichiarazione | Angular ownership — il componente è dichiarato nel modulo |
| `MyVimarIntegrationModule` | `MyVimarAccountStatusComponent` | `-->` dichiarazione | Angular ownership — il componente è dichiarato nel modulo |
| `MyVimarIntegrationModule` | `OAuthCallbackComponent` | `-->` dichiarazione | Angular ownership — il componente è dichiarato nel modulo |
| `MyVimarIntegrationModule` | `MyVimarIntegrationRoutingModule` | `-->` importazione | Il modulo registra le proprie route interne |

### Relazioni cross-cutting con il layer `core` (non nel class diagram della feature)

| Sorgente | Destinazione | Tipo | Descrizione |
|---|---|---|---|
| `RoleGuard` | `InternalAuthService` | `-->` dipendenza (inietta) | `RoleGuard` invoca `InternalAuthService.hasRole(UserRole.AMMINISTRATORE)` prima di attivare `/admin/vimar` e `/admin/vimar/callback`. Garantisce la pre-condizione *"L'Amministratore è autenticato"* richiesta da UC3, UC4, UC5 |
| `AuthInterceptor` | `InternalAuthService` | `-->` dipendenza (inietta) | `AuthInterceptor` recupera il JWT tramite `InternalAuthService.getToken()` e lo aggiunge come header `Authorization: Bearer` a ogni richiesta HTTP uscente. Le chiamate di `VimarCloudApiService` al backend sono autenticate in modo trasparente, senza che il service conosca `InternalAuthService` |
