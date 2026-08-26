@echo off
setlocal enabledelayedexpansion
title Instalador y Verificador de Dependencias - Huellero SENA

echo ========================================
echo   Instalador de Dependencias del Proyecto
echo ========================================
echo.

set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"

echo [1/3] Instalando dependencias del Backend (Express, Mongoose, Koffi, etc.)...
cd /d "%ROOT_DIR%\backend"
call npm install
if %errorlevel% neq 0 (echo ERROR instalando dependencias del backend && goto :error)
echo    Dependencias del backend instaladas correctamente.
echo.

echo [2/3] Instalando dependencias del Frontend (Vue 3, Vite, XLSX, etc.)...
cd /d "%ROOT_DIR%\frontend"
call npm install
if %errorlevel% neq 0 (echo ERROR instalando dependencias del frontend && goto :error)
echo    Dependencias del frontend instaladas correctamente.
echo.

echo [3/3] Verificando motor de huellas y dependencias nativas...
cd /d "%ROOT_DIR%\backend"
node -e "import('koffi').then(() => console.log('  koffi (Libreria C): OK')).catch(e => console.log('  koffi: FALLO - ' + e.message))"
node -e "import('pngjs').then(() => console.log('  pngjs (Procesador PNG): OK')).catch(e => console.log('  pngjs: FALLO - ' + e.message))"
echo.

echo ========================================
echo   Instalacion completada exitosamente!
echo ========================================
echo.
echo   Comandos para iniciar el sistema:
echo.
echo     1. Backend:   cd backend ^&^& npm run dev
echo     2. Frontend:  cd frontend ^&^& npm run dev
echo.
echo   O desde la raiz del proyecto:
echo     - Iniciar Frontend: npm run dev:frontend
echo     - Iniciar Backend:  npm run dev:backend
echo.
pause
goto :eof

:error
echo.
echo ========================================
echo   ERROR durante la instalacion
echo ========================================
pause
exit /b 1
