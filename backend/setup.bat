@echo off
chcp 65001 >nul
echo.
echo  ==========================================
echo   Configurando Fernanda Silva Nail Designer - agenda-nova
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

REM O frontend atual e publicado por build em backend\public
if exist "public\index.html" (
    echo  [OK] Frontend ja encontrado em public\index.html
) else (
    echo  [!]  Nao encontrei o frontend compilado em public\index.html
    echo       Rode:
    echo         cd ..\frontend ^&^& npm install ^&^& npm run build
    echo       e depois copie o dist para backend\public.
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
