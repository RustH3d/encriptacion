const express= require('express')
const app= express()
const PORT= 3001
const path=require("path")
const multer= require('multer')
const fs = require("fs");
const axios= require("axios")
const forge = require("node-forge");
const crypto = require("crypto");
const { buffer } = require('stream/consumers')
const {Pool}= require("pg")
//require("dotenv").config()
const storage= multer.memoryStorage()
const upload= multer({storage})

/* const SAVE_FOLDER = path.join(__dirname, "decrypted_files"); //no hacer esto
if (!fs.existsSync(SAVE_FOLDER)) fs.mkdirSync(SAVE_FOLDER);
 */







// Clave privada del receptor
const privateKey = fs.readFileSync(
  path.join(__dirname, 'keys', 'receiver_private.pem'),
  'utf-8'
);

// Conexión a PostgreSQL
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "encriptacion",
  password: "L1nk3d",
  port: 5432,
});

// Middleware para parsear JSON y urlencoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoint para recibir archivos cifrados
app.post('/receive', upload.single('file_encrypted'), async (req, res) => {
  try {
    const { key_encrypted, iv, tag, filename } = req.body;

     if (!req.file || !key_encrypted || !iv || !tag || !filename) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    // El archivo ya está en memoria con multer
    const fileEncrypted = req.file.buffer;

    const query = `
      INSERT INTO file_records (filename, iv, tag, key_encrypted, file_encrypted)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const values = [
      filename,
      Buffer.from(iv, 'base64'),
      Buffer.from(tag, 'base64'),
      key_encrypted,
      fileEncrypted
    ];

    const result = await pool.query(query, values);

    res.json({
      detail: "✅ Archivo cifrado recibido y guardado en la base de datos",
      id: result.rows[0].id,
    });

  } catch (error) {
    console.error("❌ Error en /receive:", error);
    res.status(500).json({ error: "Error guardando archivo" });
  }
});

// Endpoint para descifrar y descargar archivo
app.get('/decrypt/:id', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM file_records WHERE id = $1`, [req.params.id]);
    const record = result.rows[0];

    if (!record) return res.status(404).json({ error: "Archivo no encontrado" });

    // Descifrado de la clave AES
    const aesKey = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256"
      },
      Buffer.from(record.key_encrypted, 'base64')
    );

    // Descifrado del archivo
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      aesKey,
      Buffer.from(record.iv)
    );
    decipher.setAuthTag(Buffer.from(record.tag));

    const decrypted = Buffer.concat([
      decipher.update(record.file_encrypted),
      decipher.final()
    ]);

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${record.filename}"`);
    res.send(decrypted);

  } catch (error) {
    console.error("❌ Error al descifrar:", error);
    res.status(500).json({ error: "Error descifrando archivo" });
  }
});

app.listen(PORT, () => {
  console.log(`Receptor corriendo en puerto http://127.0.0.1:${PORT}`);
});