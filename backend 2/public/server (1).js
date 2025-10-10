// ==========================================================
//  🔐 RECEPTOR DE ARCHIVOS CIFRADOS — BACKEND 2
// ==========================================================
const express = require("express");
const app = express();
const PORT = 3001;
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const crypto = require("crypto");
const { Pool } = require("pg");

// ==========================================================
//  CONFIGURACIÓN DE MULTER (memoria)
// ==========================================================
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ==========================================================
//  RUTAS DE CLAVES RSA DEL RECEPTOR
// ==========================================================
const KEYS_DIR = path.join(__dirname, "keys");
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, "receiver_private.pem");
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, "receiver_public.pem");

// Si no existen las claves, generarlas automáticamente
if (!fs.existsSync(PRIVATE_KEY_PATH) || !fs.existsSync(PUBLIC_KEY_PATH)) {
  console.log("⚙️ Generando par de claves RSA...");
  const { generateKeyPairSync } = require("crypto");
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "pkcs1", format: "pem" },
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
  });
  fs.mkdirSync(KEYS_DIR, { recursive: true });
  fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);
  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey);
  console.log("✅ Claves RSA generadas correctamente");
}

// ==========================================================
//  LEER CLAVE PRIVADA Y PÚBLICA DEL RECEPTOR
// ==========================================================
const privateKeyPem = fs.readFileSync(PRIVATE_KEY_PATH, "utf8");
const publicKeyPem = fs.readFileSync(PUBLIC_KEY_PATH, "utf8");

// ==========================================================
//  CONEXIÓN A POSTGRESQL
// ==========================================================
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "encriptacion",
  password: "bionicle2006", // cambia si tu contraseña es diferente
  port: 5432,
});

// ==========================================================
//  MIDDLEWARES
// ==========================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (frontend)
app.use(express.static(path.join(__dirname, "public")));

// ==========================================================
//  ✅ PING /request-connection — entrega la clave pública
// ==========================================================
app.post("/request-connection", (req, res) => {
  try {
    res.json({ ok: true, publicKey: publicKeyPem });
  } catch (error) {
    console.error("❌ Error en /request-connection:", error);
    res.status(500).json({ ok: false, error: "No se pudo entregar la clave pública" });
  }
});

// ==========================================================
//  📦 POST /receive — RECIBE ARCHIVOS CIFRADOS
// ==========================================================
app.post("/receive", upload.single("file_encrypted"), async (req, res) => {
  try {
    const { key_encrypted, iv, tag, filename } = req.body;

    if (!req.file || !key_encrypted || !iv || !tag || !filename) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const fileEncrypted = req.file.buffer;

    const query = `
      INSERT INTO file_records (filename, iv, tag, key_encrypted, file_encrypted)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const values = [
      filename,
      Buffer.from(iv, "base64"),
      Buffer.from(tag, "base64"),
      key_encrypted,
      fileEncrypted,
    ];

    const result = await pool.query(query, values);

    console.log(`📦 Archivo recibido y guardado: ${filename}`);
    res.json({
      ok: true,
      message: "Archivo recibido y guardado correctamente",
      id: result.rows[0].id,
    });
  } catch (error) {
    console.error("❌ Error en /receive:", error);
    res.status(500).json({ error: "Error guardando archivo" });
  }
});

// ==========================================================
//  📂 GET /api/files — LISTA DE ARCHIVOS CIFRADOS
// ==========================================================
app.get("/api/files", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, filename, created_at FROM file_records ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error listando archivos:", error);
    res.status(500).json({ error: "Error obteniendo lista de archivos" });
  }
});

// ==========================================================
//  🔓 GET /api/decrypt/:id — DESCIFRA Y DESCARGA ARCHIVO
// ==========================================================
app.get("/api/decrypt/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM file_records WHERE id = $1", [
      req.params.id,
    ]);
    const record = result.rows[0];

    if (!record) return res.status(404).json({ error: "Archivo no encontrado" });

    // 🔹 DESCIFRAR CLAVE AES CON RSA PRIVADA (OAEP + SHA256)
    const aesKey = crypto.privateDecrypt(
      {
        key: privateKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(record.key_encrypted, "base64")
    );

    // 🔹 DESCIFRAR ARCHIVO CON AES-GCM
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      aesKey,
      Buffer.from(record.iv)
    );
    decipher.setAuthTag(Buffer.from(record.tag));

    const decrypted = Buffer.concat([
      decipher.update(record.file_encrypted),
      decipher.final(),
    ]);

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${record.filename}"`
    );
    res.send(decrypted);
  } catch (error) {
    console.error("❌ Error al descifrar archivo:", error);
    res.status(500).json({ error: "Error descifrando archivo" });
  }
});

// ==========================================================
//  INICIAR SERVIDOR
// ==========================================================
app.listen(PORT, () => {
  console.log(`🚀 Receptor corriendo en http://127.0.0.1:${PORT}`);
});
