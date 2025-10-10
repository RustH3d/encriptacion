


const express = require('express');
const app = express();
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const forge = require('node-forge');
const FormData = require('form-data');

const PORT = 3000;
const RECEIVER_URL = 'http://127.0.0.1:3001/receive';
const RECEIVER_PUBLIC_KEY_URL = 'http://127.0.0.1:3001/public-key';

const upload = multer({ storage: multer.memoryStorage() });

// Subir y cifrar archivo
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });

        const fileBuffer = req.file.buffer;

        // 1️⃣ Solicitar la clave pública del receptor
        const pubKeyPem = await axios.get(RECEIVER_PUBLIC_KEY_URL).then(r => r.data);
        const receiverPublicKey = forge.pki.publicKeyFromPem(pubKeyPem);
        console.log("Clave pública del receptor recibida:", receiverPublicKey);


        // 2️⃣ Crear clave AES y IV
        const aesKey = crypto.randomBytes(32); // AES-256
        const iv = crypto.randomBytes(16);

        // 3️⃣ Cifrar archivo con AES-GCM
        const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
        const encryptedFile = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
        const tag = cipher.getAuthTag();

        // 4️⃣ Cifrar clave AES con clave pública RSA
        const keyEncrypted = receiverPublicKey.encrypt(aesKey.toString('binary'), 'RSA-OAEP', {
            md: forge.md.sha256.create(),
            mgf1: { md: forge.md.sha256.create() }
        });

        // 5️⃣ Preparar formulario para enviar
        const form = new FormData();
        form.append('file_encrypted', encryptedFile, req.file.originalname + '.enc');
        form.append('key_encrypted', forge.util.encode64(keyEncrypted));
        form.append('iv', iv.toString('base64'));
        form.append('tag', tag.toString('base64'));
        form.append('filename', req.file.originalname);

        // 6️⃣ Enviar al receptor
        const response = await axios.post(RECEIVER_URL, form, { headers: form.getHeaders() });

        res.json({ message: 'Archivo cifrado y enviado', receptorResponse: response.data });
    } catch (err) {
        console.error('❌ Error al enviar archivo:', err);
        res.status(500).json({ error: 'Error cifrando o enviando archivo' });
    }
});

app.listen(PORT, () => console.log(`Emisor corriendo en http://127.0.0.1:${PORT}`));