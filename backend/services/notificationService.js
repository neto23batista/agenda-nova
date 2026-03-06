// services/notificationService.js — Orquestrador central de notificações
const { getDb }  = require("../database/setup");
const email      = require("./emailService");
const whatsapp   = require("./whatsappService");

const uid = () => Math.random().toString(36).slice(2, 11);

// ── Salvar notificação no banco ───────────────────────────────

function saveNotification({ type, recipientRole, recipientId, appointmentId, title, message, channel = "app" }) {
  const db = getDb();
  const id = uid();
  db.prepare(`
    INSERT INTO notifications (id, type, recipient_role, recipient_id, appointment_id, title, message, channel)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, type, recipientRole, recipientId || null, appointmentId || null, title, message, channel);
  return id;
}

function logSend({ notificationId, channel, status, provider, providerId, error }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO notification_logs (id, notification_id, channel, status, provider, provider_id, error, sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(uid(), notificationId, channel, status, provider || null, providerId || null, error || null);
}

function markNotificationSent(id) {
  getDb().prepare(`UPDATE notifications SET sent_at = datetime('now') WHERE id = ?`).run(id);
}

// ── Helpers para buscar dados ─────────────────────────────────

function getAppointmentFull(appointmentId) {
  const db = getDb();
  return db.prepare(`
    SELECT
      a.*,
      u.name   AS client_name,
      u.email  AS client_email,
      u.phone  AS client_phone,
      s.name   AS service_name,
      s.icon   AS service_icon,
      s.price  AS service_price,
      p.name   AS professional_name
    FROM appointments a
    JOIN users u         ON u.id = a.client_id
    JOIN services s      ON s.id = a.service_id
    JOIN professionals p ON p.id = a.professional_id
    WHERE a.id = ?
  `).get(appointmentId);
}

function getOwner() {
  return getDb().prepare(`SELECT * FROM users WHERE role = 'owner' LIMIT 1`).get();
}

// ══════════════════════════════════════════════════════════════
//  EVENTO 1: Cliente fez um agendamento → notifica o DONO
// ══════════════════════════════════════════════════════════════

async function onNewBooking(appointmentId) {
  const appt  = getAppointmentFull(appointmentId);
  const owner = getOwner();
  if (!appt || !owner) return;

  const title   = "Novo agendamento recebido!";
  const message = `${appt.client_name} agendou ${appt.service_name} para ${formatDate(appt.date)} às ${appt.time}`;

  // 1. Notificação in-app para o dono
  const notifId = saveNotification({
    type: "new_booking", recipientRole: "owner", recipientId: owner.id,
    appointmentId, title, message, channel: "all",
  });

  // 2. E-mail para o dono
  const emailResult = await email.sendNewBookingToOwner({
    ownerEmail:       owner.email,
    clientName:       appt.client_name,
    clientEmail:      appt.client_email,
    clientPhone:      appt.client_phone,
    serviceName:      appt.service_name,
    professionalName: appt.professional_name,
    date:             appt.date,
    time:             appt.time,
  });
  logSend({ notificationId: notifId, channel: "email", status: emailResult.success ? "sent" : "failed", provider: "nodemailer", error: emailResult.error });

  // 3. WhatsApp para o dono (se tiver número)
  if (owner.phone) {
    const wappResult = await whatsapp.sendNewBookingToOwner({
      ownerPhone:   owner.phone,
      clientName:   appt.client_name,
      serviceName:  appt.service_name,
      date:         appt.date,
      time:         appt.time,
    });
    logSend({ notificationId: notifId, channel: "whatsapp", status: wappResult.success ? "sent" : "failed", provider: process.env.WHATSAPP_PROVIDER, error: wappResult.error });
  }

  markNotificationSent(notifId);
  console.log(`[NOTIF] ✅ Dono notificado sobre novo agendamento ${appointmentId}`);
  return notifId;
}

// ══════════════════════════════════════════════════════════════
//  EVENTO 2: Lembrete do dia → notifica o CLIENTE (WhatsApp + Email)
// ══════════════════════════════════════════════════════════════

async function sendDayReminder(appointmentId) {
  const appt = getAppointmentFull(appointmentId);
  if (!appt) return;

  const title   = "Lembrete do seu agendamento de hoje!";
  const message = `${appt.service_name} com ${appt.professional_name} às ${appt.time}`;

  const notifId = saveNotification({
    type: "reminder", recipientRole: "client", recipientId: appt.client_id,
    appointmentId, title, message, channel: "all",
  });

  // E-mail para o cliente
  const emailResult = await email.sendReminder({
    to:               appt.client_email,
    clientName:       appt.client_name,
    serviceName:      appt.service_name,
    serviceIcon:      appt.service_icon,
    professionalName: appt.professional_name,
    date:             appt.date,
    time:             appt.time,
    price:            appt.service_price,
  });
  logSend({ notificationId: notifId, channel: "email", status: emailResult.success ? "sent" : "failed", provider: "nodemailer", error: emailResult.error });

  // WhatsApp para o cliente
  if (appt.client_phone) {
    const wappResult = await whatsapp.sendReminder({
      phone:            appt.client_phone,
      clientName:       appt.client_name,
      serviceIcon:      appt.service_icon,
      serviceName:      appt.service_name,
      professionalName: appt.professional_name,
      time:             appt.time,
      price:            appt.service_price,
    });
    logSend({ notificationId: notifId, channel: "whatsapp", status: wappResult.success ? "sent" : "failed", provider: process.env.WHATSAPP_PROVIDER, error: wappResult.error });
  }

  markNotificationSent(notifId);
  console.log(`[NOTIF] ✅ Lembrete enviado para ${appt.client_name} (${appt.client_email})`);
}

// ══════════════════════════════════════════════════════════════
//  EVENTO 3: Dono envia solicitação de consentimento → Cliente
// ══════════════════════════════════════════════════════════════

async function onConsentRequest(appointmentId) {
  const appt = getAppointmentFull(appointmentId);
  if (!appt) return;

  const isReschedule = appt.consent_type === "reschedule";
  const title   = `Solicitação do salão: ${isReschedule ? "remarcação" : "cancelamento"}`;
  const message = `${appt.service_name} em ${formatDate(appt.date)} às ${appt.time}. Motivo: ${appt.consent_reason}`;

  const notifId = saveNotification({
    type: "consent_request", recipientRole: "client", recipientId: appt.client_id,
    appointmentId, title, message, channel: "all",
  });

  // E-mail para o cliente
  const emailResult = await email.sendConsentRequest({
    to:           appt.client_email,
    clientName:   appt.client_name,
    type:         appt.consent_type,
    serviceName:  appt.service_name,
    originalDate: appt.date,
    originalTime: appt.time,
    newDate:      appt.consent_new_date,
    newTime:      appt.consent_new_time,
    reason:       appt.consent_reason,
  });
  logSend({ notificationId: notifId, channel: "email", status: emailResult.success ? "sent" : "failed", provider: "nodemailer", error: emailResult.error });

  // WhatsApp para o cliente
  if (appt.client_phone) {
    const wappResult = await whatsapp.sendConsentRequest({
      phone:       appt.client_phone,
      clientName:  appt.client_name,
      type:        appt.consent_type,
      serviceName: appt.service_name,
      reason:      appt.consent_reason,
      newDate:     appt.consent_new_date,
      newTime:     appt.consent_new_time,
    });
    logSend({ notificationId: notifId, channel: "whatsapp", status: wappResult.success ? "sent" : "failed", provider: process.env.WHATSAPP_PROVIDER, error: wappResult.error });
  }

  markNotificationSent(notifId);
  console.log(`[NOTIF] ✅ Solicitação de consentimento enviada ao cliente ${appt.client_name}`);
}

// ── Envio manual de lembrete (rota do dono) ──────────────────

async function sendManualReminder(appointmentId, channels = ["email", "whatsapp"]) {
  const appt = getAppointmentFull(appointmentId);
  if (!appt) return { success: false, error: "Agendamento não encontrado" };

  const results = {};

  if (channels.includes("email")) {
    results.email = await email.sendReminder({
      to: appt.client_email, clientName: appt.client_name,
      serviceName: appt.service_name, serviceIcon: appt.service_icon,
      professionalName: appt.professional_name, date: appt.date,
      time: appt.time, price: appt.service_price,
    });
  }

  if (channels.includes("whatsapp") && appt.client_phone) {
    results.whatsapp = await whatsapp.sendReminder({
      phone: appt.client_phone, clientName: appt.client_name,
      serviceIcon: appt.service_icon, serviceName: appt.service_name,
      professionalName: appt.professional_name, time: appt.time,
      price: appt.service_price,
    });
  }

  return { success: true, results, client: appt.client_name };
}

function formatDate(d) {
  if (!d) return "";
  const [y,m,day] = d.split("-");
  return `${day}/${m}/${y}`;
}

module.exports = { onNewBooking, sendDayReminder, onConsentRequest, sendManualReminder };
