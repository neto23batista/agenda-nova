// database/setup.js — Banco de dados usando lowdb (JSON puro, sem compilação)
const low    = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const path   = require("path");
const fs     = require("fs");

const DB_DIR  = path.join(__dirname);
const DB_FILE = process.env.DB_PATH || path.join(DB_DIR, "belle.json");

// garante que a pasta existe
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const adapter = new FileSync(DB_FILE);
const db = low(adapter);

// Schema padrão (tabelas vazias)
db.defaults({
  users:             [],
  professionals:     [],
  services:          [],
  appointments:      [],
  notifications:     [],
  notification_logs: [],
}).write();

module.exports = { db };
