# CONTEXTO_HUELLERO.md

> **Fuente principal de contexto** para continuar el desarrollo de la aplicación/servicio local del huellero.
>
> Léelo completo **antes** de modificar código relacionado con el huellero.
>
> Leyenda de estados usada en todo el documento:
> - `[DECIDIDO]` — decisión confirmada con el usuario.
> - `[IMPLEMENTADO]` — ya hecho y verificado en el código.
> - `[PARCIAL]` — implementado en parte (esqueleto/lectura listos, falta lógica o persistencia).
> - `[PENDIENTE]` — diseñado o necesario, pero todavía NO implementado.

---

# Contexto del proyecto

Sistema integral para la **toma y gestión de asistencias mediante lector de huellas digitales DigitalPersona U.are.U 4500** para el SENA.

Compuesto por tres piezas conceptuales:

1. **Backend central** — API de negocio (Node.js + Express + MongoDB Atlas).
2. **Dashboard web** — interfaz de usuarios (Vue 3 + Vite) para Estudiante, Profesor (Instructor), Profesor Líder (Instructor Líder) y Administrador.
3. **Aplicación local del huellero** — servicio que se ejecuta en el PC donde está conectado físicamente el lector DigitalPersona (en proceso de separación).

# Arquitectura actual

El proyecto ya existía y estaba avanzado antes de comenzar esta separación. **NO se debe rehacer desde cero.**

Estructura actual del repositorio:

```text
HuelleroActualizado/
├── backend/                  # API Node.js + Express + MongoDB Atlas
│   ├── dll/                  # 8 DLLs nativas DigitalPersona
│   ├── models/               # Admin, Asistencia, Clase, DiaFestivo, Dispositivo, Estudiante, Excusa, Ficha, Instructor
│   ├── routes/               # admin, asistencias, auth, clases, diasFestivos, dispositivos, enrolamiento, estudiantes, excusas, fichas, instructores
│   ├── services/             # fingerprint.js (motor biométrico koffi + dpfj.dll), socketService.js (hub Socket.io)
│   ├── index.js              # arranque, conexión MongoDB, nodemailer
│   └── package.json
├── frontend/                 # Vue 3 + Vite (dashboards web)
│   ├── public/scripts/       # Web SDK DigitalPersona (fingerprint.sdk.min.js, websdk.client.bundle.min.js, es6-shim.js)
│   └── src/components/       # PanelInstructor.vue (huellero embebido aquí), App.vue, etc.
├── huellero/                 # Aplicación local Electron (ver "Estado actual")
├── server/                   # Carpeta residual (solo contiene dll/dpfj.dll y dll/dpfr6.dll, sin código)
├── setup_servicios_huella.bat# Instala DpHost/DPAgent en el PC del lector
├── setup_huellas.bat         # npm install + verificación de koffi/pngjs
└── GUIA_INSTALACION.md
```

Funcionalidades que **ya existen** en el backend/frontend:

- Autenticación (login por correo/documento, recuperación de contraseña).
- Gestión de estudiantes, instructores, fichas, excusas, días festivos.
- Asistencias (registro, inhabilitación/reactivación de jornada, reportes, exportación Excel).
- Roles: Administrador, Instructor, Instructor Líder (campo `esLider`), Estudiante.
- Funcionalidad de huella mezclada con el resto (captura en navegador vía Web SDK + motor de minucias en el backend).

# Objetivo de la separación

Separar **progresivamente** la funcionalidad del lector de huellas para convertirla en una **aplicación/servicio local independiente**, que posteriormente será **empaquetada como `.exe`**.

La aplicación local estará instalada en los computadores que tengan **físicamente conectado** el lector DigitalPersona.

Reglas del proceso:

- Reutilizar código existente (no empezar el huellero desde cero).
- Cambios pequeños y progresivos, sin romper el sistema actual.
- El backend deja de depender de las DLLs de DigitalPersona al terminar la migración.

# Responsabilidades

## Dashboard web

- **Estudiante**: consulta su resumen de asistencias, inasistencias y excusas.
- **Profesor (Instructor)**: consulta sus fichas, inicia clase, activa toma de asistencia (biométrica o manual).
- **Profesor Líder (Instructor Líder)**: además de lo del profesor, crea estudiantes, desactiva estudiantes/profesores, consulta estudiantes, descarga reportes, y dispara el **enrolamiento** de huellas.
- **Administrador**: crea profesores/estudiantes, administra fichas, asigna líderes, gestiona roles, administra la asociación dispositivo ↔ ficha.

## Backend central

- Lógica de negocio.
- Autenticación / autorización.
- Usuarios, fichas, asistencias, reportes.
- **Comunicación con dispositivos** (registro, asociación, comandos en tiempo real).
- Persistencia en MongoDB.

## Aplicación local del huellero

- Comunicación con el lector DigitalPersona.
- Captura de huellas.
- Enrolamiento.
- Verificación / identificación de estudiantes.
- Almacenamiento local de asistencias pendientes.
- Comunicación con el backend.
- Funcionamiento offline.
- Sincronización de pendientes.

**NO** debe encargarse de: crear profesores/estudiantes, gestionar roles, crear fichas, reportes administrativos ni administración general del sistema.

# Relación dispositivo ↔ ficha

`[DECIDIDO]` — decisión definitiva.

- **1 dispositivo puede tener muchas fichas asociadas.**
- **1 ficha solo puede estar asociada a 1 dispositivo a la vez.**
- **No existe** asociación de una ficha con varios dispositivos simultáneamente.
- El backend puede resolver directamente: `fichaId → deviceId` (una sola consulta, sin ambigüedad).

Ejemplo:

```text
PC Aula 03
├── Ficha 3139319
├── Ficha 232133
└── Ficha 123123
```

**Identidad y autenticación del dispositivo:**

- `deviceId`: UUID único (identidad).
- `token`: secreto de autenticación (demuestra quién es).
- En el backend se guarda **solo el hash** del token, nunca en texto plano.
- El token se puede revocar/rotar sin tocar la identidad del equipo.

**La dirección MAC fue descartada** como identidad y como mecanismo de autenticación (es suplantable, no es un secreto y es ambigua por múltiples adaptadores de red). `[DECIDIDO]`

`[PENDIENTE]` — La asociación dispositivo ↔ fichas se administrará desde el dashboard del Administrador (sección "Dispositivos/Huelleros"). No está implementada.

`[DECIDIDO]` — Al asociar una ficha ya asociada a otro dispositivo (`PUT /dispositivos/:id/fichas`), el backend debe **reasignarla automáticamente** (moverla, quitándola del dispositivo anterior), no rechazar la operación.

# Clases activas

`[DECIDIDO]` — decisiones confirmadas:

- Un instructor solo puede tener **una ficha activa** a la vez.
- Un dispositivo solo puede tener **una ficha activa** a la vez.
- La **ficha** es lo que identifica el grupo/clase (no hay otra identificación de clase).
- El instructor tiene un botón **"Iniciar clase"**.
- El instructor tiene un botón **"Finalizar clase"** (desactivación manual; no hay cron ni duración automática).
- El estado de la clase activa **debe persistirse en el backend/BD**.
- WebSocket se usa para **entregar comandos en tiempo real**.

**Insight clave `[DECIDIDO]`:** el estado vive en la BD; el WebSocket solo *entrega* el mensaje. Si el dispositivo estaba offline al activar, la clase queda activa en BD y, cuando el dispositivo se reconecte, el backend le reenvía el comando pendiente (la reconexión no rompe nada).

`[IMPLEMENTADO]` (parcial) — Modelo `Clase` (`deviceId`, `fichaId`, `instructorId`, `estado`, `iniciadaAt`, `finalizadaAt`) y endpoint `POST /api/clases/activar`, que crea/reactiva la clase y envía `ACTIVATE` por WebSocket al `deviceId` conectado.
`[PENDIENTE]` — `finalizar` (`DEACTIVATE`), el reenvío del comando pendiente al reconectar, y las invariantes estrictas (una activa por instructor y por dispositivo).

# Activación remota

`[DECIDIDO]` — flujo:

```text
Instructor
→ Dashboard web
→ Backend
→ resolución fichaId → deviceId
→ WebSocket
→ aplicación local del dispositivo
→ huellero habilitado
→ estudiante coloca huella
→ asistencia
```

El PC del huellero **no necesita IP pública**: la conexión la inicia la aplicación local hacia el backend.

**Mensajes definidos `[DECIDIDO]` (payloads), `[IMPLEMENTADO]` ACTIVATE (mínimo), `[PENDIENTE]` DEACTIVATE:**

```text
Backend → Huellero:
  ACTIVATE   { type: "ACTIVATE",   fichaId, instructorId }
  DEACTIVATE { type: "DEACTIVATE", fichaId, instructorId }
```

Nota: `POST /api/clases/activar` recibe hoy `{ deviceId, fichaId, instructorId }` porque la resolución `fichaId → deviceId` (asociación dispositivo↔ficha) aún no está implementada.

# Enrolamiento

`[DECIDIDO]` — **Cambio de rumbo (25/08/2026), revisión de la decisión original:** el enrolamiento se hace **desde la aplicación local** (modo docente), no desde el dashboard web como se había decidido antes. Motivo: **agilidad del flujo** y **no depender del ciclo completo `ENROLL_START/ENROLL_COMPLETE` por WebSocket** mientras esa parte aún no está lista. Solo un instructor con `esLider === true` ve la opción **[Registrar huella]** y puede enrolar estudiantes de la ficha donde es líder (`Ficha.instructorLiderId = su _id`).

```text
Líder (esLider)
→ modo docente de la app local
→ ficha del líder + lista de sus estudiantes (acotada a esa ficha)
→ verifica que NO haya clase activa en el dispositivo (estado local vía store.js)
→ captura en el lector DigitalPersona (capture.js, Fase 5 — PENDIENTE)
→ template (motor local fingerprint.js)
→ POST /api/enrolamiento/guardar { estudianteId, fichaId, dedo, template }
→ Backend (chequeo de duplicados) → MongoDB
```

Los mensajes `ENROLL_START/ENROLL_*` por WebSocket definidos más abajo quedan **superados** por este flujo local + REST `guardar`.

> Revisión de modelo (25/08/2026): `Ficha.instructorLiderId` no tiene índice único ni validación en la BD, por lo que un instructor **podría** quedar como líder de varias fichas a la vez — inconsistente con la regla real: un instructor puede ser instructor **común** de varias fichas, pero **Líder de una sola** a la vez.
>
> `[DECIDIDO]` — Revisión de la decisión original: se valida a **nivel de aplicación** (no con un índice de Mongo) que un instructor no sea Líder de más de una ficha.
>
> `[IMPLEMENTADO]` — Validación a nivel de aplicación (sin índice de Mongo). Ubicaciones:
> - `instructorController.importarInstructores()` — valida antes de asignar `instructorLiderId` en la importación.
> - `fichaController.createFicha()` — valida antes de crear la ficha.
> - `fichaController.updateFicha()` — valida antes de actualizar, excluyendo la ficha actual (`_id: { $ne: req.params.id }`).
> En los tres casos rechaza con `409` ("Este instructor ya es líder de la ficha {codigoFicha}. Un instructor solo puede ser líder de una ficha a la vez.") si el instructor ya es líder de otra ficha.

**Mensajes definidos `[DECIDIDO]` (payloads), `[PENDIENTE]` de implementar:**

```text
Backend → Huellero:
  ENROLL_START  { type: "ENROLL_START", estudianteId, fichaId, nombres, apellidos, dedo }
  ENROLL_CANCEL { type: "ENROLL_CANCEL", estudianteId }

Huellero → Backend:
  ENROLL_READY     { type: "ENROLL_READY", estudianteId }
  ENROLL_PROGRESS  { type: "ENROLL_PROGRESS", estudianteId, capturas }   (opcional)
  ENROLL_COMPLETE  { type: "ENROLL_COMPLETE", estudianteId, fichaId, template, dedo }
  ENROLL_ERROR     { type: "ENROLL_ERROR", estudianteId, error }
```

**Reglas confirmadas `[DECIDIDO]`:**

1. Si el dispositivo tiene una clase activa, se **rechaza** el enrolamiento ("Finalice la clase actual en ese dispositivo antes de enrolar").
2. Si el dispositivo está **desconectado**, NO se encola el enrolamiento; error inmediato ("El dispositivo no está disponible").
3. El dashboard debe mostrar el **estado de conexión** del dispositivo (derivado de las conexiones WebSocket vivas).
4. El enrolamiento ocurre **físicamente en el PC que tiene el lector**.
5. El backend almacena finalmente el template en MongoDB.

`[PENDIENTE]` — Implementar el bucle de captura de múltiples muestras en el huellero (corresponde a `capture.js`, que hoy es un stub que devuelve `null`).

# Huellas y templates

- Actualmente las huellas/templates se almacenan en **MongoDB** (campos `huellaEnrolada`, `huellaTemplate`, `fechaEnrolamiento`, `dedoEnrolado` en el modelo `Estudiante`).
- `[DECIDIDO]` — La intención futura es que el **procesamiento biométrico y el acceso al lector vivan en la aplicación local** (Opción A: enrolamiento en la app huellero).
- `[DECIDIDO]` — El backend central **no debe depender de `dpfj.dll`** una vez terminada la migración (el backend va a la nube, donde esas DLLs no existirán).
- `[PENDIENTE]` — Añadir el campo `metodo: 'HUELLA' | 'MANUAL'` al modelo `Asistencia` para auditoría.

# Estado actual

## Fase 1 — Aislamiento del motor biométrico `[IMPLEMENTADO]`

- `backend/services/fingerprint.js` fue copiado a `huellero/src/fingerprint.js`.
- La copia es **byte-idéntica** (hash SHA256 coincide).
- El original **NO fue modificado**.
- `backend/dll/` fue copiado completo a `huellero/dll/` (las **8 DLLs**).
- `huellero/package.json` usa:
  - `koffi` `^2.9.0`
  - `pngjs` `^7.0.0`
  - `"type": "module"`
- Se creó `huellero/src/verify.js` como adaptador.
- El adaptador transforma los registros locales al formato que espera el motor original: `{ _id, nombres, apellidos, huellaTemplate }`.

**Sobre `fingerprint.js`:**

- **No depende** de modelos, rutas ni servicios del backend (es autocontenido).
- Sus dependencias son: `koffi` (FFI), `pngjs` (decodificar PNG), Node built-ins (`path`, `url`) y las DLLs.
- El bootstrap de carga de DLL (resolución de `../dll`, PATH, `searchPaths`, bindings) se copió tal cual y **se deja divergir** (no se extrajo a un módulo compartido, decisión tomada porque el backend dejará de usar `dpfj.dll`).
- `verifyFingerprint` es la única función acoplada a la forma de los documentos Mongoose; por eso se creó el adaptador en el huellero **sin tocar el motor**.

## Fase 2 — Esqueleto de la aplicación Electron `[IMPLEMENTADO]`

`huellero/` pasó de ser solo dos archivos JS a una aplicación **Electron + electron-vite + Vue 3**:

- **Proceso principal** (`src/main/`):
  - `index.js` — arranque de Electron, `BrowserWindow`, registro de manejadores IPC (`huellero:getStatus`, `huellero:capture`, `huellero:login`, `huellero:logout`, `huellero:getFichaLider`, `huellero:getEstudiantesFicha`, `huellero:enrolar`).
  - `engine.js` — orquestador: `init()`, `getStatus()`, `capturarYVerificar()`, `loginDocente()`, `logoutDocente()`, `getFichaLider()`, `getEstudiantesFicha()`, `enrolarEstudiante()`, `guardarTemplate()`.
  - `config.js` — lee `config.json` (`deviceId`, `token`, `backendUrl`, `wsUrl`).
  - `capture.js`, `store.js`, `sync.js` — stubs (ver sección "Pendiente"). `ws-client.js` — conecta por socket.io (`HELLO`, escucha `ACTIVATE` → `store.setClaseActiva`).
- **Preload** (`src/preload/index.js`): expone `window.huellero` vía `contextBridge` (`getStatus`, `capturarYVerificar`, `loginDocente`, `logoutDocente`, `getFichaLider`, `getEstudiantesFicha`, `enrolarEstudiante`, `onStatus`).
- **Renderer** (`src/renderer/src/`):
  - `App.vue` — cambia entre vistas `kiosko`, `login` y `docente`.
  - `KioskoView.vue` — pantalla principal del lector (estado online/clase activa, botón "Leer huella").
  - `DocenteLogin.vue` — formulario de acceso docente.
  - `DocenteView.vue` — panel del docente; botón "Registrar huella" visible solo si `esLider`.
  - `EnrolarHuellaModal.vue` — modal de enrolamiento (ficha del líder + buscador de estudiantes + dedo + captura).
- `electron.vite.config.js` — copia las DLLs de `huellero/dll/` a `out/dll/` al compilar.

## Acceso docente (login) `[IMPLEMENTADO]`

- `engine.loginDocente(correo, password)` hace `fetch POST /api/auth/login` al backend.
- Valida que la respuesta sea `usuario.rol === 'Instructor'` (rechaza otros roles con error).
- Guarda en memoria: `{ id, correo, nombre, rol, esLider, rolDetallado }`.
- Sin conexión devuelve error ("Sin conexión: no se puede validar el acceso docente").
- En el kiosko se abre con `Ctrl+Shift+L` o con el botón ⚙.

## Enrolamiento (modal docente) `[IMPLEMENTADO]` (captura en stub)

- Solo visible si `esLider === true` (`DocenteView.vue`).
- `engine.getFichaLider()` → `GET /api/fichas/mis-fichas/:instructorId` (filtra `esLider`), y `engine.getEstudiantesFicha(fichaId)` → `GET /api/estudiantes?fichaId=`.
- `engine.enrolarEstudiante()` rechaza si hay clase activa en el dispositivo (estado local de `store.js`), luego captura (stub Fase 5) y guardaría vía `POST /api/enrolamiento/guardar` (chequeo de duplicados en backend).

## Identidad del dispositivo (Fase 3) `[IMPLEMENTADO]`

- `backend/models/Dispositivo.js` — `deviceId` (unique), `tokenHash`, `nombre`, `activo`, `createdAt`. El token **nunca** se guarda en claro; solo su hash.
- `POST /api/dispositivos/registrar` (`backend/controllers/dispositivoController.js`) — genera `deviceId` (`crypto.randomUUID()`) + `token` (`crypto.randomBytes(32)`) y guarda el hash (`bcryptjs.hash`). Devuelve `{ deviceId, token }` **una sola vez** en texto plano.
- Regla de dependencias: se usa **`bcryptjs` (JS puro)**, nunca `bcrypt` (binding nativo). `[DECIDIDO]`
- `huellero/src/main/config.js`:
  - `saveConfig()` ahora **persiste** en `config.json` (`writeFileSync`).
  - `registrarDispositivoSiNoExiste()` hace `POST /registrar` si no hay identidad y guarda el resultado.
  - `iniciarRegistroDispositivo(cb)` + `intentarRegistro()`: **reintento cada 60 s** si falla; se detiene solo al tener éxito y notifica (`cb`) al proceso principal.

## Arranque no bloqueante `[IMPLEMENTADO]`

- `main/index.js`: `createWindow()` y `broadcastStatus()` se ejecutan **antes** de `await engine.init()`; el registro del dispositivo corre en background y no retrasa la aparición de la ventana.
- `engine.init()` ya no espera el registro: `iniciarRegistroDispositivo` es fire-and-forget, y al éxito re-ejecuta `ws.connect(getConfig())` y emite estado.
- `engine.getStatus()` incluye `dispositivoRegistrado`; `KioskoView.vue` muestra "Equipo no identificado. Reintentando conexión…" cuando es `false` (estado neutro, distinto de "Sin conexión").

## Autenticación del WebSocket HELLO (Fase 6, parcial) `[IMPLEMENTADO]`

- `backend/services/socketService.js`: el `HELLO` ahora exige `{ deviceId, token }`; busca el `Dispositivo`, valida `activo`, y compara con `bcryptjs.compare(token, tokenHash)`. Rechaza (desconecta + `console.log` para auditoría) si faltan campos, no existe, está inactivo o el token no coincide.
- `huellero/src/main/ws-client.js`: emite `HELLO { deviceId, token }` y solo conecta si hay ambos.

## Pendiente (stubs) `[PARCIAL]` / `[PENDIENTE]`

- `capture.js` (Fase 5): `capturarHuella()` devuelve `null`; **no hay captura DigitalPersona real**.
- `ws-client.js` (Fase 6): HELLO autenticado y recibe `ACTIVATE`, pero **sin DEACTIVATE, acks ni reenvío de pendientes al reconectar**.
- `sync.js` (Fase 10): **sincronización no implementada**.

Consecuencia: `capturarYVerificar()` y el enrolamiento siempre fallan con "Captura de huella no disponible aún", porque la captura es stub y `getPlantillasFicha()` devuelve `[]`.

# Estructura actual de huellero

```text
huellero/
├── package.json             # electron, electron-vite, vue, koffi, pngjs; "type": "module"
├── electron.vite.config.js  # copia las DLLs a out/dll al compilar
├── dll/                     # 8 DLLs nativas DigitalPersona
└── src/
    ├── fingerprint.js       # motor copiado (byte-idéntico al backend)
    ├── verify.js            # adaptador: registros locales → formato del motor
    ├── main/                # proceso principal Electron
    │   ├── index.js         # arranque, ventana, IPC
    │   ├── engine.js        # orquestador (estado, login, captura + verificación)
    │   ├── config.js        # config.json (deviceId, token, backendUrl, wsUrl) — persistencia + reintento
    │   ├── capture.js       # stub — captura DigitalPersona (Fase 5)
    │   ├── store.js         # persistencia data/*.json (Fase 4)
    │   ├── sync.js          # stub — sincronización (Fase 10)
    │   └── ws-client.js     # socket.io + HELLO autenticado (Fase 6, parcial)
    ├── preload/
    │   └── index.js         # contextBridge → window.huellero
    └── renderer/
        ├── index.html
        └── src/
            ├── main.js
            ├── App.vue
            ├── style.css
            └── views/
                ├── KioskoView.vue
                ├── DocenteLogin.vue
                ├── DocenteView.vue
                └── EnrolarHuellaModal.vue
```

# Almacenamiento local

`[IMPLEMENTADO]` (mínimo) — `huellero/src/main/store.js` persiste en disco (`data/` al lado de `config.json`):

- `init()` crea los 3 archivos si no existen y los carga a memoria.
- `setClaseActiva()`, `guardarPendiente()` y `marcarSincronizadas()` escriben en memoria **y** en disco.
- La clase activa **sobrevive el reinicio** (se lee de `estado.json` al arrancar).

Arquitectura de archivos:

```text
data/
├── plantillas.json    # plantillas de las fichas atendidas (solo lo necesario)
├── pendientes.json    # asistencias que aún no pudieron sincronizarse
└── estado.json        # estado local necesario (ficha activa, etc.)
```

- `plantillas.json`: contiene únicamente lo necesario para las fichas que atiende el dispositivo (nunca toda la BD central).
- `pendientes.json`: cola de asistencias no sincronizadas.
- `estado.json`: estado local necesario para operar.

# Funcionamiento offline

`[DECIDIDO]`:

- La aplicación local puede registrar asistencias **sin conexión** al servidor.
- Las asistencias pendientes se guardan **localmente**.
- Cada asistencia debe tener un **UUID único** para permitir sincronización **idempotente**.
- El backend debe **evitar duplicados**.
- Al recuperar la conexión puede realizarse la sincronización.

**Importante `[DECIDIDO]`:**

- La pérdida de conexión **NO** significa que una nueva clase pueda activarse automáticamente.
- La activación de una clase **siempre** depende de una orden válida del backend.
- El almacenamiento/caché offline sirve para **continuar operaciones que ya fueron autorizadas/activadas** y para almacenar asistencias pendientes.
- Si el profesor no puede usar el huellero, puede **registrar asistencia manualmente** desde su dashboard (`metodo: "MANUAL"` vs `"HUELLA"`).

# Sincronización

`[DECIDIDO]` — Regla definitiva:

- A las **12:00 AM** debe ejecutarse **obligatoriamente** un intento de sincronización hacia el servidor.
- Si el servidor está caído o no hay conexión:
  - Las asistencias **permanecen pendientes**.
  - El servicio **continúa comprobando periódicamente** la conexión.
  - Cuando se recupere la conexión, **sincroniza las pendientes**.
  - Debe **evitar duplicados** mediante UUID/idempotencia.
- El cron de las 12:00 AM **no es el único** mecanismo de sincronización.

`[PENDIENTE]` — Método exacto de **backoff** para los reintentos (intervalo fijo vs. exponencial) todavía no está decidido.

# Comunicación

`[DECIDIDO]` — Arquitectura prevista:

- **REST**: acciones de negocio y consultas.
- **WebSocket**: comunicación en tiempo real Backend ↔ Huellero, y Backend ↔ Dashboard.

## REST (`[IMPLEMENTADO]` parcial)

```text
POST /api/clases/activar            [IMPLEMENTADO] { deviceId, fichaId, instructorId }
POST /api/clases/finalizar          [PENDIENTE]  { fichaId, instructorId }
GET  /api/clases/estado             [PENDIENTE]  (restaurar estado al recargar el dashboard)
POST /api/dispositivos/registrar    [IMPLEMENTADO] { nombre? } → { deviceId, token } (hash bcryptjs; token solo en esta respuesta)
GET  /api/dispositivos              [PENDIENTE]  (listado admin)
PUT  /api/dispositivos/:id/fichas   [PENDIENTE]  (admin: agregar/quitar fichas)
GET  /api/fichas/:id/plantillas     [PENDIENTE]  (plantillas de la ficha, para caché local)
POST /api/asistencias/sync          [PENDIENTE]  (sincronización idempotente)
POST /api/enrolamiento/guardar      [IMPLEMENTADO] { estudianteId, fichaId, dedo, template }
```

## WebSocket (`[IMPLEMENTADO]` parcial)

```text
Backend → Huellero:
  ACTIVATE [IMPLEMENTADO] / DEACTIVATE [PENDIENTE]
  ENROLL_START / ENROLL_CANCEL       (superados: el enrolamiento es local + REST guardar)
  SYNC_ACK [PENDIENTE]

Huellero → Backend:
  HELLO (deviceId + token)            [IMPLEMENTADO] (autenticado: bcryptjs.compare contra tokenHash)
  ACTIVATED / DEACTIVATED             [PENDIENTE] (acks)
  ATTENDANCE_REGISTERED               [PENDIENTE] { fichaId, estudianteId, fecha, hora, metodo }
  ENROLL_READY / ENROLL_PROGRESS / ENROLL_COMPLETE / ENROLL_ERROR   (superados)
  SYNC_PUSH                           [PENDIENTE] { pendientes: [...] }
  PING / PONG (heartbeat)             [PENDIENTE]

Backend → Dashboard:
  CLASS_ACTIVATED / CLASS_DEACTIVATED { fichaId, instructorId }
  DEVICE_CONNECTED / DEVICE_DISCONNECTED { deviceId, fichas }
  ATTENDANCE_REGISTERED               { fichaId, estudianteId, hora, contador }
  ENROLL_STARTED / ENROLL_PROGRESS / ENROLL_COMPLETED / ENROLL_FAILED
  SYNC_COMPLETED                      { procesados }
```

`[PENDIENTE]` — Mecanismo de autenticación del WebSocket del dashboard (actualmente el frontend no usa JWT; guarda `user_data` en `sessionStorage`).

# Empaquetado

- `[DECIDIDO]` — La aplicación local eventualmente será empaquetada como **`.exe`**.
- `[DECIDIDO]` — El empaquetado **NO se está haciendo todavía**. Primero debe funcionar correctamente como aplicación Node independiente.
- `[PENDIENTE]` — Resolver el empaquetado y las **rutas de las DLLs** (el bootstrap usa `path.resolve(__dirname, '../dll')`, que puede cambiar al empaquetar).
- `[IMPLEMENTADO]` — `electron.vite.config.js` copia las DLLs de `huellero/dll/` a `out/dll/` al compilar, y `package.json` (`build.extraResources`) las incluye como recurso para el `.exe`.

# Fases de desarrollo

| # | Fase | Estado |
|---|---|---|
| 1 | Aislar `fingerprint.js` | ✅ Implementada |
| 2 | Esqueleto Electron + UI (kiosko, login docente) | ✅ Implementada (verificación koffi/dpfj.dll aún sin confirmar con captura real) |
| 3 | Configuración e identidad del dispositivo (deviceId + token) | ✅ Implementada — registro, persistencia en `config.json`, reintento |
| 4 | Almacenamiento local (`data/*.json`) | ✅ Implementada — `store.js` persiste en disco |
| 5 | Captura DigitalPersona | `[PENDIENTE]` — `capture.js` es stub |
| 6 | WebSocket (cliente huellero + hub backend) | `[PARCIAL]` — HELLO autenticado + ACTIVATE; faltan DEACTIVATE/acks/heartbeat |
| 7 | Activación/desactivación remota | `[PENDIENTE]` |
| 8 | Enrolamiento remoto | `[PENDIENTE]` |
| 9 | Registro de asistencias | `[PENDIENTE]` |
| 10 | Sincronización offline/online | `[PENDIENTE]` — `sync.js` es stub |
| 11 | Pruebas de recuperación y duplicados | `[PENDIENTE]` |
| 12 | Empaquetado `.exe` | `[PENDIENTE]` |

# Decisiones descartadas

`[DECIDIDO]` — Explícitamente descartado:

- No usar **MAC** como identidad/autenticación.
- No **rehacer el proyecto** desde cero.
- No mezclar la **administración del sistema** dentro de la aplicación local.
- No permitir **múltiples dispositivos asociados simultáneamente** a una misma ficha.
- No activar automáticamente una ficha solo porque el dispositivo esté **offline**.
- No depender **exclusivamente** del cron de las 12:00 AM para sincronizar.
- No empaquetar como `.exe` antes de probar la aplicación Node.
- No extraer el bootstrap de carga de DLL a un módulo compartido (por ahora se copia y diverge).

# Reglas para futuras modificaciones

Cualquier IA (o persona) que continúe trabajando en este proyecto debe:

1. Leer primero este archivo antes de modificar código relacionado con el huellero.
2. Revisar el código existente antes de crear implementaciones nuevas.
3. Reutilizar código existente cuando sea posible.
4. No eliminar funcionalidades existentes sin comprobar dependencias.
5. No modificar el backend original innecesariamente.
6. No asumir que una funcionalidad está implementada solo porque aparece en este documento.
7. Diferenciar entre `[DECIDIDO]`, `[IMPLEMENTADO]` y `[PENDIENTE]`.
8. Antes de hacer cambios grandes, explicar qué archivos modificará y por qué.
9. Hacer cambios pequeños y verificables.
10. No continuar automáticamente a una fase posterior si la fase actual falla.
11. No inventar endpoints, modelos o estructuras que no hayan sido confirmados.
12. Mantener este documento actualizado cuando cambien decisiones importantes.
