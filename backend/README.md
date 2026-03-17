# 💅 Belle Studio — Backend

## Início rápido

```bash
# 1. Entre na pasta
cd agenda-nova\backend

# 2. Execute o setup automático (Windows)
setup.bat

# 3. Inicie o servidor
npm start
```

Acesse **http://localhost:3001** ✅

---

## Configurar WhatsApp (Evolution API)

### 1. Instalar Docker Desktop
Baixe em: https://docker.com/products/docker-desktop

### 2. Rodar a Evolution API
```bash
docker run -d --name evolution-api --restart always -p 8080:8080 ^
  -e AUTHENTICATION_API_KEY=belle-chave-123 ^
  atendai/evolution-api:latest
```

### 3. Conectar o WhatsApp
```bash
curl -X POST http://localhost:8080/instance/create ^
  -H "Content-Type: application/json" ^
  -H "apikey: belle-chave-123" ^
  -d "{\"instanceName\":\"belle-studio\",\"qrcode\":true}"
```

Ver QR Code:
```
http://localhost:8080/instance/connect/belle-studio
```
Escaneie com o WhatsApp do celular do salão.

### 4. Configurar .env
```env
OWNER_WHATSAPP=5511999998888    ← seu número (DDI+DDD+número)
EVOLUTION_API_KEY=belle-chave-123
EVOLUTION_INSTANCE=belle-studio
```

### 5. Testar
```bash
curl -X POST http://localhost:3001/api/test-whatsapp ^
  -H "Content-Type: application/json" ^
  -d "{\"phone\":\"5511999998888\",\"message\":\"Teste! 💅\"}"
```

---

## Estrutura de arquivos

```
agenda-nova\backend\
├── server.js          ← Servidor principal
├── db.js              ← Banco em memória + belle-data.json
├── whatsapp.js        ← Envio WhatsApp
├── scheduler.js       ← Lembretes automáticos (30 min)
├── .env               ← Suas configurações (criar a partir do .env.example)
├── belle-data.json    ← Seus dados (criado automaticamente)
├── setup.bat          ← Configuração automática Windows
└── public\
    └── index.html     ← Frontend
```

---

## Notificações automáticas

| Quando | Quem recebe |
|--------|-------------|
| Cliente agenda | Dono recebe alerta |
| Dono **confirma** | Cliente recebe confirmação |
| **1 dia antes** | Cliente recebe lembrete |
| **1 hora antes** | Cliente + Dono recebem lembrete |
