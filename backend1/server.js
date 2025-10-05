//
//
const express= require('express')
const app= express()
const PORT= 3000

const multer = require("multer");
const fs = require("fs");
const axios = require("axios");
const forge = require("node-forge");
const crypto = require("crypto");
const { buffer } = require('stream/consumers');

const upload= multer({dest:'uploads/'})

const RECEIVER_URL= 'http://127.0.0.1:3001/receive'
const RECEIVER_PUBKEY_PATH= 'keys/receiver_public.pem'


const receiverPublicPem= fs.readFileSync(RECEIVER_PUBKEY_PATH,'utf8')
const receiverPublicKey= forge.pki.publicKeyFromPem(receiverPublicPem)


app.post("/upload",upload.single('file'),async(req,res)=>{
    try {

        const fileBuffer= req.file.buffer
        
        const aeskey= crypto.randomBytes(32)
        const iv= crypto.randomBytes(16)

        const cipher= crypto.createCipheriv("aes-256-gcm",aeskey,iv)
        const encryptedFile= Buffer.concat([cipher.update(fileBuffer),cipher.final()])
        const tag=cipher.getAuthTag()


        const keyEncrypted= receiverPublicKey.encrypt(aeskey.toString("binary"),"RSA-OAEP",{
            md: forge.md.sha256.create(),
            mgf1:{md: forge.md.sha256.create()}
        })

        const formData= new FormData()
        formData.append("file_encrypted",encryptedFile,"encrypted.bin")
        formData.append("key_encrypted",Buffer.from(keyEncrypted,"binary"),"key.bin")
        formData.append("iv",iv,"iv.bin")
        formData.append("tag",tag,"tag.bin")
        formData.append("filename",req.file.originalname)

        const response= await  axios.post(RECEIVER_URL,formData,{
            headers: formData.getHeaders()
        })


        res.json({
        message: "Archivo cifrado y enviado correctamente",
        receptor: RECEIVER_URL,
        receptorResponse: response.data,
        });
       
    } catch (error){
       console.error("❌ Error al enviar archivo:", error);
    res.status(500).json({ error: "Error cifrando o enviando archivo" });
    }
    
})

app.listen(PORT,()=>{
    console.log(`Emisor corriendo en puerto http://127.0.0.1:${PORT}`)
})


