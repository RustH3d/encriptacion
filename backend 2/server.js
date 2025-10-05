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
require("dotenv").config()

const upload= multer({storage: multer.memoryStorage()})

/* const SAVE_FOLDER = path.join(__dirname, "decrypted_files"); //no hacer esto
if (!fs.existsSync(SAVE_FOLDER)) fs.mkdirSync(SAVE_FOLDER);
 */


const privateKey= fs.readFileSync(
    path.join(__dirname,"keys","receiver_private.pem"),"utf-8"
)

const pool= new Pool({
    user:  "postgres",
  host:  "localhost",
  database:  "encriptacion",
  password:  "L1nk3d",
  port:  5432,
})

app.post("/receive",upload.single("file_encrypted"),async(req,res)=>{
    try {

    const {key_encrypted,iv,tag,filename}= req.body
    const fileEncrypted= fs.readFileSync(req.file.path)
    
    const query= `
    INSERT INTO file_records (filename, iv, tag, key_encrypted, file_encrypted)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id
`

        const values= [filename,iv,tag,key_encrypted,fileEncrypted]
        const result= await pool.query(query,values)

  // Eliminar el archivo temporal
    fs.unlinkSync(req.file.path)

    res.json({ 
        detail: "✅ Archivo cifrado recibido y guardado en la base de datos",
      id: result.rows[0].id,
     });
    } catch (error) {
        console.error("❌ Error en /receive:", err);
    res.status(500).json({ error: "Error guardando archivo" });
    }
})

app.get('/:decrypt/:id',async(req,res)=>{
    try {
        const result= await pool.query(`SELECT * FROM file_records WHERE id = $1`,[req.params.id])
        const record= result.rows[0]
        if (!record) return res.status(404).json({ error: "Archivo no encontrado" });

        const aesKey= crypto.privateDecrypt({
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256"
        }, Buffer.from(record.key_encrypted,"base64"))

        const decipher= crypto.createDecipheriv(
            "aes-256-gcm",
            aesKey,
            Buffer.from(record.iv,"base64")
        )
        decipher.setAuthTag(Buffer.from(record.tag,"base64"))

        const decrypted= Buffer.concat(
             [
                decipher.update(record.file_encrypted),
                decipher.final()
             ]
        )

        res.setHeader("Content-Type", "application/octet-stream")
        res.send(decrypted)

    } catch (error) {
    console.error("❌ Error al descifrar:", err);
    res.status(500).json({ error: "Error descifrando archivo" });
    }
})



app.listen(PORT, ()=>{
      console.log(`Receptor corriendo en puerto http://127.0.0.1:${PORT}`)
})