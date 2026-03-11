const express  = require("express");
const { db }   = require("../database/setup");
const { authMiddleware, ownerOnly } = require("../middleware/auth");
const { onNewBooking, onConsentRequest } = require("../services/notificationService");

const router = express.Router();
const uid = () => Math.random().toString(36).slice(2, 11);

function enrichAppt(a) {
  if (!a) return null;
  const client = db.get("users").find({ id: a.clientId }).value() || {};
  const service = db.get("services").find({ id: a.serviceId }).value() || {};
  const prof = db.get("professionals").find({ id: a.professionalId }).value() || {};
  return {
    ...a,
    clientName: client.name, clientEmail: client.email, clientPhone: client.phone,
    serviceName: service.name, serviceIcon: service.icon, servicePrice: service.price, serviceDuration: service.duration,
    professionalName: prof.name, professionalColor: prof.color,
  };
}

// GET /api/appointments
router.get("/", authMiddleware, (req, res) => {
  const { date, status } = req.query;
  let appts = db.get("appointments").value();
  if (req.user.role === "client") appts = appts.filter(a => a.clientId === req.user.id);
  if (date)   appts = appts.filter(a => a.date === date);
  if (status) appts = appts.filter(a => a.status === status);
  appts.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  res.json(appts.map(enrichAppt));
});

// POST /api/appointments
router.post("/", authMiddleware, async (req, res) => {
  const { serviceId, professionalId, date, time, notes, clientId } = req.body;
  if (!serviceId || !professionalId || !date || !time)
    return res.status(400).json({ error: "serviceId, professionalId, date e time são obrigatórios" });

  const effectiveClientId = req.user.role === "client" ? req.user.id : (clientId || req.user.id);

  // Verificar conflito
  const conflict = db.get("appointments").find(a =>
    a.professionalId === professionalId && a.date === date &&
    a.time === time && a.status !== "cancelled"
  ).value();
  if (conflict) return res.status(409).json({ error: "Horário já ocupado" });

  const id = uid();
  const appt = {
    id, clientId: effectiveClientId, serviceId, professionalId,
    date, time, status: "pending", notes: notes || "",
    consentRequest: null, created_at: new Date().toISOString(),
  };
  db.get("appointments").push(appt).write();

  try { await onNewBooking(id); } catch (e) { console.error(e.message); }

  res.status(201).json(enrichAppt(appt));
});

// PATCH /api/appointments/:id
router.patch("/:id", authMiddleware, (req, res) => {
  const appt = db.get("appointments").find({ id: req.params.id }).value();
  if (!appt) return res.status(404).json({ error: "Não encontrado" });

  if (req.user.role === "client") {
    if (appt.clientId !== req.user.id) return res.status(403).json({ error: "Sem permissão" });
    if (req.body.status && req.body.status !== "cancelled") return res.status(403).json({ error: "Cliente só pode cancelar" });
  }

  const allowed = ["status", "notes", "date", "time", "serviceId", "professionalId"];
  const update = {};
  allowed.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
  update.updated_at = new Date().toISOString();

  db.get("appointments").find({ id: req.params.id }).assign(update).write();
  res.json(enrichAppt(db.get("appointments").find({ id: req.params.id }).value()));
});

// POST /api/appointments/:id/consent-request
router.post("/:id/consent-request", authMiddleware, ownerOnly, async (req, res) => {
  const { type, newDate, newTime, reason } = req.body;
  if (!type || !reason) return res.status(400).json({ error: "type e reason obrigatórios" });

  db.get("appointments").find({ id: req.params.id }).assign({
    status: "consent_pending",
    consentRequest: { type, newDate: newDate || null, newTime: newTime || null, reason, status: "pending" },
    updated_at: new Date().toISOString(),
  }).write();

  try { await onConsentRequest(req.params.id); } catch (e) { console.error(e.message); }

  res.json(enrichAppt(db.get("appointments").find({ id: req.params.id }).value()));
});

// POST /api/appointments/:id/consent-response
router.post("/:id/consent-response", authMiddleware, (req, res) => {
  const { accepted } = req.body;
  const appt = db.get("appointments").find({ id: req.params.id }).value();
  if (!appt) return res.status(404).json({ error: "Não encontrado" });

  const cr = appt.consentRequest;
  let update = { updated_at: new Date().toISOString() };
  update.consentRequest = { ...cr, status: accepted ? "accepted" : "refused" };

  if (accepted) {
    if (cr.type === "cancel") update.status = "cancelled";
    else { update.status = "confirmed"; update.date = cr.newDate; update.time = cr.newTime; }
  } else {
    update.status = "confirmed";
  }

  db.get("appointments").find({ id: req.params.id }).assign(update).write();
  res.json(enrichAppt(db.get("appointments").find({ id: req.params.id }).value()));
});

module.exports = router;
