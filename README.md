# 💅 Belle Studio — Sistema de Agendamentos v2.0

Sistema completo de agendamentos para salão de manicure com **backend Node.js**, **banco SQLite**, **notificações automáticas por WhatsApp e e-mail**, e frontend React.

---

## 🏗️ Arquitetura

```
belle-studio/
├── backend/                  ← API Node.js + Express
│   ├── server.js             ← Entrada principal
│   ├── .env.example          ← Variáveis de ambiente (copiar para .env)
│   ├── database/
│   │   ├── setup.js          ← Criação de tabelas SQLite
│   │   └── seed.js           ← Dados iniciais de demo
│   ├── middleware/
│   │   └── auth.js           ← JWT (autenticação + autorização)
│   ├── routes/
│   │   ├── auth.js           ← POST /login, /register, GET /me
│   │   ├── appointments.js   ← CRUD agendamentos + consentimento
│   │   ├── clients.js        ← Gestão de clientes (dono)
│   │   ├── services.js       ← Gestão de serviços
│   │   ├── professionals.js  ← Gestão de profissionais
│   │   └── notifications.js  ← Histórico + disparo manual
│   └── services/
│       ├── notificationService.js  ← Orquestrador (decide o que enviar)
│       ├── emailService.js         ← Nodemailer (templates HTML)
│       ├── whatsappService.js      ← Twilio ou Evolution API
│       └── scheduler.js            ← node-cron (lembretes automáticos)
│
└── frontend/                 ← React + Vite
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── main.jsx
        └── App.jsx           ← Aplicação completa (portais dono + cliente)
```

---

## 🚀 Como rodar

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edite o .env com suas credenciais de e-mail e WhatsApp
npm run seed       # cria o banco e insere dados de demo
npm run dev        # inicia em http://localhost:3001
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev        # inicia em http://localhost:3000
```

---

## ⚙️ Configuração do .env

### E-mail (Nodemailer)

Para **Gmail**, ative "Senhas de app" em myaccount.google.com/security:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seuemail@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx   # senha de app (16 chars)
EMAIL_FROM="Belle Studio 💅 <seuemail@gmail.com>"
```

Alternativas: **SendGrid**, **Brevo (Sendinblue)**, **Resend** — todos suportam SMTP.

### WhatsApp — Opção 1: Twilio (oficial, pago)

```env
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

> Cadastre em [twilio.com](https://twilio.com) → WhatsApp Sandbox para testes gratuitos.

### WhatsApp — Opção 2: Evolution API (open-source, gratuito)

Ideal para uso no Brasil sem custo por mensagem.

```env
WHATSAPP_PROVIDER=evolution
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua_api_key
EVOLUTION_INSTANCE=belle-studio
```

> Instalação: [github.com/EvolutionAPI/evolution-api](https://github.com/EvolutionAPI/evolution-api)

---

## 🔔 Como funciona o sistema de notificações

### Automático (via cron)
| Horário | Evento | Destinatário | Canal |
|---------|--------|-------------|-------|
| Todo dia às 8h | Lembrete de agendamentos do dia | Cliente | WhatsApp + E-mail |
| Domingo às 3h | Limpeza de notificações antigas | — | — |

O horário pode ser alterado no `.env`:
```env
REMINDER_CRON=0 8 * * *   # formato cron padrão
```

### Evento-driven (imediato)
| Evento | Quem recebe | Canal |
|--------|-------------|-------|
| Cliente faz agendamento | **Dono** | E-mail + WhatsApp + In-app |
| Dono solicita cancelamento/remarcação | **Cliente** | E-mail + WhatsApp + In-app |
| Dono dispara lembrete manual | **Cliente** | E-mail e/ou WhatsApp |

---

## 🔑 Usuários de demonstração

| Tipo | E-mail | Senha |
|------|--------|-------|
| Dono | dono@belle.com | belle123 |
| Cliente | maria@email.com | 123456 |
| Cliente | fernanda@email.com | 123456 |
| Cliente | juliana@email.com | 123456 |

---

## 📡 Endpoints principais da API

```
POST   /api/auth/login
POST   /api/auth/register
GET    /api/auth/me

GET    /api/appointments
POST   /api/appointments
PATCH  /api/appointments/:id
POST   /api/appointments/:id/consent-request
POST   /api/appointments/:id/consent-response

GET    /api/clients
POST   /api/clients

GET    /api/services
PATCH  /api/services/:id

GET    /api/professionals

GET    /api/notifications
PATCH  /api/notifications/read-all
PATCH  /api/notifications/:id/read
POST   /api/notifications/send-reminder/:appointmentId
POST   /api/notifications/trigger-daily

GET    /api/health
```

---

## 🛣️ Próximos passos sugeridos

- [ ] Deploy: **Railway** ou **Render** (backend) + **Vercel** (frontend)
- [ ] Trocar SQLite por **PostgreSQL** para produção
- [ ] Adicionar **WebSockets** para notificações em tempo real no painel
- [ ] **PWA** para o cliente receber push notifications no celular
- [ ] Integração com **Google Calendar**
- [ ] Painel financeiro com relatórios em PDF
