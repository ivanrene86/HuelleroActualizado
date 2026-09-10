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

`[IMPLEMENTADO]` — Modelo `Clase` (`deviceId`, `fichaId`, `instructorId`, `estado`, `iniciadaAt`, `finalizadaAt`) y endpoint `POST /api/clases/activar`, que crea/reactiva la clase y envía `ACTIVATE` por WebSocket al `deviceId` conectado.
`[IMPLEMENTADO]` — Reenvío del `ACTIVATE` pendiente al reconectar: al recibir un `HELLO` válido, si existe una clase `Activa` en BD para ese `deviceId`, el backend reenvía `ACTIVATE` al socket recién conectado.
`[IMPLEMENTADO]` (2026-09-08) — `POST /api/clases/finalizar` (`DEACTIVATE`): busca la clase `Activa`, la pasa a `Finalizada` y emite `DEACTIVATE` al `deviceId` (resuelto desde el documento, no del body).
`[IMPLEMENTADO]` (2026-09-08) — Invariante "una clase activa por dispositivo": `activar()` usa `findOneAndUpdate` atómico (upsert) + índice parcial único sobre `{deviceId, estado:'Activa'}`, con manejo del `E11000`.
`[IMPLEMENTADO]` (2026-09-08) — Autenticación de `activar`/`finalizar`: `autenticarJWT` en ambas rutas + validación de identidad (`req.usuario.id` === `instructorId` del body) → 403 si no coincide.
`[IMPLEMENTADO]` (2026-09-08) — `GET /api/clases/estado` (restaurar estado al recargar el dashboard): `Clase.findOne({ instructorId: req.usuario.id, estado: 'Activa' }).populate('fichaId')`, protegido con `autenticarJWT`.
`[IMPLEMENTADO]` (2026-09-08) — Eventos hacia el dashboard: `CLASS_ACTIVATED`/`CLASS_DEACTIVATED` (sala `ficha_<fichaId>`) al activar/finalizar, y `ATTENDANCE_REGISTERED` al guardar una asistencia real en `procesarAsistencia` (cubre sync online y offline).
`[PENDIENTE]` — Acks `ACTIVATED`/`DEACTIVATED`.

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

**Mensajes definidos `[DECIDIDO]` (payloads), `[IMPLEMENTADO]` ACTIVATE y DEACTIVATE:**

```text
Backend → Huellero:
  ACTIVATE   { type: "ACTIVATE",   fichaId, instructorId }
  DEACTIVATE { type: "DEACTIVATE", fichaId, instructorId }
```

`[IMPLEMENTADO]` (2026-09-08) — `POST /api/clases/activar` ya **no** recibe `deviceId` en el body: recibe `{ fichaId, instructorId }` y resuelve internamente el `deviceId` desde `Ficha.dispositivoId` (asociación dispositivo↔ficha implementada en el backend).

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

`[IMPLEMENTADO]` (2026-09-07) — Bucle de captura de múltiples muestras para enrolamiento implementado en `engine.enrolarEstudiante()` (loop `capturarHuella()` + `addCapture()` hasta que el motor confirma `ready:true`).

# Huellas y templates

- Actualmente las huellas/templates se almacenan en **MongoDB** (campos `huellaEnrolada`, `huellaTemplate`, `fechaEnrolamiento`, `dedoEnrolado` en el modelo `Estudiante`).
- `[DECIDIDO]` — La intención futura es que el **procesamiento biométrico y el acceso al lector vivan en la aplicación local** (Opción A: enrolamiento en la app huellero).
- `[DECIDIDO]` — El backend central **no debe depender de `dpfj.dll`** una vez terminada la migración (el backend va a la nube, donde esas DLLs no existirán).
- `[PENDIENTE]` — Añadir el campo `metodo: 'HUELLA' | 'MANUAL'` al modelo `Asistencia` para auditoría.

> **[DECIDIDO/ACLARACIÓN] (2026-09-07) — Estado real del flujo Web SDK del navegador** (`PanelInstructor.vue`, `KioscoAsistencia.vue`, rutas `/estudiantes/enroll-*`, `/estudiantes/verify`):
>
> - El código de este flujo **SIGUE PRESENTE** en el repositorio (no fue eliminado) y sigue siendo técnicamente alcanzable.
> - Sin embargo, confirmado con el equipo: **NO se usa en producción real hoy**. No hay instructores usándolo activamente con estudiantes reales.
> - Por lo tanto, es **código presente pero inactivo en la práctica** — no código muerto en sentido estricto (podría reactivarse), pero tampoco la vía de producción actual.
>
> **Nota técnica relacionada:** este flujo usa el mismo hardware físico (U.are.U 4500, 700 DPI nativo confirmado vía `dpfpdd_get_device_capabilities`) que el huellero, y llama a la misma función `pngToFmd()` con el default `dpi=500` sin pasar el valor real. Si en algún momento se decide reactivar este flujo del navegador, debe evaluarse si el Web SDK (`Fingerprint.WebApi`) entrega las imágenes ya normalizadas a 500 DPI internamente (en cuyo caso el default actual sería correcto) o si arrastra el mismo mismatch de DPI que se corrigió para el huellero (en cuyo caso habría que pasar el DPI real ahí también). Esto **NO se investigó todavía** — queda como `[PENDIENTE]` si el flujo llega a reactivarse en el futuro.

# Estado actual

## Fase 1 — Aislamiento del motor biométrico `[IMPLEMENTADO]`

- `backend/services/fingerprint.js` fue copiado a `huellero/src/fingerprint.js`.
- La copia es **byte-idéntica** (hash SHA256 coincide).
- El original **NO fue modificado**.

> **Re-sincronización (2026-08-26):** el backend original recibió una corrección crítica de seguridad: el umbral de aceptación de huellas (`MATCH_THRESHOLD`) se subió de `~50%` (`0x3FFFFFFF`) a un valor cercano al `100%` (`21474`, FAR 1/100.000, configurable vía `BIOMETRIC_MATCH_THRESHOLD`). `huellero/src/fingerprint.js` fue re-sincronizado desde `backend/services/fingerprint.js` y **ambos archivos vuelven a ser byte-idénticos**. Nota: durante el merge se perdió la declaración `let MAX_FMD_SIZE = 26 + 4 + (255 * 6) + 2`; fue restaurada para evitar un `ReferenceError` y que ambos archivos coincidan.

> **Corrección de mismatch de DPI (2026-09-07):** se corrigió la inconsistencia de resolución entre captura y extracción de características. `pngToFmd()` hardcodeaba `500` DPI; ahora la resolución es **parametrizable** — `pngToFmd(pngBase64, dpi = 500)`, `addCapture(sessionId, imageBase64, dpi = 500)` y `verifyFingerprint(imageBase64, enrolledStudents, dpi = 500)` — manteniendo `500` como default para no romper los callers existentes del backend (flujo Web SDK, que no pasan valor explícito). El lector **U.are.U 4500 real solo soporta `700` DPI nativo** (confirmado vía `dpfpdd_get_device_capabilities` → `resolution_cnt = 1`, `resolutions = [700]`; `500` NO está disponible). Por eso `huellero/src/main/capture.js` captura a `700` y ahora `capturarHuella()` devuelve `{ imagen, dpi }`, propagando el `700` a través de `engine.capturarYVerificar()` → `verify.js` → `verifyFingerprint()`. La corrección se hizo **antes** de tener enrolamientos reales en producción (fase de pruebas), por lo que **no requiere migración de datos**. Tras el cambio, `backend/services/fingerprint.js` y `huellero/src/fingerprint.js` vuelven a ser **byte-idénticos**.

**Configuración biométrica — estado del umbral**

`[IMPLEMENTADO]` Estado actual del umbral de coincidencia:

- `MATCH_THRESHOLD` en `fingerprint.js` usa: `Number(process.env.BIOMETRIC_MATCH_THRESHOLD) || 21474`.
- Hoy `BIOMETRIC_MATCH_THRESHOLD` **NO está definida** ni en `backend/.env` ni en ningún config del huellero. Ambos procesos (backend y huellero) caen al mismo fallback (`21474`), por lo que **no hay divergencia actual**.
- Mecanismo de configuración asimétrico a tener en cuenta:
  - **Backend:** se ajustaría agregando la variable en `backend/.env` (vía dotenv).
  - **Huellero:** no tiene `.env` ni dotenv en el proceso main de Electron; para cambiarlo hoy habría que setear la variable a nivel del sistema operativo de cada PC individual — no hay mecanismo de configuración centralizado para esto en el huellero.
- Riesgo si se cambia en el futuro: si alguien ajusta `BIOMETRIC_MATCH_THRESHOLD` en el backend (vía `.env`) pero no lo replica correctamente en cada PC con huellero, ambos lados quedarían verificando huellas con umbrales distintos sin ningún error visible (falla silenciosa).

`[PENDIENTE]` Mejora futura sugerida:

- Leer `BIOMETRIC_MATCH_THRESHOLD` desde `config.json` en el huellero (mismo mecanismo ya usado para `deviceId`/`token`/`backendUrl`/`wsUrl` en la Fase 3), en vez de depender de una variable de entorno del sistema operativo. Esto permitiría configurar el umbral de forma consistente y versionada junto con el resto de la configuración del dispositivo, sin tocar el registro del SO en cada PC.

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
  - `capture.js` — captura DigitalPersona real (Fase 5). `store.js` — persistencia local `data/*.json`. `sync.js` — sincronización idempotente (Fase 10). `scheduler.js` — disparo 00:00 + polling. `ws-client.js` — socket.io singleton (HELLO, ACTIVATE/DEACTIVATE, reconexión).
- **Preload** (`src/preload/index.js`): expone `window.huellero` vía `contextBridge` (`getStatus`, `capturarYVerificar`, `loginDocente`, `logoutDocente`, `getFichaLider`, `getEstudiantesFicha`, `enrolarEstudiante`, `onStatus`).
- **Renderer** (`src/renderer/src/`):
  - `App.vue` — cambia entre vistas `kiosko`, `login` y `docente`.
  - `KioskoView.vue` — pantalla principal del lector (estado online/clase activa, botón "Leer huella").
  - `DocenteLogin.vue` — formulario de acceso docente.
  - `DocenteView.vue` — panel del docente; botón "Registrar huella" visible solo si `esLider`.
  - `EnrolarHuellaModal.vue` — modal de enrolamiento (ficha del líder + buscador de estudiantes + dedo + captura).
- `electron.vite.config.js` — copia las DLLs de `huellero/dll/` a `out/dll/` al compilar; fija el renderer en el puerto **5180** (`strictPort: true`) para no competir con el dashboard web (`frontend/`, puerto 5173) cuando ambos dev servers corren en paralelo.

## Fase 5 — Captura DigitalPersona `[IMPLEMENTADO]`

Captura real funcionando contra el lector físico **U.are.U 4500** mediante `huellero/dll/dpfpdd.dll` (FFI con koffi), verificado con hardware real:

- **Bindings declarados** con las firmas exactas del `dpfpdd.h` oficial (`__stdcall`): `dpfpdd_init`, `dpfpdd_query_devices`, `dpfpdd_open`, `dpfpdd_get_device_capabilities`, `dpfpdd_capture` (síncrona), `dpfpdd_close`.
- **Flujo por captura**: `query_devices` → `open` → `get_device_capabilities` (resolución) → `capture` → `close` (en `finally`). `dpfpdd_init()` se ejecuta **una sola vez** (idempotente, `inicializarCaptura()`).
- **Formato de salida**: `dpfpdd_capture` devuelve pixel buffer en escala de grises (8 bpp); `capturarHuella()` lo convierte a **PNG base64** (con `pngjs`) y devuelve `{ imagen, dpi }`.
- **Corrección de mismatch de DPI**: el 4500 solo soporta **700 DPI nativo** (confirmado vía `dpfpdd_get_device_capabilities` → `resolutions = [700]`); se parametrizó `pngToFmd()`/`addCapture()`/`verifyFingerprint()` con `dpi = 500` por defecto, y `capture.js` pasa `700`. Aplicado **antes** de tener enrolamientos reales → sin migración de datos.
- **Timeout de 10s** (`dpfpdd_capture` síncrono): al expirar sin dedo lanza `DPFPDD_QUALITY_TIMED_OUT` traducido ("Tiempo de espera agotado…"), sin colgarse.
- **Bloqueo síncrono vs WebSocket**: verificado que el bloqueo de 10s **no rompe** el socket (el `pingTimeout` del backend es 20s > 10s); no se prioriza `dpfpdd_capture_async` por ahora (queda como mejora futura opcional).
- **Herramientas**: `socket.io-client` instalado (faltaba), build de electron-vite limpio; headers oficiales del SDK (`dpfpdd.h`, `dpfj.h`) versionados en `docs/sdk-reference/`.

## Acceso docente (login) `[IMPLEMENTADO]`

- `engine.loginDocente(correo, password)` hace `fetch POST /api/auth/login` al backend.
- Valida que la respuesta sea `usuario.rol === 'Instructor'` (rechaza otros roles con error).
- Guarda en memoria: `{ id, correo, nombre, rol, esLider, rolDetallado }`.
- Sin conexión devuelve error ("Sin conexión: no se puede validar el acceso docente").
- En el kiosko se abre con `Ctrl+Shift+L` o con el botón ⚙.

## Enrolamiento (modal docente) `[IMPLEMENTADO]`

- Solo visible si `esLider === true` (`DocenteView.vue`).
- `engine.getFichaLider()` → `GET /api/fichas/mis-fichas/:instructorId` (filtra `esLider`), y `engine.getEstudiantesFicha(fichaId)` → `GET /api/estudiantes?fichaId=`.
- `engine.enrolarEstudiante()` rechaza si hay clase activa en el dispositivo (estado local de `store.js`), luego ejecuta el loop de enrolamiento: `startSession()` → `capturarHuella()` + `addCapture()` repetido hasta que el motor confirma `ready:true` → `completeEnrollment()` (template) → `POST /api/enrolamiento/guardar` (chequeo de duplicados en backend).

> **[IMPLEMENTADO] (2026-09-07) — Loop de enrolamiento verificado de punta a punta con hardware real:** login docente (con fix de autenticación JWT en `getFichaLider`) → obtención de ficha del líder → selección de estudiante → múltiples capturas reales (`dpfpdd_capture`) hasta que el motor confirma `ready:true` → generación del template (`completeEnrollment`) → guardado exitoso vía `POST /api/enrolamiento/guardar`. Confirmado en MongoDB: `huellaEnrolada:true`, `huellaTemplate` poblado, `dedoEnrolado` y `fechaEnrolamiento` correctos.

> **Bug de autenticación corregido (2026-09-07):** `getFichaLider()` no enviaba el header `Authorization` (el token del login se descartaba en `loginDocente()`), por lo que `GET /api/fichas/mis-fichas/:id` (protegido con `autenticarJWT`) respondía 401 y el modal mostraba "No se pudo obtener la ficha del líder". Corregido: `loginDocente()` ahora guarda el `token`, `getFichaLider()` lo envía como `Bearer`, y un 401 dispara auto-logout + aviso temporal en el kiosko (`KioskoView.vue`), sin afectar el logout manual.

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

## Pendiente `[PENDIENTE]`

- `ws-client.js` (Fase 6): HELLO autenticado, reconexión backoff 2s→60s, escucha `ACTIVATE` y `DEACTIVATE`; el backend ya envía ambos. Faltan solo los **acks** (`ACTIVATED`/`DEACTIVATED`). `[PARCIAL]`
- `npm audit` (huellero/): **13 vulnerabilidades** — 1 crítica, 10 altas, 2 moderadas — en dependencias de build/empaquetado (`tar` crítica vía electron-builder; `vite`/`esbuild`/`electron`/`extract-zip` altas). `[PENDIENTE]` — sin prisa pero sin olvidarlo; la corrección requiere `npm audit fix --force` con cambios breaking (electron@44, electron-builder@26).

Consecuencia: captura, enrolamiento, identificación y sincronización ya funcionan de punta a punta (verificado con hardware real).

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
    │   ├── capture.js       # captura DigitalPersona real (Fase 5, implementada)
    │   ├── store.js         # persistencia data/*.json (Fase 4)
    │   ├── sync.js          # sincronización idempotente de pendientes (Fase 10)
    │   ├── scheduler.js     # disparo 00:00 + polling 5min + reconexión/nuevo pendiente
    │   └── ws-client.js     # socket.io singleton (HELLO, ACTIVATE/DEACTIVATE, reconexión 2s→60s)
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

`[DECIDIDO]` — Backoff de reintentos de sync: polling fijo de 5 min para el backlog offline (no tiempo real). La reconexión del WebSocket usa backoff exponencial 2s→60s (independiente del sync). `[IMPLEMENTADO]`

# Comunicación

`[DECIDIDO]` — Arquitectura prevista:

- **REST**: acciones de negocio y consultas.
- **WebSocket**: comunicación en tiempo real Backend ↔ Huellero, y Backend ↔ Dashboard.

## REST (`[IMPLEMENTADO]` parcial)

```text
POST /api/clases/activar            [IMPLEMENTADO] { fichaId, instructorId } (JWT + identidad; resuelve deviceId desde Ficha.dispositivoId)
POST /api/clases/finalizar          [IMPLEMENTADO] { fichaId, instructorId } (JWT + identidad)
GET  /api/clases/estado             [IMPLEMENTADO]  (restaurar estado al recargar el dashboard; JWT)
POST /api/dispositivos/registrar    [IMPLEMENTADO] { nombre? } → { deviceId, token } (hash bcryptjs; token solo en esta respuesta)
GET  /api/dispositivos              [IMPLEMENTADO] (listado admin, con fichas asociadas)
PUT  /api/dispositivos/:id/fichas   [IMPLEMENTADO] (admin: reemplaza el conjunto de fichas del dispositivo)
GET  /api/fichas/:id/plantillas     [IMPLEMENTADO] (plantillas de la ficha, para caché local; auth deviceId+token)
POST /api/asistencias/sync          [IMPLEMENTADO] { deviceId, token, asistencias:[{uuid,...}] } (idempotente por uuid)
POST /api/enrolamiento/guardar      [IMPLEMENTADO] { estudianteId, fichaId, dedo, template }
```

## WebSocket (`[IMPLEMENTADO]` parcial)

```text
Backend → Huellero:
  ACTIVATE [IMPLEMENTADO] / DEACTIVATE [IMPLEMENTADO]
  ENROLL_START / ENROLL_CANCEL       (superados: el enrolamiento es local + REST guardar)
  SYNC_ACK [PENDIENTE]

Huellero → Backend:
  HELLO (deviceId + token)            [IMPLEMENTADO] (autenticado: bcryptjs.compare contra tokenHash)
  ACTIVATED / DEACTIVATED             [PENDIENTE] (acks)
  ATTENDANCE_REGISTERED               (superado: el backend emite este evento al dashboard desde el sync REST; ver Backend → Dashboard)
  ENROLL_READY / ENROLL_PROGRESS / ENROLL_COMPLETE / ENROLL_ERROR   (superados)
  SYNC_PUSH                           [PENDIENTE] { pendientes: [...] }
  PING / PONG (heartbeat)             [IMPLEMENTADO] — nativo de socket.io (pingInterval 25s / pingTimeout 20s), sin PING/PONG manual

Backend → Dashboard:
  CLASS_ACTIVATED / CLASS_DEACTIVATED [IMPLEMENTADO] { fichaId, instructorId, iniciadaAt }
  ATTENDANCE_REGISTERED               [IMPLEMENTADO] { fichaId, estudianteId, nombres, apellidos, hora, estado }
  DEVICE_CONNECTED / DEVICE_DISCONNECTED [PENDIENTE] { deviceId, fichas }
  ENROLL_STARTED / ENROLL_PROGRESS / ENROLL_COMPLETED / ENROLL_FAILED
  SYNC_COMPLETED                      [PENDIENTE] { procesados }
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
| 2 | Esqueleto Electron + UI (kiosko, login docente) | ✅ Implementada — verificación koffi/dpfj.dll confirmada con captura real |
| 3 | Configuración e identidad del dispositivo (deviceId + token) | ✅ Implementada — registro, persistencia en `config.json`, reintento |
| 4 | Almacenamiento local (`data/*.json`) | ✅ Implementada — `store.js` persiste en disco |
| 5 | Captura DigitalPersona | ✅ Implementada — captura real vía `dpfpdd.dll` (síncrona, timeout 10s), DPI parametrizado (700) |
| 6 | WebSocket (cliente huellero + hub backend) | `[PARCIAL]` — HELLO autenticado + ACTIVATE/DEACTIVATE + reconexión con backoff + reenvío de ACTIVATE pendiente; faltan los acks (ACTIVATED/DEACTIVATED) |
| 7 | Activación/desactivación remota | ✅ Implementada (2026-09-08) — `activar`/`finalizar` (DEACTIVATE) |
| 8 | Enrolamiento remoto | ✅ Implementada — enrolamiento **local** desde la app (supera el flujo remoto por WebSocket) |
| 9 | Registro de asistencias | ✅ Implementada (2026-09-08) — identificación + registro + sync, verificado con hardware real |
| 10 | Sincronización offline/online | ✅ Implementada — `sync.js` + `POST /api/asistencias/sync` + `scheduler.js` (00:00 + polling 5 min) |
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

# ROADMAP — Próximos pasos y pendientes

> Consolidado de **todo lo que falta** para completar la app del huellero, en un solo lugar.
> Estados verificados contra el código el **2026-09-08** (re-verificados para esta consolidación; no asumidos).

**Avance reciente (2026-09-08):** el ciclo completo del huellero está implementado y verificado contra hardware real — enrolamiento, identificación, registro de asistencia, sincronización offline/online (`sync.js` + `scheduler.js` + `POST /api/asistencias/sync` idempotente) y gestión de clases activas (`activar`/`finalizar` con `DEACTIVATE`, invariante atómica con índice parcial único, y autenticación JWT + validación de identidad en ambos endpoints). La asociación dispositivo↔ficha también está completa (backend + UI `PanelDispositivos.vue`). Quedan pendientes (categorías 2, 5 y 6): acks del protocolo WS, `GET /api/clases/estado`, el índice único de asistencias, la migración del estado visual del instructor, `npm audit`, y el empaquetado `.exe`. El **2026-09-10** se corrigieron dos bugs de sincronización de estado: (1) la reconciliación de `HELLO` ahora siempre emite `ACTIVATE` o `DEACTIVATE` (limpiaba la "clase fantasma" local del huellero si el `DEACTIVATE` se perdió offline), y (2) `activar()` dejó de usar `String(ficha.dispositivoId)` (el ObjectId del Dispositivo) como `deviceId` y ahora resuelve `Dispositivo.findById(...).deviceId` (el UUID real), con 3 documentos históricos con `deviceId` incorrecto confirmados y el único `Activa` corregido manualmente.

## 1. Registro de asistencia real `[IMPLEMENTADO]`

El ciclo completo de toma de asistencia ya funciona de punta a punta y fue verificado con hardware real (Gabriel Arias identificado y asistencia registrada en Mongo):

- `GET /api/fichas/:id/plantillas` implementado (`backend/routes/fichas.js` + `fichaController.getPlantillasFicha`), protegido con auth `deviceId`+`token` (headers `x-device-id`/`x-device-token`).
- Descarga y cacheo local implementado: `store.guardarPlantillasFicha()` (`huellero/src/main/store.js`), disparado al recibir `ACTIVATE`, al reconectar (HELLO) y al capturar sin plantillas cacheadas (`engine.descargarPlantillas()` con reintento 60s + guard anti-concurrencia).
- `capturarYVerificar()` captura, identifica y guarda localmente (`uuid`, anti-duplicado 2 min, `metodo:'HUELLA'`); `sync.js`/`scheduler.js` suben vía `POST /api/asistencias/sync` (idempotente).

## 2. Robustez del ciclo de clases activas `[PARCIAL]`

- **DEACTIVATE / `POST /api/clases/finalizar`**: implementado (2026-09-08). `claseController.finalizar()` busca la clase `Activa` (por `fichaId`+`instructorId`), la pasa a `Finalizada` (`finalizadaAt`) y emite `DEACTIVATE` vía `socketService.emitirDesactivacion()` al `deviceId` resuelto desde el documento. `[IMPLEMENTADO]`
- **Invariante "una clase activa por dispositivo"**: implementada (2026-09-08). `claseController.activar()` usa `findOneAndUpdate` atómico (upsert) + índice parcial único en `Clase` (`{deviceId:1}`, `partialFilterExpression:{estado:'Activa'}`) + manejo del `E11000`. `[IMPLEMENTADO]`
- **Autenticación de `activar`/`finalizar`**: implementada (2026-09-08). Ambas rutas usan `autenticarJWT` y validan que `req.usuario.id === instructorId` del body (403 si no coincide); probado en vivo (401 sin token, 403 con instructorId de otro). `[RESUELTO]`
- **Estado visual del instructor**: `[IMPLEMENTADO]` (2026-09-08). `PanelInstructor.vue` migró del flujo viejo de socket: se eliminó el listener `estado_sesion` (causaba desincronización al sobrescribir con `false`), se reemplazó `docente:nueva_marcacion` por `ATTENDANCE_REGISTERED`, y se agregaron `CLASS_ACTIVATED`/`CLASS_DEACTIVATED` + restauración vía `GET /api/clases/estado` al montar. Verificado en navegador real: sincronización en vivo entre pestañas y restauración de estado al recargar.
- **Ventana de carrera en el anti-duplicado de asistencias**: `procesarAsistencia` usa `findOneAndUpdate` con upsert sobre `(estudianteId, fichaId, fecha)`, pero **sin un índice único real** a nivel de MongoDB sobre esos tres campos. Dos requests verdaderamente concurrentes (con uuid distintos) podrían insertar dos documentos `Asistencia` para el mismo estudiante/ficha/día. Mitigado en la práctica por: (a) el anti-duplicado de 2 min en el huellero (Map `ultimasAsistencias`, `engine.js`) que evita la mayoría de casos reales, y (b) que un solo estudiante solo puede estar frente a un lector a la vez (menor probabilidad de concurrencia real). Resolver agregando `Asistencia.index({estudianteId:1, fichaId:1, fecha:1}, {unique:true})` — requiere primero limpiar/consolidar duplicados históricos existentes en la BD, si los hay, antes de crear el índice (o Mongo rechazará crearlo). `[PENDIENTE]`
- **Acks `ACTIVATED`/`DEACTIVATED`**: diseñados, nunca implementados. `[PENDIENTE]`
- `[IMPLEMENTADO 2026-09-10]` — Reconciliación completa en el handler de `HELLO` (`socketService.js`): antes solo emitía `ACTIVATE` si había una Clase activa para el `deviceId`, quedándose en silencio si no la había — dejando al huellero con estado local obsoleto (`data/estado.json`) si el `DEACTIVATE` se perdió mientras estaba desconectado. Ahora siempre reconcilia: `ACTIVATE` si hay `Activa`, `DEACTIVATE` (reutilizando `emitirDesactivacion`) si no la hay.

## 3. Sincronización offline/online (Fase 10) `[IMPLEMENTADO]`

- `huellero/src/main/sync.js`: sincroniza contra `POST /api/asistencias/sync`, idempotente por `uuid`, y elimina de la cola local solo lo confirmado (`guardada`/`duplicada`). `[IMPLEMENTADO]`
- `huellero/src/main/scheduler.js`: disparo obligatorio a las 00:00 + polling cada 5 min (mientras haya pendientes) + intento inmediato al reconectar/guardar nuevo pendiente. `[IMPLEMENTADO]`
- Mecanismo de reintentos (sync): **decidido** — polling fijo de 5 min para el backlog offline (no tiempo real). `[DECIDIDO]`
- Backoff de **reconexión WebSocket** (`huellero/src/main/ws-client.js`): exponencial 2s→60s (`reconnectionDelay`/`reconnectionDelayMax`), distinto del polling de sync. `[IMPLEMENTADO]`
- `POST /api/asistencias/sync`: implementado (auth `deviceId`+`token`, idempotente por `uuid`, resultados por ítem). `[IMPLEMENTADO]`
- **Fase 11 (pruebas de recuperación y duplicados)**: aún `[PENDIENTE]` — el código de sync e idempotencia está, pero no se han ejecutado pruebas formales de recuperación tras caída ni de duplicados masivos.

## 4. Administración: asociación dispositivo↔ficha `[IMPLEMENTADO]`

- **Backend `[IMPLEMENTADO]` (2026-09-08)**: `Ficha.dispositivoId` (`Ficha.js`), `GET /api/dispositivos` y `PUT /api/dispositivos/:id/fichas` (`dispositivoController.js` + `routes/dispositivos.js`, rol Admin). `asociarFichas()` trata el array recibido como el conjunto **completo** (reemplazo total: desasocia las fichas que ya no vienen). `POST /api/clases/activar` resuelve `deviceId` desde `fichaId`.

> `[CORREGIDO 2026-09-10]` — Bug crítico encontrado: `activar()` usaba `String(ficha.dispositivoId)` directamente como `deviceId`, pero ese campo es el **`_id` de MongoDB del documento `Dispositivo` (ObjectId)**, NO el UUID real (`Dispositivo.deviceId`). Esto causaba que las clases se crearan "Activa" en BD con un `deviceId` que nunca coincidía con el UUID real usado por el WebSocket (`dispositivosConectados`) — el `ACTIVATE` nunca llegaba al huellero correcto, y la reconciliación de `HELLO` tampoco las encontraba, dejando clases "fantasma" activas en BD indefinidamente. Fix: `activar()` ahora hace `Dispositivo.findById(ficha.dispositivoId)` y usa `dispositivo.deviceId` (UUID real). Se encontraron y confirmaron 3 documentos `Clase` históricos con este problema (2 ya `Finalizada`, sin impacto; 1 `Activa`, corregida manualmente a `Finalizada`). Verificado end-to-end con hardware real tras el fix (huellero mostró "Clase activa · Ficha 3139318" correctamente).

- **UI `[IMPLEMENTADO]` (2026-09-08)**: sección "Dispositivos" en el dashboard de Admin (`PanelDispositivos.vue` + `App.vue`), con listado, selector de fichas, indicador de movimiento ("⚠️ se moverá desde…") y guardado; verificado end-to-end.

## 5. Calidad y mantenimiento (sin urgencia, no olvidar)

- **npm audit (`huellero/`)**: 13 vulnerabilidades — 1 crítica, 10 altas, 2 moderadas — en dependencias de build/empaquetado (`tar` crítica vía electron-builder; `vite`/`esbuild`/`electron`/`extract-zip` altas). Requiere `npm audit fix --force` con breaking (electron@44, electron-builder@26). `[PENDIENTE]`
- **Migrar `dpfpdd_capture` (síncrona) → `dpfpdd_capture_async`**: opcional. El bloqueo de 10s se confirmó tolerable (no rompe el WS), pero sigue siendo mejora de UX. `[PENDIENTE]`
- **Contraseñas en texto plano de Admin/Instructor**: **mayormente resuelto** (verificado 2026-09-07, re-verificado 2026-09-08). El Admin por defecto se crea con bcrypt y hay auto-migración texto plano→bcrypt en `backend/index.js:81-97`; los controllers de Instructor hashean. Detalle de la auto-migración (`backend/index.js:92`): solo chequea `$2a$`/`$2b$` (no `$2y$`, que de todas formas es imposible con `bcryptjs`), y **solo migra al Admin por defecto en el arranque**; los Instructores se migran de forma perezosa en su propio login vía `verifyAndUpgradePassword` (`passwordService.js`). Matiz residual: el modelo `Instructor` (`backend/models/Instructor.js:11`) declara `password: { default: 'sena2026' }` en claro, latente solo si se usa el modelo fuera de los controllers (hoy nunca dispara: los dos puntos de creación siempre fijan password hasheado). `[RESUELTO con matiz]`
- **Campo `metodo: 'HUELLA' | 'MANUAL'`** en `Asistencia`: **agregado** (junto con `uuid` único sparse, al implementar `POST /api/asistencias/sync`). `[IMPLEMENTADO]`
- **Idempotencia de `Asistencia.uuid`** `[VERIFICADO 2026-09-08]`: garantizada por índice único real en MongoDB (`unique: true, sparse: true`, `Asistencia.js:13`) + catch del error `E11000` en el sync (`asistenciaController.js:165-168`), no solo por el `findOne` previo (que es únicamente una optimización). Única salvedad a vigilar: si algún entorno tuviera `autoIndex: false` o el índice no llegó a crearse en una colección preexistente, la garantía se perdería — no es el caso hoy, pero vale la pena confirmar el índice si se detectan asistencias duplicadas alguna vez en producción.
- **Autenticación del WebSocket del dashboard**: el REST del dashboard **sí usa JWT** (`frontend/src/services/api.js` inyecta `auth_token` desde `sessionStorage`), pero el **WebSocket del dashboard** (`frontend/src/services/socket.js`) se conecta **sin autenticación** (a diferencia del HELLO autenticado del huellero). `[PENDIENTE]`
- **Config centralizado de `BIOMETRIC_MATCH_THRESHOLD` en el huellero**: hoy el huellero lee el umbral de una variable de entorno del SO (fallback `21474` en `fingerprint.js`), mientras el backend lo toma de `.env`; si se cambia en un lado y no en el otro, la verificación queda con umbrales distintos sin error visible. Sugerido leerlo desde `config.json` (mismo mecanismo que `deviceId`/`token`/`backendUrl`/`wsUrl`). `[PENDIENTE]`
- **Flujo Web SDK del navegador** (si llega a reactivarse): verificar su propio mismatch de DPI (no investigado). `[PENDIENTE]`

## 6. Empaquetado final `[PENDIENTE]`

- Fase 12 (`.exe`): no intentar hasta que todo lo anterior funcione como app Node/Electron independiente.
