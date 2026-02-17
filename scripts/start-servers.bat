@echo off
echo Starting NBA Analyst servers...
echo.

:: Kill any existing processes on ports 3000 and 5555
npx kill-port 3000 2>nul
npx kill-port 5555 2>nul

:: Start Next.js dev server
echo Starting Next.js dev server on http://localhost:3000...
start "Next.js Dev Server" cmd /c "npm run dev"

:: Wait for Next.js to start
timeout /t 10 /nobreak >nul

:: Start Prisma Studio
echo Starting Prisma Studio on http://localhost:5555...
start "Prisma Studio" cmd /c "npx prisma studio"

echo.
echo ========================================
echo Servers started!
echo.
echo Next.js App: http://localhost:3000
echo Prisma Studio: http://localhost:5555
echo.
echo Dashboard URLs:
echo   - ML Dashboard: http://localhost:3000/admin/ml
echo   - Performance: http://localhost:3000/dashboard/performance
echo ========================================
echo.
pause
