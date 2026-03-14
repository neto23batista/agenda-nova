# 💅 Belle Studio — Backend

## ✅ Sem compilação! Funciona em Windows, Mac e Linux.

---

## Instalação (3 comandos)

```bash
# 1. Entre na pasta
cd belle-studio-backend

# 2. Instale as dependências (rápido, sem compilação C++)
npm install

# 3. Configure as variáveis de ambiente
copy .env.example .env
```

Abra o arquivo `.env` e preencha com seus dados.

---

## Iniciar o servidor

```bash
npm start
```

Acesse: **http://localhost:3001**

Para desenvolvimento (reinicia automático):
```bash
npm run dev
```

---

## Estrutura dos arquivos

```
belle-studio-backend/
├── server.js          ← Servidor principal (rotas)
├── db.js              ← Banco de dados em JSON (sem SQLite!)
├── whatsapp.js        ← Envio de mensagens WhatsApp
├── scheduler.js       ← Lembretes automáticos (cron)
├── package.json
├── .env.example       ← Copie para .env e preencha
├── belle-data.json    ← Criado automaticamente (seus dados)
└── public/
    └── belle-studio-v3.html  ← Cole o frontend aqui
```

---

## Configurar o WhatsApp

### Opção A — Evolution API (gratuito 🇧🇷)

```bash
# Instalar com Docker
docker run -d --name evolution-api -p 8080:8080 \
  -e AUTHENTICATION_API_KEY=minha-chave \
  atendai/evolution-api:latest
```

No `.env`:
```env
WHATSAPP_PROVIDER=evolution
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=minha-chave
EVOLUTION_INSTANCE=belle-studio
```

Acesse http://localhost:8080 → crie a instância → escaneie o QR Code.

### Opção B — Twilio (pago, R$0,04/msg)

```env
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

---

## Testar o WhatsApp

```bash
curl -X POST http://localhost:3001/api/test-whatsapp \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"5511999990000\",\"message\":\"Teste Belle Studio! 💅\"}"
```

---

## Conectar o frontend

No arquivo `belle-studio-v3.html`, encontre a linha:

```javascript
const BACKEND_URL = null; // modo demo
```

Troque para:

```javascript
const BACKEND_URL = 'http://localhost:3001';
```

Depois coloque o `belle-studio-v3.html` dentro da pasta `public/`.

---

## Notificações automáticas

| Quando | Quem recebe | Mensagem |
|--------|-------------|---------|
| Cliente agenda | **Dono** | Alerta de novo agendamento |
| Dono **confirma** | **Cliente** | Confirmação com data e hora |
| **1 dia antes** | **Cliente** | Lembrete do dia seguinte |
| **1 hora antes** | **Cliente + Dono** | Lembrete final |

O scheduler roda a cada **30 minutos** e envia apenas **uma vez** cada lembrete.
