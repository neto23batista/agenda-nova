@echo off
echo.
echo  Configurando Belle Studio...
echo.

REM Cria pasta public se não existir
if not exist "public" mkdir public

REM Copia o HTML para public/index.html se ele existir no diretório pai
if exist "..\belle-studio-v3.html" (
    copy "..\belle-studio-v3.html" "public\index.html" >nul
    echo  [OK] belle-studio-v3.html copiado para public\index.html
) else (
    echo  [AVISO] Coloque o belle-studio-v3.html dentro da pasta public\ e renomeie para index.html
)

REM Cria .env a partir do exemplo se não existir
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo  [OK] .env criado - abra e configure seu WhatsApp
) else (
    echo  [OK] .env ja existe
)

REM Instala dependencias
echo.
echo  Instalando dependencias...
npm install

echo.
echo  ==========================================
echo   Pronto! Para iniciar o servidor:
echo   npm start
echo.
echo   Acesse: http://localhost:3001
echo  ==========================================
echo.
pause
