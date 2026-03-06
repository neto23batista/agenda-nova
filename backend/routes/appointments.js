// routes/appointments.js — CRUD de agendamentos
const express = require("express");
const { getDb } = require("../database/setup");
const { authMiddleware, ownerOnly } = require("../middleware/auth");
const { onNewBooking, onConsentRequest } = require("../services/notificationService");

const router = express.Router();
const uid    = () => Math.random().toString(36).slice(2, 11);

// ── Query helper ──────────────────────────────────────────────

function buildFullQuery(whereClause = "") {
  return `
    SELECT
      a.id, a.client_id, a.service_id, a.professional_id,
      a.date, a.time, a.status, a.notes,
      a.consent_type, a.consent_new_date, a.consent_new_time,
      a.consent_reason, a.consent_status,
      a.created_at, a.updated_at,
      u.name   AS client_name,
      u.email  AS client_email,
      u.phone  AS client_phone,
      s.name   AS service_name,
      s.icon   AS service_icon,
      s.price  AS service_price,
      s.duration AS service_duration,
      p.name   AS professional_name,
      p.color  AS professional_color
    FROM appointments a
    JOIN users u         ON u.id = a.client_id
    JOIN services s      ON s.id = a.service_id
    JOIN professionals p ON p.id = a.professional_id
    ${whereClause}
    ORDER BY a.date, a.time
  `;
}

function mapAppt(a) {
  return {
    id:             a.id,
    clientId:       a.client_id,
    clientName:     a.client_name,
    clientEmail:    a.client_email,
    clientPhone:    a.client_phone,
    serviceId:      a.service_id,
    serviceName:    a.service_name,
    serviceIcon:    a.service_icon,
    servicePrice:   a.service_price,
    serviceDuration:a.service_duration,
    professionalId: a.professional_id,
    professionalName:a.professional_name,
    professionalColor:a.professional_color,
    date:           a.date,
    time:           a.time,
    status:         a.status,
    notes:          a.notes,
    consentRequest: a.consent_type ? {
      type:      a.consent_type,
      newDate:   a.consent_new_date,
      newTime:   a.consent_new_time,
      reason:    a.consent_reason,
      status:    a.consent_status,
    } : null,
    createdAt:      a.created_at,
    updatedAt:      a.updated_at,
  };
}

// ── GET /api/appointments ─────────────────────────────────────
// Dono vê todos; cliente vê só os seus

router.get("/", authMiddleware, (req, res) => {
  const db    = getDb();
  const { date, status, professionalId } = req.query;

  let where   = "WHERE 1=1";
  const params = [];

  if (req.user.role === "client") {
    where += " AND a.client_id = ?"; params.push(req.user.id);
  }
  if (date)           { where += " AND a.date = ?";              params.push(date); }
  if (status)         { where += " AND a.status = ?";            params.push(status); }
  if (professionalId) { where += " AND a.professional_id = ?";   params.push(professionalId); }

  const rows = db.prepare(buildFullQuery(where)).all(...params);
  res.json(rows.map(mapAppt));
});

// ── POST /api/appointments ────────────────────────────────────
// Cliente ou dono cria

router.post("/", authMiddleware, async (req, res) => {
  const { clientId, serviceId, professionalId, date, time, notes } = req.body;

  if (!serviceId || !professionalId || !date || !time) {
    return res.status(400).json({ error: "serviceId, professionalId, date e time são obrigatórios" });
  }

  const db         = getDb();
  const effectiveClientId = req.user.role === "client" ? req.user.id : (clientId || req.user.id);

  // Verifica conflito de horário
  const conflict = db.prepare(`
    SELECT id FROM appointments
    WHERE professional_id = ? AND date = ? AND time = ? AND status NOT IN ('cancelled')
  `).get(professionalId, date, time);

  if (conflict) {
    return res.status(409).json({ error: "Horário já ocupado para esta profissional" });
  }

  const id = uid();
  db.prepare(`
    INSERT INTO appointments (id, client_id, service_id, professional_id, date, time, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(id, effectiveClientId, serviceId, professionalId, date, time, notes || "");

  const created = db.prepare(buildFullQuery("WHERE a.id = ?")).get(id);

  // 🔔 Dispara notificação automática para o dono
  try { await onNewBooking(id); } catch (e) { console.error("[APPT] Erro na notificação:", e.message); }

  res.status(201).json(mapAppt(created));
});

// ── PATCH /api/appointments/:id ───────────────────────────────

router.patch("/:id", authMiddleware, (req, res) => {
  const db   = getDb();
  const appt = db.prepare("SELECT * FROM appointments WHERE id = ?").get(req.params.id);
  if (!appt) return res.status(404).json({ error: "Agendamento não encontrado" });

  // Cliente só pode cancelar os próprios
  if (req.user.role === "client") {
    if (appt.client_id !== req.user.id) return res.status(403).json({ error: "Sem permissão" });
    if (req.body.status && req.body.status !== "cancelled") return res.status(403).json({ error: "Cliente só pode cancelar" });
  }

  const { status, notes, date, time, serviceId, professionalId } = req.body;
  const fields = [];
  const vals   = [];

  if (status)         { fields.push("status = ?");          vals.push(status); }
  if (notes !== undefined){ fields.push("notes = ?");       vals.push(notes); }
  if (date)           { fields.push("date = ?");            vals.push(date); }
  if (time)           { fields.push("time = ?");            vals.push(time); }
  if (serviceId)      { fields.push("service_id = ?");      vals.push(serviceId); }
  if (professionalId) { fields.push("professional_id = ?"); vals.push(professionalId); }

  if (fields.length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar" });

  fields.push("updated_at = datetime('now')");
  vals.push(req.params.id);

  db.prepare(`UPDATE appointments SET ${fields.join(", ")} WHERE id = ?`).run(...vals);
  const updated = db.prepare(buildFullQuery("WHERE a.id = ?")).get(req.params.id);
  res.json(mapAppt(updated));
});

// ── POST /api/appointments/:id/consent-request ───────────────
// Dono envia solicitação de consentimento ao cliente

router.post("/:id/consent-request", authMiddleware, ownerOnly, async (req, res) => {
  const { type, newDate, newTime, reason } = req.body;
  if (!type || !reason) return res.status(400).json({ error: "type e reason são obrigatórios" });

  const db   = getDb();
  const appt = db.prepare("SELECT id FROM appointments WHERE id = ?").get(req.params.id);
  if (!appt) return res.status(404).json({ error: "Agendamento não encontrado" });

  db.prepare(`
    UPDATE appointments
    SET status = 'consent_pending',
        consent_type = ?, consent_new_date = ?, consent_new_time = ?,
        consent_reason = ?, consent_status = 'pending',
        updated_at = datetime('now')
    WHERE id = ?
  `).run(type, newDate || null, newTime || null, reason, req.params.id);

  // 🔔 Notifica cliente por e-mail + WhatsApp
  try { await onConsentRequest(req.params.id); } catch (e) { console.error(e.message); }

  const updated = db.prepare(buildFullQuery("WHERE a.id = ?")).get(req.params.id);
  res.json(mapAppt(updated));
});

// ── POST /api/appointments/:id/consent-response ──────────────
// Cliente aceita ou recusa

router.post("/:id/consent-response", authMiddleware, async (req, res) => {
  const { accepted } = req.body;
  const db   = getDb();
  const appt = db.prepare("SELECT * FROM appointments WHERE id = ?").get(req.params.id);

  if (!appt) return res.status(404).json({ error: "Agendamento não encontrado" });
  if (req.user.role === "client" && appt.client_id !== req.user.id) {
    return res.status(403).json({ error: "Sem permissão" });
  }

  if (accepted) {
    if (appt.consent_type === "cancel") {
      db.prepare(`
        UPDATE appointments SET status = 'cancelled', consent_status = 'accepted', updated_at = datetime('now') WHERE id = ?
      `).run(req.params.id);
    } else {
      db.prepare(`
        UPDATE appointments
        SET status = 'confirmed', date = ?, time = ?, consent_status = 'accepted', updated_at = datetime('now')
        WHERE id = ?
      `).run(appt.consent_new_date, appt.consent_new_time, req.params.id);
    }
  } else {
    db.prepare(`
      UPDATE appointments SET status = 'confirmed', consent_status = 'refused', updated_at = datetime('now') WHERE id = ?
    `).run(req.params.id);
  }

  const updated = db.prepare(buildFullQuery("WHERE a.id = ?")).get(req.params.id);
  res.json(mapAppt(updated));
});

// ── DELETE /api/appointments/:id ──────────────────────────────

router.delete("/:id", authMiddleware, ownerOnly, (req, res) => {
  const db = getDb();
  db.prepare("DELETE FROM appointments WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
