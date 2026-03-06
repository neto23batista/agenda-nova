// database/setup.js — Criação e migração do banco SQLite
const Database = require("better-sqlite3");
const path     = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const DB_PATH = process.env.DB_PATH || "./database/belle.db";

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    runMigrations();
  }
  return db;
}

function runMigrations() {
  db.exec(`
    -- ── USUÁRIOS (dono + clientes) ────────────────────────────
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      email       TEXT NOT NULL UNIQUE,
      phone       TEXT,
      password    TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'client' CHECK(role IN ('owner','client')),
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── PROFISSIONAIS ─────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS professionals (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      specialty   TEXT,
      color       TEXT DEFAULT '#c9807a',
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── SERVIÇOS ──────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS services (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      icon        TEXT DEFAULT '💅',
      duration    INTEGER NOT NULL DEFAULT 60,
      price       REAL NOT NULL DEFAULT 0,
      active      INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── AGENDAMENTOS ──────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS appointments (
      id                TEXT PRIMARY KEY,
      client_id         TEXT NOT NULL REFERENCES users(id),
      service_id        TEXT NOT NULL REFERENCES services(id),
      professional_id   TEXT NOT NULL REFERENCES professionals(id),
      date              TEXT NOT NULL,
      time              TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'pending'
                        CHECK(status IN ('pending','confirmed','done','cancelled','consent_pending')),
      notes             TEXT DEFAULT '',
      consent_type      TEXT,
      consent_new_date  TEXT,
      consent_new_time  TEXT,
      consent_reason    TEXT,
      consent_status    TEXT CHECK(consent_status IN ('pending','accepted','refused') OR consent_status IS NULL),
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── NOTIFICAÇÕES ──────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS notifications (
      id              TEXT PRIMARY KEY,
      type            TEXT NOT NULL CHECK(type IN ('new_booking','reminder','consent_request','system')),
      recipient_role  TEXT NOT NULL CHECK(recipient_role IN ('owner','client')),
      recipient_id    TEXT,
      appointment_id  TEXT REFERENCES appointments(id),
      title           TEXT NOT NULL,
      message         TEXT NOT NULL,
      read            INTEGER NOT NULL DEFAULT 0,
      channel         TEXT DEFAULT 'app' CHECK(channel IN ('app','email','whatsapp','all')),
      sent_at         TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── LOG DE ENVIOS ─────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS notification_logs (
      id              TEXT PRIMARY KEY,
      notification_id TEXT REFERENCES notifications(id),
      channel         TEXT NOT NULL,
      status          TEXT NOT NULL CHECK(status IN ('sent','failed','pending')),
      provider        TEXT,
      provider_id     TEXT,
      error           TEXT,
      sent_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── ÍNDICES ───────────────────────────────────────────────
    CREATE INDEX IF NOT EXISTS idx_appointments_date       ON appointments(date);
    CREATE INDEX IF NOT EXISTS idx_appointments_client     ON appointments(client_id);
    CREATE INDEX IF NOT EXISTS idx_appointments_status     ON appointments(status);
    CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, read);
    CREATE INDEX IF NOT EXISTS idx_notifications_role      ON notifications(recipient_role, read);
  `);
}

module.exports = { getDb };
