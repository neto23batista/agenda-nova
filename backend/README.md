# Fernanda Silva Nail Designer - Backend

## Inicio rapido

```bash
cd agenda-nova\backend
npm install
npm start
# http://localhost:3001
```

Para rebuildar o frontend web:

```bash
cd ..\frontend
npm install
npm run build
```

O build do frontend deve ser publicado em `backend/public`.

## Ambiente

Copie `.env.example` para `.env` e ajuste:

- `OWNER_PASSWORD`
- `SALON_NAME`
- `OWNER_WHATSAPP`
- `CORS_ORIGINS` se houver frontend em outro dominio

## WhatsApp

O backend suporta Evolution API ou Twilio.

### Evolution API

```bash
docker run -d --name evolution-api --restart always -p 8080:8080 ^
  -e AUTHENTICATION_API_KEY=fernanda-chave-123 ^
  atendai/evolution-api:latest
```

Crie a instancia com o mesmo nome definido no `.env`:

```bash
curl -X POST http://localhost:8080/instance/create ^
  -H "Content-Type: application/json" ^
  -H "apikey: fernanda-chave-123" ^
  -d "{\"instanceName\":\"fernanda-silva-agenda\",\"qrcode\":true}"
```

## Estrutura principal

- `server.js`: API e entrega do frontend
- `db.js`: persistencia em JSON
- `scheduler.js`: lembretes automaticos
- `whatsapp.js`: notificacoes WhatsApp
- `public/`: SPA compilada
