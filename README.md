# 🎓 Sistema de Asistencia Biométrica SENA (Huellero U.are.U 4500)

Sistema integral para el control y registro de asistencia de aprendices e instructores mediante biometría dactilar con hardware DigitalPersona U.are.U 4500.

---

## 📁 Estructura del Proyecto

```text
HuelleroActualizado/
├── backend/                  # Servidor API Node.js + Express + MongoDB Atlas
│   ├── dll/                  # Librerías nativas C++ (dpfj.dll, dpfpdd.dll)
│   ├── models/               # Modelos Mongoose (Aprendices, Fichas, Asistencia)
│   ├── routes/               # Endpoints REST API (/api/...)
│   ├── services/             # Lógica de comparación de minucias y correo
│   └── package.json
│
├── frontend/                 # Aplicación Web Vue 3 + Vite
│   ├── public/               # Scripts Web SDK DigitalPersona
│   ├── src/                  # Componentes Vue (PanelInstructor, Reportes, etc.)
│   └── package.json
│
├── package.json              # Scripts raíz para control conjunto
├── setup_servicios_huella.bat# Configurador automático de servicios de huella
└── setup_huellas.bat         # Instalador y verificador de dependencias
```

---

## 🚀 Inicio Rápido

### 1. Iniciar el Backend (Servidor)
```bash
cd backend
npm install
npm run dev
```
*El servidor iniciará en `http://localhost:3000` conectado a MongoDB Atlas.*

### 2. Iniciar el Frontend (Interfaz de Usuario)
```bash
cd frontend
npm install
npm run dev
```
*La aplicación web estará disponible en `http://localhost:5173`.*

---

## ⚡ Comandos desde la Raíz del Proyecto
Puedes controlar ambos módulos desde la raíz:
- `npm run dev:frontend`: Inicia el Frontend
- `npm run dev:backend`: Inicia el Backend
- `npm run build:frontend`: Compila el Frontend para producción
- `npm run install:all`: Instala dependencias en Backend y Frontend

---

## 📖 Documentación de Instalación
Para más detalles sobre cómo instalar los drivers en computadoras nuevas, consulta [`GUIA_INSTALACION.md`](./GUIA_INSTALACION.md).
