
const express = require('express');
const app = express();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const forge = require('node-forge');

const PORT = 3001;

// Configurar multer para almacenar archivos en memoria
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Crear carpeta keys si no existe
const keysDir = path.join(__dirname, 'keys');
if (!fs.existsSync(keysDir)) fs.mkdirSync(keysDir);

// Rutas de los archivos de clave
const privateKeyPath = path.join(keysDir, 'receiver_private.pem');
const publicKeyPath = path.join(keysDir, 'receiver_public.pem');

// Generar claves si no existen
if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
    const keypair = forge.pki.rsa.generateKeyPair({ bits: 3072, workers: 2 });
    fs.writeFileSync(privateKeyPath, forge.pki.privateKeyToPem(keypair.privateKey));
    fs.writeFileSync(publicKeyPath, forge.pki.publicKeyToPem(keypair.publicKey));
    console.log('🔑 Claves RSA generadas en receptor/keys');
}

// Leer clave privada
const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf-8');
const privateKey = crypto.createPrivateKey(privateKeyPem);

// Conexión a PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'encriptacion',
    password: 'L1nk3d',
    port: 5432,
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoint para que el emisor obtenga la clave pública
app.get('/public-key', (req, res) => {
    const publicKeyPem = fs.readFileSync(publicKeyPath, 'utf-8');
    res.send(publicKeyPem);
});

// Endpoint para recibir archivo cifrado
app.post('/receive', upload.single('file_encrypted'), async (req, res) => {
    try {
        const { key_encrypted, iv, tag, filename } = req.body;

        if (!req.file || !key_encrypted || !iv || !tag || !filename) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }

        const values = [
            filename,
            Buffer.from(iv, 'base64'),
            Buffer.from(tag, 'base64'),
            key_encrypted,
            req.file.buffer
        ];

        const result = await pool.query(
            `INSERT INTO file_records (filename, iv, tag, key_encrypted, file_encrypted)
             VALUES ($1,$2,$3,$4,$5) RETURNING id`,
            values
        );

        res.json({ message: 'Archivo recibido y guardado', id: result.rows[0].id });
    } catch (err) {
        console.error('❌ Error en /receive:', err);
        res.status(500).json({ error: 'Error guardando archivo' });
    }
});

// Endpoint para descifrar y mostrar archivo al usuario
app.get('/decrypt/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM file_records WHERE id=$1', [req.params.id]);
        const record = rows[0];

        if (!record) return res.status(404).send('Archivo no encontrado');

        // Descifrar la clave AES
        const aesKey = crypto.privateDecrypt(
            { key: privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
            Buffer.from(record.key_encrypted, 'base64')
        );

        // Descifrar el archivo
        const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, record.iv);
        decipher.setAuthTag(record.tag);
        const decrypted = Buffer.concat([decipher.update(record.file_encrypted), decipher.final()]);

        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(decrypted);
    } catch (err) {
        console.error('❌ Error al descifrar:', err);
        res.status(500).json({ error: 'Error descifrando archivo' });
    }
});

app.listen(PORT, () => console.log(`Receptor corriendo en http://127.0.0.1:${PORT}`));

