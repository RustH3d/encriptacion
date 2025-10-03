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

const upload= multer({dest:'uploads/'})

const RECEIVER_URL= 'http://127.0.0.1:3001/receive'
const RECEIVER_PUBKEY_PATH= 'keys/receiver_public.pem'


const receiverPublicPem= fs.readFileSync(RECEIVER_PUBKEY_PATH,'utf8')
const receiverPublicKey= forge.pki.publicKeyFromPem(receiverPublicPem)


app.post("/upload",upload.single('file'),async(req,res)=>{
    try {
        const filePath= req.file.path
        const filename= req.file.originalname
        const data = fs.readFileSync(filePath);

        const aesKey= crypto.randomBytes(32)
        const iv= crypto.randomBytes(12)



        const cipher= crypto.createCipheriv("aes-256-gcm",aesKey,iv)
        const encrypted= Buffer.concat([cipher.update(data),cipher.final()])
        const tag= cipher.getAuthTag()



        const encryptedKey= Buffer.from(
            receiverPublicKey.encrypt(aesKey.toString("binary"),"RSA-OAEP",{
                md: forge.md.sha256.create(),
                mgf1: {md:forge.md.sha256.create()}
            }),
            "binary"
        )


        const formData={
            file_encrypted:{
                value: encrypted,
                options: {fileName: "enc_"+fileName, contentType:"application/octet-stream"},
            },
            key_encrypted:{
                value: encryptedKey,
                options: {fileName: "key.bin", contentType:"application/octet-stream"},
            },
            iv:{
                value: iv,
                options: {fileName: "iv.bin", contentType:"application/octet-stream"},
            },
            tag:{
                value:tag,
                options: {fileName: "tag.bin", contentType:"application/octet-stream"},
                
            },
            filename:filename,
        }

        const FormData= require("form-data")
        const form= new FormData()
        for(let k in formData){
            if(typeof formData[k]==='string'){
                form.append(k,formData[k])
            }else{
                form.append(k,formData[k].value,formData[k].options)
            }
        }

        const resp= await axios.post(RECEIVER_URL,form,{headers: form.getHeaders()})

        res.json({detail:"Archivo cifrado y enviado",receiver_response:resp.data})
    } catch (error){
        console.error
      res.status(500).json({ error: "Error al procesar archivo", message: err.message });
    }
    
})

app.listen(PORT,()=>{
    console.log(`Emisor corriendo en puerto http://127.0.0.1:${PORT}`)
})


