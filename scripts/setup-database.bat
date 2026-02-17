@echo off
chcp 65001 >nul
echo.
echo ================================================
echo   NBA Analyst - Database Setup
echo ================================================
echo.

echo [1/3] Generating Prisma client...
npx prisma generate
if %errorlevel% neq 0 (
    echo ❌ Failed to generate Prisma client
    exit /b 1
)
echo ✓ Prisma client generated
echo.

echo [2/3] Running database migrations...
npx prisma migrate dev --name add_ml_system
if %errorlevel% neq 0 (
    echo ❌ Failed to run migrations
    exit /b 1
)
echo ✓ Migrations applied
echo.

echo [3/3] Verifying database...
node scripts/ml-cli.js status
if %errorlevel% neq 0 (
    echo ❌ Database verification failed
    exit /b 1
)
echo.

echo ================================================
echo   Database Setup Complete!
echo ================================================
echo.
echo Next steps:
echo   node scripts/ml-cli.js install
echo.
pause
