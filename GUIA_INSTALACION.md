# 🚀 Guía de Instalación y Configuración del SDK de Huella (DigitalPersona U.are.U 4500)

Esta guía explica los pasos necesarios para desplegar y poner a funcionar el sistema de lectura de huella en **cualquier dispositivo o computadora nueva**.

---

## 📋 Requisitos Previos Generales

1. **Hardware:** Lector de Huella Biométrica **DigitalPersona U.are.U 4500 USB**.
2. **Sistema Operativo:** Windows 10 o Windows 11 (64-bit).
3. **Node.js:** Versión 18 o superior.
4. **MongoDB:** Instancia de MongoDB local o URI de MongoDB Atlas en la nube.

---

## 1. 🔌 Instalación en la Computadora Cliente (Donde se conecta el Lector USB)

Para que el navegador web (Vite/Vue) pueda comunicarse con el sensor biométrico USB, la máquina cliente requiere instalar el servicio de fondo y los drivers de DigitalPersona:

### Pasos:
1. **Instalar DigitalPersona Web SDK Agent (`DPAgent`):**
   - Ejecutar el instalador **`DigitalPersona Web Components`** (o `DigitalPersona Lite Client / WebAgent`).
   - Esto instalará el servicio en segundo plano que escucha en `http://localhost:9001` / `https://localhost:9003` para WebSocket/WebChannel.
2. **Verificación:**
   - Conectar el lector USB U.are.U 4500.
   - Verificar en el Administrador de Dispositivos de Windows que aparezca bajo **Biometric Devices** o **DigitalPersona Fingerprint Reader**.
   - El icono en la barra de tareas de Windows debe mostrar `DigitalPersona Agent` activo.

---

## 2. 🖥️ Configuración del Servidor Backend (Node.js)

El backend utiliza la librería nativa de extracción y comparación de minucias **`dpfj.dll`** a través de `koffi`.

### Pasos:
1. **Carpeta de Librerías DLL (`server/dll/`):**
   - El backend busca automáticamente `dpfj.dll` y `dpfpdd.dll` en las siguientes ubicaciones (en este orden de prioridad):
     1. `server/dll/dpfj.dll` *(recomendado incluirlo en la carpeta del proyecto)*
     2. `C:\Windows\System32\dpfj.dll` *(PATH del sistema)*
     3. `C:\Program Files\DigitalPersona\U.are.U SDK\Windows\Lib\x64\dpfj.dll`

2. **Copiar las DLLs al Proyecto (Opcional pero recomendado para distribución):**
   - Copiar los archivos `dpfj.dll` y `dpfpdd.dll` desde `C:\Program Files\DigitalPersona\U.are.U SDK\Windows\Lib\x64\` hacia la carpeta `server/dll/` del proyecto.
   - De esta forma, el backend funcionará en cualquier máquina sin necesidad de instalar el SDK completo de desarrollo de DigitalPersona.

3. **Iniciar el Servidor Backend:**
   ```powershell
   cd server
   npm install
   npm start
   ```

---

## 3. 🌐 Configuración del Frontend (Vue 3 / Vite)

Los scripts del SDK Web de DigitalPersona ya vienen pre-incluidos en la carpeta `public/scripts/` del proyecto:
- `public/scripts/websdk.client.bundle.min.js`
- `public/scripts/fingerprint.sdk.min.js`

Son cargados en `index.html` mediante:
```html
<script src="/scripts/websdk.client.bundle.min.js"></script>
<script src="/scripts/fingerprint.sdk.min.js"></script>
```

---

## 🛠️ Resumen de Instalación para Nuevas Máquinas

| Componente | ¿Qué instalar? | Ubicación / Archivo |
| :--- | :--- | :--- |
| **Cliente USB** | Driver + DigitalPersona WebAgent | Instalador `.exe` de DigitalPersona Web Components |
| **Backend Node.js** | DLLs de Biometría | `server/dll/dpfj.dll` o `C:\Windows\System32\dpfj.dll` |
| **Frontend** | Scripts Web SDK | Pre-incluidos en `public/scripts/` |

---
