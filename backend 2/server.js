//h
const express = require('express');
const app = express();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const forge = require('node-forge');
const PORT= 3001
//app.use(express.static(path.join(__dirname, "public")))

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer para recibir archivos en memoria
const upload = multer({ storage: multer.memoryStorage() });

// Conexión a PostgreSQL
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "encriptacion",
  password: "L1nk3d",
  port: 5432,
});

// Generar/usar clave RSA del receptor
const PRIVATE_KEY_PATH = path.join(__dirname, 'keys', 'receiver_private.pem');
const PUBLIC_KEY_PATH = path.join(__dirname, 'keys', 'receiver_public.pem');

let privateKey, publicKey;

if (!fs.existsSync(PRIVATE_KEY_PATH) || !fs.existsSync(PUBLIC_KEY_PATH)) {
    // Generar par de claves si no existen
    const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048 });
    fs.writeFileSync(PRIVATE_KEY_PATH, forge.pki.privateKeyToPem(keypair.privateKey));
    fs.writeFileSync(PUBLIC_KEY_PATH, forge.pki.publicKeyToPem(keypair.publicKey));
    privateKey = keypair.privateKey;
    publicKey = keypair.publicKey;
} else {
    privateKey = forge.pki.privateKeyFromPem(fs.readFileSync(PRIVATE_KEY_PATH, 'utf8'));
    publicKey = forge.pki.publicKeyFromPem(fs.readFileSync(PUBLIC_KEY_PATH, 'utf8'));
}


app.post('/request-connection', (req, res) => {
    try {
    const publicKeyPem = fs.readFileSync(
      path.join(__dirname, 'keys', 'receiver_public.pem'),
      'utf-8'
    );
    res.json({ publicKey: publicKeyPem });
  } catch (error) {
    console.error('Error al entregar la clave pública:', error);
    res.status(500).json({ error: 'No se pudo entregar la clave pública' });
  }
});

// --- Endpoint: recibir archivo cifrado ---
app.post('/receive', upload.single('file_encrypted'), async (req, res) => {
    try {
        const { key_encrypted, iv, tag, filename } = req.body;
        if (!req.file || !key_encrypted || !iv || !tag || !filename)
            return res.status(400).json({ error: "Faltan campos obligatorios" });

        const fileEncrypted = req.file.buffer;

        await pool.query(
            `INSERT INTO file_records (filename, iv, tag, key_encrypted, file_encrypted)
             VALUES ($1,$2,$3,$4,$5)`,
            [
                filename,
                Buffer.from(iv, 'base64'),
                Buffer.from(tag, 'base64'),
                key_encrypted,
                fileEncrypted
            ]
        );

        res.json({ message: "Archivo recibido y almacenado correctamente" });

    } catch (error) {
        console.error("RECEIVE ERROR:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- Endpoint: descifrar archivo ---
app.get('/decrypt/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM file_records WHERE id=$1', [req.params.id]);
        const record = rows[0];
        if (!record) return res.status(404).json({ error: "Archivo no encontrado" });

        // Descifrar clave AES
        const aesKey = crypto.privateDecrypt(
            { key: forge.pki.privateKeyToPem(privateKey), padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
            Buffer.from(record.key_encrypted, 'base64')
        );

        // Descifrar archivo con AES-GCM
        const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, record.iv);
        decipher.setAuthTag(record.tag);
        const decrypted = Buffer.concat([decipher.update(record.file_encrypted), decipher.final()]);

        // Enviar contenido al cliente (no se guarda en disco)
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(decrypted);

    } catch (error) {
        console.error("DECRYPT ERROR:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => console.log(`Receptor corriendo en http://127.0.0.1:${PORT}`));

