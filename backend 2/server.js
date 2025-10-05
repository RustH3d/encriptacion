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

const upload= multer({dest:"/uploads"})

const SAVE_FOLDER = path.join(__dirname, "decrypted_files"); //no hacer esto
if (!fs.existsSync(SAVE_FOLDER)) fs.mkdirSync(SAVE_FOLDER);

const privateKey= fs.readFileSync(
    path.join(__dirname,"keys","receiver_private.pem"),"utf-8"
)

app.post("/receive",upload.single("file_encrypted"),(req,res)=>{
    try {
    const fileEncryoted= fs.readFileSync(req.file.path)
    
    const keyEncrypted= Buffer.from(req.body.key_encrypted,"base64")
    const iv= Buffer.from(req.body.iv,"base64")
    const tag= Buffer.from(req.body.tag,"base64")
    const filename= req.body.filename|| "output.bin"

    const aesKey= crypto.privateDecrypt({
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaephash: "sha256"
    }, keyEncrypted)

    const decipher= crypto.createDecipheriv("aes-256-gcm",aesKey,iv)
    decipher.setAuthTag(tag)

    const decrypted= Buffer.concat([
        decipher.update(fileEncryoted),
        decipher.final()
    ])


    const safeName= path.basename(filename)
    const outPath= path.join(SAVE_FOLDER,safeName)

    fs.writeFileSync(outPath,decrypted)

    res.json({ detail: "✅ Archivo descifrado y guardado", saved_as: outPath });
    } catch (error) {
        console.error("❌ Error al descifrar:", err);
    res
      .status(500)
      .json({ error: "Error descifrando archivo", message: err.message });
    }
})


app.listen(PORT, ()=>{
      console.log(`Receptor corriendo en puerto http://127.0.0.1:${PORT}`)
})