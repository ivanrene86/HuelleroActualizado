# 🎓 Sistema de Asistencia Biométrica SENA (DigitalPersona U.are.U 4500)

Sistema integral modular para el control, registro y reporte de asistencia de aprendices e instructores mediante biometría dactilar con hardware DigitalPersona U.are.U 4500, WebSockets en tiempo real y soporte para Modo Kiosco Autónomo de Aula. Incluye además una aplicación local de escritorio (Electron) para el huellero físico, con el ciclo completo funcionando contra hardware real: enrolamiento, verificación biométrica, registro de asistencia, sincronización offline/online y gestión de clases activas. Sigue en desarrollo — quedan pendientes la interfaz de administración de dispositivos y el empaquetado como `.exe`.

---

## 📁 Estructura del Proyecto

```text
HuelleroActualizado/
├── backend/                       # ⚙️ Servidor API Node.js + Express + WebSockets + MongoDB Atlas
│   ├── controllers/               # 🎮 Controladores de lógica HTTP y base de datos
│   ├── middlewares/               # 🛡️ Validadores de datos y control de roles
│   ├── models/                    # 📦 Modelos Mongoose (Aprendices, Instructores, Fichas, Asistencias, Dispositivos, Clases, Excusas)
│   ├── routes/                    # 🛣️ Enrutadores REST API (/api/...) — clases, dispositivos, enrolamiento, sync asistencias
│   ├── services/                  # 🔧 Servicios de negocio (Biometría C++, SQLite, Sockets, Tardanzas)
│   ├── dll/                       # 🔌 Librerías nativas DigitalPersona (dpfj.dll, dpfpdd.dll)
│   ├── data/                      # 💾 Base de datos relacional SQLite de respaldo
│   └── package.json
│
├── frontend/                      # 💻 Aplicación Web Reactiva (Vue 3 + Vite)
│   ├── src/
│   │   ├── components/            # 🖼️ Vistas (PanelInstructor, KioscoAsistencia, Reportes, Perfiles)
│   │   ├── services/              # 📡 Clientes de API REST y WebSockets en tiempo real
│   │   ├── utils/                 # 🧰 Validadores de formularios y formateadores de fechas/horas
│   │   ├── assets/                # 🎨 Recursos visuales e íconos
│   │   └── App.vue                # 🚀 Enrutamiento principal y control de sesión
│   ├── public/                    # 📄 Scripts cliente del SDK DigitalPersona
│   └── package.json
│
├── huellero/                      # 🖐️ Aplicación local Electron (Node + Vue 3) — 
│                                  #    conecta el lector físico DigitalPersona U.are.U 4500
│   ├── src/main/                  # ⚙️ Proceso principal: captura, motor biométrico, WebSocket, store/sync/scheduler
│   ├── src/renderer/              # 🖼️ UI del kiosko (Vue 3): login docente, enrolamiento
│   ├── dll/                       # 🔌 Librerías nativas DigitalPersona (mismo set que backend/dll)
│   └── package.json
│
├── docs/                          # 📚 Documentación técnica del proyecto 
│                                  #    (CONTEXTO_HUELLERO.md: contexto y roadmap del huellero)
│   └── sdk-reference/             # 📄 Headers oficiales del SDK DigitalPersona (dpfpdd.h, dpfj.h)
├── package.json                   # ⚡ Control del monorepo con un solo comando
├── setup_servicios_huella.bat     # 🛠️ Configurador automático de servicios de huella
└── setup_huellas.bat              # 📦 Instalador y verificador de dependencias
```

---

## 🚧 Estado y próximos pasos

Resumen de alto nivel de lo que queda pendiente (detalle completo y verificado en [`docs/CONTEXTO_HUELLERO.md`](./docs/CONTEXTO_HUELLERO.md)):

- **Administración de dispositivos/huelleros**: el backend ya está (`GET /api/dispositivos`, `PUT /api/dispositivos/:id/fichas`); falta la sección en el dashboard del Admin.
- **Acks del protocolo WebSocket** (`ACTIVATED`/`DEACTIVATED`) y `GET /api/clases/estado` para restaurar el estado de clase al recargar el dashboard.
- **Empaquetado final del huellero como `.exe`** — pendiente hasta que todo funcione estable como app independiente.
- **Vulnerabilidades de `npm audit`** en `huellero/` (1 crítica, 10 altas, 2 moderadas) en dependencias de build/empaquetado.
- **Autenticación del WebSocket del dashboard** (hoy se conecta sin auth, a diferencia del `HELLO` autenticado del huellero).
- **Config centralizada de `BIOMETRIC_MATCH_THRESHOLD`** en el huellero (hoy depende de una variable de entorno del SO).

Para el detalle completo de cada punto y su estado (`[PENDIENTE]`, `[PARCIAL]`, etc.), ver [`docs/CONTEXTO_HUELLERO.md`](./docs/CONTEXTO_HUELLERO.md).

---

## 🚀 Inicio Rápido

### Iniciar todo el proyecto con un solo comando:
```bash
npm run dev
```
*Iniciará simultáneamente el **Backend** (`http://localhost:3000`) y el **Frontend** (`http://localhost:5173`).*

---

## ⚡ Comandos Disponibles desde la Raíz:
- `npm run dev`: Inicia Backend y Frontend en paralelo.
- `npm run dev:frontend`: Inicia solo la interfaz de usuario.
- `npm run dev:backend`: Inicia solo el servidor API.
- `npm run build:frontend`: Compila el Frontend para producción.
- `npm run install:all`: Instala todas las dependencias del proyecto.
- `cd huellero && npm run dev`: Levanta la aplicación local Electron del huellero físico.

---

## 📖 Guía de Instalación de Drivers y Hardware
Para configurar el lector biométrico en un computador nuevo, consulta [`GUIA_INSTALACION.md`](./GUIA_INSTALACION.md).
