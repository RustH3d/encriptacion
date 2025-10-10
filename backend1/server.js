const express = require('express');
const app = express();
const PORT = 3000;

const multer = require('multer');
const crypto = require('crypto');
const forge = require('node-forge');
const axios = require('axios');
const FormData = require('form-data');

const upload = multer({ storage: multer.memoryStorage() });

// URL del receptor
const RECEIVER_URL = 'http://127.0.0.1:3001';

// --------------------
// Petición de conexión
// --------------------
async function requestConnection() {
  try {
    const response = await axios.post(`${RECEIVER_URL}/request-connection`);
    // El receptor devuelve su clave pública en PEM
    const receiverPublicPem = response.data.publicKey;
    return forge.pki.publicKeyFromPem(receiverPublicPem);
  } catch (error) {
    console.error('❌ Error solicitando conexión:', error.message);
    throw error;
  }
}


async function sendEncryptedFile(file, receiverPublicKey) {
  try {
    const fileBuffer = file.buffer;

    // Generar clave AES y IV
    const aesKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);

    // Cifrar archivo con AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
    const encryptedFile = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Cifrar clave AES con RSA pública del receptor
    const keyEncrypted = receiverPublicKey.encrypt(aesKey.toString('binary'), 'RSA-OAEP', {
      md: forge.md.sha256.create(),
      mgf1: { md: forge.md.sha256.create() },
    });
    const keyEncryptedBase64 = forge.util.encode64(keyEncrypted);

    // Preparar FormData
    const formData = new FormData();
    formData.append('file_encrypted', encryptedFile, file.originalname + '.enc');
    formData.append('key_encrypted', keyEncryptedBase64);
    formData.append('iv', iv.toString('base64'));
    formData.append('tag', tag.toString('base64'));
    formData.append('filename', file.originalname);

    // Enviar al receptor
    const response = await axios.post(`${RECEIVER_URL}/receive`, formData, {
      headers: formData.getHeaders(),
    });

    console.log('✅ Archivo enviado:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error al enviar archivo:', error.message);
    throw error;
  }
}


app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });

    // 1️⃣ Solicitar conexión y obtener clave pública del receptor
    const receiverPublicKey = await requestConnection();

    // 2️⃣ Cifrar y enviar el archivo
    const result = await sendEncryptedFile(req.file, receiverPublicKey);

    res.json({
      message: 'Archivo cifrado y enviado correctamente',
      receptorResponse: result,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error cifrando o enviando archivo' });
  }
});

app.listen(PORT, () => {
  console.log(`Emisor corriendo en http://127.0.0.1:${PORT}`);
});
