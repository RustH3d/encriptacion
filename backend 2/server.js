const express= require('express')
const app= express()
const PORT= 3001
const path=require("path")
const multer= require('multer')
const fs = require("fs");
const axios= require("axios")
const forge = require("node-forge");
const crypto = require("crypto");

const SAVE_FOLDER= "decrypted_files"

fs.mkdirSync(SAVE_FOLDER,{recursive:true})

const PRIVATE_KEY_PATH= "keys/receiver_private.pem"
const privatePem= fs.readFileSync(PRIVATE_KEY_PATH,"utf-8")
const privateKey= forge.pki.privateKeyFromPem(privatePem)

app.post("/receive", upload.single([
    { name: "file_encrypted" },
  { name: "key_encrypted" },
  { name: "iv" },
  { name: "tag" },
  { name: "filename" }
]),(req,res)=>{
    try {
    const fileEncrypted= req.files["file_encrypted"][0].buffer
    const keyEncrypted=req.files["key_encrypted"][0].buffer
    const iv= req.files["iv"][0].buffer
    const filename=  req.body.filename|| "output.bin"


    const aesKey= Buffer.from(privateKey.decrypt(
        keyEncrypted.toString("binary"),
        "RSA-OAEP",
        {md:forge.md.sha256.create(),mgfe1:{md:forge.md.sha256.create()}}
    ),"binary")


    const decipher= crypto.createDecipheriv("aes-256-gcm",aesKey,iv)
    decipher.setAuthTag(tag)
    const decrypted= buffer.concat([decipher.update(fileEncrypted),decipher.final()])

    const safeName= path.basename(filename)
    const outPath= path.join(SAVE_FOLDER,safeName)
    fs.writeFileSync(outPath,decrypted)
    res.json({ detail: "Archivo descifrado y guardado", saved_as: outPath });
    } catch (error) {
         console.error(err);
    res.status(500).json({ error: "Error descifrando archivo", message: err.message });
    }
} )

app.get("/files",(req,res)=>{
    const files= fs.readdirSync(SAVE_FOLDER).map(fn=>{
        const fp= path.join(SAVE_FOLDER,fn)
        return {filename: fn, size: fs.statSync(fp).size}
    })

    res.json(files)
})

app.listen(PORT, ()=>{
      console.log(`Receptor corriendo en puerto http://127.0.0.1:${PORT}`)
})