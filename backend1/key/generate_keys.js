const forge = require("node-forge");
const fs = require("fs");
const path = require("path");

const { privateKey, publicKey } = forge.pki.rsa.generateKeyPair(4096);

// PEM privada
const pemPrivate = forge.pki.privateKeyToPem(privateKey);
// PEM pública
const pemPublic = forge.pki.publicKeyToPem(publicKey);

fs.mkdirSync("keys", { recursive: true });
fs.writeFileSync(path.join("keys", "receiver_private.pem"), pemPrivate);
fs.writeFileSync(path.join("keys", "receiver_public.pem"), pemPublic);

console.log("🔑 Claves RSA generadas en /keys");
