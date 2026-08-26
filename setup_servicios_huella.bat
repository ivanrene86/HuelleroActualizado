

@echo off
setlocal enabledelayedexpansion
title Instalador y Configurado Automático de Servicios de Huella - SENA

echo ========================================================
echo   CONFIGURADOR AUTOMATICO DE SERVICIOS DE HUELLA
echo ========================================================
echo.

:: 1. Verificar Permisos de Administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] ERROR: Este instalador requiere permisos de Administrador.
    echo     Por favor haz clic derecho sobre este archivo y elige "Ejecutar como Administrador".
    echo.
    pause
    exit /b 1
)

:: 2. Crear carpetas de destino si no existen
if not exist "C:\Program Files\DigitalPersona\Bin" (
    mkdir "C:\Program Files\DigitalPersona\Bin" >nul 2>&1
)
if not exist "C:\Program Files (x86)\DigitalPersona\Bin" (
    mkdir "C:\Program Files (x86)\DigitalPersona\Bin" >nul 2>&1
)

:: 3. Copiar ejecutables locales si existen en el repositorio
set "SCRIPT_DIR=%~dp0"
if exist "%SCRIPT_DIR%backend\dll\dpfj.dll" (
    echo [1/4] Copiando librerias biométricas locales...
    copy /Y "%SCRIPT_DIR%backend\dll\*.dll" "C:\Windows\System32\" >nul 2>&1
)

:: 4. Configurar e Iniciar Servicio DpHost
echo [2/4] Configurando servicio DpHost...
sc create DpHost binPath= "\"C:\Program Files\DigitalPersona\Bin\DpHostW.exe\"" start= auto >nul 2>&1
sc config DpHost start= auto >nul 2>&1
net start DpHost >nul 2>&1

:: 5. Iniciar DPAgent en segundo plano
echo [3/4] Iniciando servicio DPAgent...
if exist "C:\Program Files (x86)\DigitalPersona\Bin\DPAgent.exe" (
    start "" "C:\Program Files (x86)\DigitalPersona\Bin\DPAgent.exe"
)

:: 6. Verificación Final
echo [4/4] Verificando estado final...
echo.
sc query DpHost | findstr /I "RUNNING" >nul
if %errorlevel% equ 0 (
    echo ========================================================
    echo   ¡EXITO! Los servicios de huella estan 100%% ACTIVOS.
    echo ========================================================
    echo   El lector USB U.are.U 4500 ya encendera su luz roja
    echo   al abrir la aplicacion en el navegador.
) else (
    echo ========================================================
    echo   ATENCION: DpHost intentado iniciar.
    echo ========================================================
    echo   Asegurate de haber copiado las carpetas de DigitalPersona
    echo   a C:\Program Files\ y C:\Program Files (x86)\.
)

echo.
pause
