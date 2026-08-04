@echo off
echo ========================================
echo   Instalacion de SDK Huellas U.are.U 4500
echo ========================================
echo.

echo [1/4] Copiando archivos del SDK...
echo.

set "SRC=C:\Users\ivanf\Downloads\todo\4500 ACTUALIZADO\scripts"
set "DST=C:\Users\ivanf\Downloads\HuelleroActualizado-main\HuelleroActualizado-main\public\scripts"

if not exist "%DST%" mkdir "%DST%"

copy "%SRC%\es6-shim.js" "%DST%\" /Y
if %errorlevel% neq 0 (echo ERROR copiando es6-shim.js && goto :error)

copy "%SRC%\fingerprint.sdk.min.js" "%DST%\" /Y
if %errorlevel% neq 0 (echo ERROR copiando fingerprint.sdk.min.js && goto :error)

copy "%SRC%\websdk.client.bundle.min.js" "%DST%\" /Y
if %errorlevel% neq 0 (echo ERROR copiando websdk.client.bundle.min.js && goto :error)

echo    Archivos SDK copiados correctamente.
echo.

echo [2/4] Instalando dependencias del servidor (express, mongoose, koffi, pngjs)...
cd /d "C:\Users\ivanf\Downloads\HuelleroActualizado-main\HuelleroActualizado-main\server"
call npm install
if %errorlevel% neq 0 (echo ERROR en npm install && goto :error)
echo    Dependencias del servidor instaladas.
echo.

echo [3/4] Instalando dependencias del frontend (Vue, Vite, xlsx)...
cd /d "C:\Users\ivanf\Downloads\HuelleroActualizado-main\HuelleroActualizado-main"
call npm install
if %errorlevel% neq 0 (echo ERROR en npm install frontend && goto :error)
echo    Dependencias del frontend instaladas.
echo.

echo [4/4] Verificando instalacion...
cd /d "C:\Users\ivanf\Downloads\HuelleroActualizado-main\HuelleroActualizado-main\server"
node -e "try { require('koffi'); console.log('koffi: OK'); } catch(e) { console.log('koffi: FALLO - ' + e.message); }"
node -e "try { require('pngjs'); console.log('pngjs: OK'); } catch(e) { console.log('pngjs: FALLO - ' + e.message); }"
echo.

echo ========================================
echo   Instalacion completada exitosamente!
echo ========================================
echo.
echo   Para iniciar:
echo     Backend:  cd server ^&^& npm run dev
echo     Frontend: npm run dev (en la raiz del proyecto)
echo.
pause
goto :eof

:error
echo.
echo ========================================
echo   ERROR en la instalacion
echo ========================================
pause
exit /b 1
