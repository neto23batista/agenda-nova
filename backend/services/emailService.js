// services/emailService.js — Envio de e-mails via Nodemailer
const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST   || "smtp.gmail.com",
      port:   parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

// ── Templates ────────────────────────────────────────────────

function reminderTemplate({ clientName, serviceName, serviceIcon, professionalName, date, time, price }) {
  return {
    subject: `💅 Lembrete: seu agendamento hoje no Belle Studio — ${time}`,
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fdf8f5;font-family:Georgia,serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8f5;padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(45,31,23,0.1)">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#b5533c,#d4846e);padding:32px 40px;text-align:center">
          <div style="font-size:48px;margin-bottom:8px">💅</div>
          <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:900;letter-spacing:-0.02em">Belle Studio</h1>
          <p style="margin:6px 0 0;color:#fde8e0;font-size:14px">Lembrete de Agendamento</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 40px">
          <p style="color:#9a7b6e;font-size:16px;margin:0 0 24px">Olá, <strong style="color:#2d1f17">${clientName.split(" ")[0]}</strong>! 👋</p>
          <p style="color:#2d1f17;font-size:15px;margin:0 0 28px;line-height:1.6">Você tem um agendamento <strong>hoje</strong> no Belle Studio. Esperamos te ver em breve!</p>
          <!-- Card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8f5;border-radius:14px;border:1px solid #edddd4;overflow:hidden;margin-bottom:28px">
            <tr><td style="padding:24px 28px">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #edddd4">
                    <span style="color:#9a7b6e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em">Serviço</span><br>
                    <span style="color:#2d1f17;font-size:16px;font-weight:800">${serviceIcon} ${serviceName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #edddd4">
                    <span style="color:#9a7b6e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em">Profissional</span><br>
                    <span style="color:#2d1f17;font-size:15px;font-weight:700">👩 ${professionalName}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0;border-bottom:1px solid #edddd4">
                    <span style="color:#9a7b6e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em">Horário</span><br>
                    <span style="color:#2d1f17;font-size:15px;font-weight:700">🕐 ${time}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0">
                    <span style="color:#9a7b6e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em">Valor</span><br>
                    <span style="color:#b5533c;font-size:18px;font-weight:900">R$${price}</span>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
          <p style="color:#9a7b6e;font-size:13px;line-height:1.6;margin:0 0 28px">Precisa cancelar ou remarcar? Entre em contato com antecedência pelo WhatsApp do salão.</p>
          <p style="color:#2d1f17;font-size:15px;margin:0">Com carinho,<br><strong>Equipe Belle Studio 💅</strong></p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#fdf8f5;padding:20px 40px;text-align:center;border-top:1px solid #edddd4">
          <p style="margin:0;color:#9a7b6e;font-size:11px">Este e-mail foi enviado automaticamente pelo sistema Belle Studio.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: `Olá, ${clientName.split(" ")[0]}!\n\nLembrete do seu agendamento hoje no Belle Studio:\n\nServiço: ${serviceName}\nProfissional: ${professionalName}\nHorário: ${time}\nValor: R$${price}\n\n— Belle Studio`,
  };
}

function newBookingOwnerTemplate({ clientName, clientEmail, clientPhone, serviceName, professionalName, date, time }) {
  const [y, m, d] = date.split("-");
  const fmtDate = `${d}/${m}/${y}`;
  return {
    subject: `📅 Novo agendamento — ${clientName} — ${fmtDate} ${time}`,
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f0ec;font-family:Georgia,serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0ec;padding:40px 20px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <tr><td style="background:#2d1f17;padding:28px 36px;text-align:center;border-bottom:3px solid #b5533c">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:900">💅 Belle Studio</h1>
          <p style="margin:4px 0 0;color:#c49a3c;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase">Novo Agendamento Recebido</p>
        </td></tr>
        <tr><td style="padding:32px 36px">
          <div style="background:#fff8f5;border-radius:12px;border-left:4px solid #b5533c;padding:20px 24px;margin-bottom:24px">
            <p style="margin:0 0 4px;color:#9a7b6e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em">Cliente</p>
            <p style="margin:0;color:#2d1f17;font-size:18px;font-weight:900">${clientName}</p>
            <p style="margin:4px 0 0;color:#9a7b6e;font-size:13px">${clientEmail} · ${clientPhone}</p>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${[["Serviço", serviceName],["Profissional", professionalName],["Data", fmtDate],["Horário", time]].map(([l,v])=>`
            <tr><td style="padding:10px 0;border-bottom:1px solid #edddd4">
              <span style="color:#9a7b6e;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em">${l}</span><br>
              <span style="color:#2d1f17;font-size:14px;font-weight:700">${v}</span>
            </td></tr>`).join("")}
          </table>
          <p style="margin:24px 0 0;color:#9a7b6e;font-size:12px">Acesse o painel para confirmar ou gerenciar este agendamento.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: `Novo agendamento!\n\nCliente: ${clientName} (${clientEmail})\nServiço: ${serviceName}\nProfissional: ${professionalName}\nData: ${fmtDate} às ${time}`,
  };
}

function consentRequestTemplate({ clientName, type, serviceName, originalDate, originalTime, newDate, newTime, reason }) {
  const fmtD = (d) => { if(!d)return""; const[y,m,day]=d.split("-"); return `${day}/${m}/${y}`; };
  return {
    subject: `⚠️ Solicitação do Belle Studio — ${type === "cancel" ? "Cancelamento" : "Remarcação"}`,
    html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#fdf8f5;font-family:Georgia,serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf8f5;padding:40px 20px">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden">
        <tr><td style="background:#c49a3c;padding:24px 36px;text-align:center">
          <h2 style="margin:0;color:#fff;font-size:18px">⚠️ Solicitação do Belle Studio</h2>
        </td></tr>
        <tr><td style="padding:32px 36px">
          <p style="color:#2d1f17;font-size:15px;margin:0 0 20px">Olá, <strong>${clientName.split(" ")[0]}</strong>!</p>
          <p style="color:#2d1f17;font-size:14px;line-height:1.6;margin:0 0 20px">
            O Belle Studio está solicitando um <strong>${type === "cancel" ? "cancelamento" : "remarcação"}</strong> do seu agendamento de <strong>${serviceName}</strong>.
          </p>
          ${type === "reschedule" ? `
          <div style="background:#fff8e8;border:1.5px solid #c49a3c;border-radius:10px;padding:16px 20px;margin-bottom:20px">
            <p style="margin:0 0 8px;font-weight:800;color:#c49a3c">Nova data proposta:</p>
            <p style="margin:0;color:#2d1f17"><strong>${fmtD(newDate)}</strong> às <strong>${newTime}</strong></p>
          </div>` : ""}
          <div style="background:#fdf8f5;border-radius:10px;padding:16px 20px;margin-bottom:20px">
            <p style="margin:0 0 4px;color:#9a7b6e;font-size:11px;font-weight:700;text-transform:uppercase">Motivo</p>
            <p style="margin:0;color:#2d1f17;font-size:14px">${reason}</p>
          </div>
          <p style="color:#9a7b6e;font-size:13px;margin:0">Acesse o aplicativo para <strong>aceitar ou recusar</strong> esta solicitação.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: `Solicitação do Belle Studio\n\nOlá ${clientName}!\n\nO salão está solicitando ${type === "cancel" ? "cancelamento" : "remarcação"} do seu agendamento.\nMotivo: ${reason}\n\nAcesse o app para responder.`,
  };
}

// ── Funções públicas ──────────────────────────────────────────

async function sendReminder({ to, clientName, serviceName, serviceIcon, professionalName, date, time, price }) {
  if (!process.env.SMTP_USER) {
    console.log(`[EMAIL] Config ausente — simulando envio para ${to}`);
    return { success: true, simulated: true };
  }
  try {
    const tmpl = reminderTemplate({ clientName, serviceName, serviceIcon, professionalName, date, time, price });
    const info  = await getTransporter().sendMail({ from: process.env.EMAIL_FROM, to, ...tmpl });
    console.log(`[EMAIL] ✅ Lembrete enviado para ${to} — ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EMAIL] ❌ Erro ao enviar para ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

async function sendNewBookingToOwner({ ownerEmail, clientName, clientEmail, clientPhone, serviceName, professionalName, date, time }) {
  if (!process.env.SMTP_USER) {
    console.log(`[EMAIL] Config ausente — simulando notificação de novo agendamento`);
    return { success: true, simulated: true };
  }
  try {
    const tmpl = newBookingOwnerTemplate({ clientName, clientEmail, clientPhone, serviceName, professionalName, date, time });
    const info  = await getTransporter().sendMail({ from: process.env.EMAIL_FROM, to: ownerEmail, ...tmpl });
    console.log(`[EMAIL] ✅ Novo agendamento notificado ao dono — ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EMAIL] ❌ Erro:`, err.message);
    return { success: false, error: err.message };
  }
}

async function sendConsentRequest({ to, clientName, type, serviceName, originalDate, originalTime, newDate, newTime, reason }) {
  if (!process.env.SMTP_USER) {
    console.log(`[EMAIL] Config ausente — simulando envio de consentimento para ${to}`);
    return { success: true, simulated: true };
  }
  try {
    const tmpl = consentRequestTemplate({ clientName, type, serviceName, originalDate, originalTime, newDate, newTime, reason });
    const info  = await getTransporter().sendMail({ from: process.env.EMAIL_FROM, to, ...tmpl });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { sendReminder, sendNewBookingToOwner, sendConsentRequest };
