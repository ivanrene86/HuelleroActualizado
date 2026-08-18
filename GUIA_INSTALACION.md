# 🚀 Guía de Instalación y Configuración del SDK de Huella (DigitalPersona U.are.U 4500)

Esta guía explica los pasos necesarios para desplegar y poner a funcionar el sistema de lectura de huella en **cualquier dispositivo o computadora nueva**.

---

## 📁 Estructura del Proyecto

El proyecto está organizado en dos módulos independientes:

```text
HuelleroActualizado/
├── backend/                  # Servidor API Node.js, Express, MongoDB y motor biométrico C++
│   ├── dll/                  # Librerías DLL nativas (dpfj.dll, dpfpdd.dll)
│   ├── models/               # Modelos de base de datos
│   ├── routes/               # Rutas API REST (/api/...)
│   ├── services/             # Lógica biométrica y de correo
│   └── package.json          # Dependencias del servidor
│
├── frontend/                 # Interfaz de usuario (Vue 3, Vite, Tailwind/CSS)
│   ├── public/               # Scripts Web SDK DigitalPersona
│   ├── src/                  # Componentes y vistas de usuario
│   └── package.json          # Dependencias de la interfaz
│
├── package.json              # Scripts raíz para iniciar o instalar ambos
├── setup_servicios_huella.bat# Configurador automático de servicios de huella
└── setup_huellas.bat         # Instalador y verificador de dependencias
```

---

## 📋 Requisitos Previos Generales

1. **Hardware:** Lector de Huella Biométrica **DigitalPersona U.are.U 4500 USB**.
2. **Sistema Operativo:** Windows 10 o Windows 11 (64-bit).
3. **Node.js:** Versión 18 o superior.
4. **MongoDB:** Instancia de MongoDB local o URI de MongoDB Atlas en la nube.

---

## 1. 🔌 Instalación en la Computadora Cliente (Donde se conecta el Lector USB)

Para que el navegador web pueda comunicarse con el sensor biométrico USB, la máquina cliente requiere instalar el servicio de fondo y los drivers de DigitalPersona:

### Pasos:
1. **Configuración Rápida Automática:**
   - Haz clic derecho sobre **`setup_servicios_huella.bat`** en la raíz del proyecto y selecciona **"Ejecutar como Administrador"**.
   - El script creará las carpetas del sistema, configurará el servicio `DpHost` e iniciará `DPAgent.exe`.

2. **Instalación Manual (Si es una máquina nueva sin drivers):**
   - Ejecuta el instalador **`DigitalPersona Web Components`** (o `DigitalPersona Lite Client / WebAgent`).
   - Conecta el lector USB U.are.U 4500.
   - Verifica en el Administrador de Dispositivos que aparezca bajo **Dispositivos biométricos** -> **DigitalPersona Fingerprint Reader**.

---

## 2. 🖥️ Configuración del Servidor Backend (Node.js)

El backend utiliza la librería nativa de extracción y comparación de minucias **`dpfj.dll`** a través de `koffi`.

### Pasos:
1. **Iniciar el Servidor Backend:**
   ```powershell
   cd backend
   npm install
   npm run dev
   ```
2. **Verificación:**
   - Debe mostrar:
     ```text
     [fingerprint] dpfj.dll cargado exitosamente desde: .../backend/dll/dpfj.dll
     MongoDB Atlas conectado
     Backend en http://localhost:3000
     ```

---

## 3. 🌐 Configuración del Frontend (Vue 3 / Vite)

Los scripts del SDK Web de DigitalPersona vienen pre-incluidos en la carpeta `frontend/public/scripts/`.

### Pasos:
1. **Iniciar la Interfaz Frontend:**
   ```powershell
   cd frontend
   npm install
   npm run dev
   ```
2. Abre en tu navegador: `http://localhost:5173`.

---

## 🛠️ Resumen de Instalación para Nuevas Máquinas

| Componente | ¿Qué instalar? | Ubicación / Archivo |
| :--- | :--- | :--- |
| **Cliente USB** | Driver + DigitalPersona WebAgent | `setup_servicios_huella.bat` o instalador `.exe` |
| **Backend Node.js** | DLLs de Biometría | `backend/dll/dpfj.dll` |
| **Frontend** | Scripts Web SDK | Pre-incluidos en `frontend/public/scripts/` |

---
