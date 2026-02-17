@echo off
chcp 65001 >nul
title NBA Data Enhancement - Automation
echo.
echo ========================================
echo  NBA Data Enhancement - Automatisation
echo ========================================
echo.

setlocal EnableDelayedExpansion

:: Configuration
set "PROJECT_ROOT=%~dp0.."
set "LOG_DIR=%PROJECT_ROOT%\logs"
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%b%%a)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set "TIMESTAMP=%mydate%-%mytime%"
set "TIMESTAMP=%TIMESTAMP: =0%"
set "MAIN_LOG=%LOG_DIR%\nba-enhancement-%TIMESTAMP%.log"

:: Creer le dossier de logs
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo Log: %MAIN_LOG%
echo.

:: Fonction de log
call :log "========================================"
call :log "NBA Data Enhancement Plan"
call :log "Demarre a: %date% %time%"
call :log "========================================"

:: Phase 1: Tests APIs
call :log "[1/7] Phase 1: Tests APIs..."
echo Test ESPN API...
curl -s "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/events?dates=20260215" >nul
if errorlevel 1 (
    call :log "AVERTISSEMENT: ESPN API non accessible"
) else (
    call :log "OK: ESPN API accessible"
)
echo.

:: Phase 2: Database Migration
call :log "[2/7] Phase 2: Migration Database..."
cd /d "%PROJECT_ROOT%"
call :log "Application des migrations..."
call npx prisma migrate deploy
if errorlevel 1 (
    call :log "ERREUR: Migration echouee"
    goto :error
)
call :log "Generation du client Prisma..."
call npx prisma generate
if errorlevel 1 (
    call :log "ERREUR: Generation Prisma echouee"
    goto :error
)
call :log "OK: Database a jour"
echo.

:: Phase 3: TypeScript Check
call :log "[3/7] Phase 3: Verification TypeScript..."
call npx tsc --noEmit
if errorlevel 1 (
    call :log "AVERTISSEMENT: Erreurs TypeScript detectees mais non bloquantes"
) else (
    call :log "OK: TypeScript OK"
)
echo.

:: Phase 4: Tests (optionnel)
call :log "[4/7] Phase 4: Tests..."
echo.
echo Voulez-vous executer les tests? (O/N)
set /p RUN_TESTS=""
if /i "%RUN_TESTS%"=="O" (
    call :log "Execution des tests..."
    call npm test 2>nul
    if errorlevel 1 (
        call :log "AVERTISSEMENT: Certains tests ont echoue"
    ) else (
        call :log "OK: Tests OK"
    )
) else (
    call :log "Tests ignores"
)
echo.

:: Phase 5: Fetch Donnees
call :log "[5/7] Phase 5: Fetch Donnees Historiques..."
echo.
echo ========================================
echo  OPTIONS DE FETCH
echo ========================================
echo.
echo 1. Fetch une saison test (2024-10-22 a 2024-10-31)
echo 2. Fetch saison complete 2024
echo 3. Fetch toutes les saisons (6-8 heures!)
echo 4. Skip (passer cette etape)
echo.
set /p FETCH_CHOICE="Choix (1-4): "

if "%FETCH_CHOICE%"=="1" (
    call :log "Fetch saison test..."
    call npm run data:fetch-test
)
if "%FETCH_CHOICE%"=="2" (
    call :log "Fetch saison 2024 complete..."
    call npm run data:fetch-2024
)
if "%FETCH_CHOICE%"=="3" (
    echo.
    echo ATTENTION: Ce processus prend 6-8 heures!
    echo Assurez-vous d'avoir une connexion stable.
    echo.
    pause
    bash scripts/fetch-all-seasons.sh
)
if "%FETCH_CHOICE%"=="4" (
    call :log "Fetch skipped"
)
echo.

:: Phase 6: Training ML
call :log "[6/7] Phase 6: Training ML..."
echo.
echo ========================================
echo  OPTIONS DE TRAINING
echo ========================================
echo.
echo 1. Training avec player features (recommande)
echo 2. Training basique (sans player features)
echo 3. Skip (passer cette etape)
echo.
set /p TRAIN_CHOICE="Choix (1-3): "

if "%TRAIN_CHOICE%"=="1" (
    call :log "Training avec player features..."
    call npm run ml:train-advanced
)
if "%TRAIN_CHOICE%"=="2" (
    call :log "Training basique..."
    call npm run ml:train-basic
)
if "%TRAIN_CHOICE%"=="3" (
    call :log "Training skipped"
)
echo.

:: Phase 7: Rapport
call :log "[7/7] Phase 7: Rapport Final..."
echo.
call :log "========================================"
call :log "STATISTIQUES"
call :log "========================================"
echo.

call :log "Verification des donnees..."
echo Nombre de games:
call npx prisma db execute --stdin="SELECT COUNT(*) as games FROM games;"
echo Nombre de players:
call npx prisma db execute --stdin="SELECT COUNT(*) as players FROM players;"

echo.
call :log "========================================"
call :log "EXECUTION TERMINEE"
call :log "========================================"
echo.
call :log "Log: %MAIN_LOG%"
echo.

:end
pause
exit /b 0

:error
call :log "========================================"
call :log "ERREUR FATALE"
call :log "========================================"
pause
exit /b 1

:log
echo [%date% %time%] %~1
>>"%MAIN_LOG%" echo [%date% %time%] %~1
goto :eof
