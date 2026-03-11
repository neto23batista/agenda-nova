// services/notificationService.js
const { db }    = require("../database/setup");
const email     = require("./emailService");
const whatsapp  = require("./whatsappService");
const uid = () => Math.random().toString(36).slice(2, 11);

function getApptFull(id) {
  const a = db.get("appointments").find({ id }).value();
  if (!a) return null;
  const client  = db.get("users").find({ id: a.clientId }).value() || {};
  const service = db.get("services").find({ id: a.serviceId }).value() || {};
  const prof    = db.get("professionals").find({ id: a.professionalId }).value() || {};
  return { ...a, client_name: client.name, client_email: client.email, client_phone: client.phone,
    service_name: service.name, service_icon: service.icon, service_price: service.price,
    professional_name: prof.name };
}

function saveNotif({ type, recipientRole, recipientId, appointmentId, title, message }) {
  const id = uid();
  db.get("notifications").push({
    id, type, recipient_role: recipientRole, recipient_id: recipientId || null,
    appointment_id: appointmentId || null, title, message,
    read: false, created_at: new Date().toISOString(),
  }).write();
  return id;
}

async function onNewBooking(appointmentId) {
  const appt  = getApptFull(appointmentId);
  const owner = db.get("users").find({ role: "owner" }).value();
  if (!appt || !owner) return;

  const notifId = saveNotif({
    type: "new_booking", recipientRole: "owner", recipientId: owner.id,
    appointmentId,
    title:   "Novo agendamento recebido!",
    message: `${appt.client_name} agendou ${appt.service_name} para ${appt.date} às ${appt.time}`,
  });

  await email.sendNewBookingToOwner({ ownerEmail: owner.email, clientName: appt.client_name,
    clientEmail: appt.client_email, clientPhone: appt.client_phone,
    serviceName: appt.service_name, professionalName: appt.professional_name,
    date: appt.date, time: appt.time });

  if (owner.phone) {
    await whatsapp.sendNewBookingToOwner({ ownerPhone: owner.phone, clientName: appt.client_name,
      serviceName: appt.service_name, date: appt.date, time: appt.time });
  }
  console.log(`[NOTIF] ✅ Dono notificado — novo agendamento ${appointmentId}`);
}

async function sendDayReminder(appointmentId) {
  const appt = getApptFull(appointmentId);
  if (!appt) return;

  saveNotif({ type: "reminder", recipientRole: "client", recipientId: appt.clientId,
    appointmentId, title: "Lembrete do seu agendamento!",
    message: `${appt.service_name} às ${appt.time}` });

  await email.sendReminder({ to: appt.client_email, clientName: appt.client_name,
    serviceName: appt.service_name, serviceIcon: appt.service_icon,
    professionalName: appt.professional_name, date: appt.date,
    time: appt.time, price: appt.service_price });

  if (appt.client_phone) {
    await whatsapp.sendReminder({ phone: appt.client_phone, clientName: appt.client_name,
      serviceIcon: appt.service_icon, serviceName: appt.service_name,
      professionalName: appt.professional_name, time: appt.time, price: appt.service_price });
  }
  console.log(`[NOTIF] ✅ Lembrete enviado — ${appt.client_name}`);
}

async function onConsentRequest(appointmentId) {
  const appt = getApptFull(appointmentId);
  if (!appt) return;
  const cr = appt.consentRequest || {};

  saveNotif({ type: "consent_request", recipientRole: "client", recipientId: appt.clientId,
    appointmentId, title: `Solicitação do salão: ${cr.type === "cancel" ? "cancelamento" : "remarcação"}`,
    message: cr.reason });

  await email.sendConsentRequest({ to: appt.client_email, clientName: appt.client_name,
    type: cr.type, serviceName: appt.service_name, originalDate: appt.date,
    originalTime: appt.time, newDate: cr.newDate, newTime: cr.newTime, reason: cr.reason });

  if (appt.client_phone) {
    await whatsapp.sendConsentRequest({ phone: appt.client_phone, clientName: appt.client_name,
      type: cr.type, serviceName: appt.service_name, reason: cr.reason,
      newDate: cr.newDate, newTime: cr.newTime });
  }
}

async function sendManualReminder(appointmentId, channels = ["email", "whatsapp"]) {
  const appt = getApptFull(appointmentId);
  if (!appt) return { success: false, error: "Agendamento não encontrado" };
  const results = {};
  if (channels.includes("email"))
    results.email = await email.sendReminder({ to: appt.client_email, clientName: appt.client_name,
      serviceName: appt.service_name, serviceIcon: appt.service_icon,
      professionalName: appt.professional_name, date: appt.date,
      time: appt.time, price: appt.service_price });
  if (channels.includes("whatsapp") && appt.client_phone)
    results.whatsapp = await whatsapp.sendReminder({ phone: appt.client_phone,
      clientName: appt.client_name, serviceIcon: appt.service_icon,
      serviceName: appt.service_name, professionalName: appt.professional_name,
      time: appt.time, price: appt.service_price });
  return { success: true, results, client: appt.client_name };
}

module.exports = { onNewBooking, sendDayReminder, onConsentRequest, sendManualReminder };
