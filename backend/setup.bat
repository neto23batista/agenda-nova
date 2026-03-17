@echo off
chcp 65001 >nul
echo.
echo  ==========================================
echo   Configurando Belle Studio - agenda-nova
echo  ==========================================
echo.

REM Cria pasta public
if not exist "public" (
    mkdir public
    echo  [OK] Pasta public\ criada.
)

REM Copia .env.example para .env se nao existir
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo  [OK] Arquivo .env criado.
    echo  [!]  Abra o .env e configure o OWNER_WHATSAPP e a Evolution API.
) else (
    echo  [OK] .env ja existe.
)

REM Procura o HTML no diretorio pai (agenda-nova/)
if exist "..\belle-studio-v3.html" (
    copy "..\belle-studio-v3.html" "public\index.html" >nul
    echo  [OK] Frontend copiado para public\index.html
) else (
    echo  [!]  Nao encontrei belle-studio-v3.html na pasta acima.
    echo       Coloque o HTML em: public\index.html manualmente.
)

echo.
echo  Instalando dependencias Node.js...
echo  (Isso pode demorar 1-2 minutos na primeira vez)
echo.
call npm install

echo.
echo  ==========================================
echo   Pronto! Para iniciar:
echo.
echo     npm start
echo.
echo   Acesse: http://localhost:3001
echo  ==========================================
echo.
pause
