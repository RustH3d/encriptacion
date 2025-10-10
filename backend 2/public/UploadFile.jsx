import React, { useState, useEffect } from "react";

function UploadFile() {
  const [archivo, setArchivo] = useState(null);
  const [estado, setEstado] = useState("");
  const [cargando, setCargando] = useState(false);
  const [receptorActivo, setReceptorActivo] = useState(false);

  // Solicitud de conexión al receptor
  useEffect(() => {
    fetch("http://127.0.0.1:3001/ping")
      .then(res => res.text())
      .then(msg => {
        console.log("Receptor respondió:", msg);
        setReceptorActivo(true);
      })
      .catch(err => {
        console.error("No se pudo conectar con el receptor:", err);
        setReceptorActivo(false);
      });
  }, []);

  const handleArchivo = (e) => {
    setArchivo(e.target.files[0]);
    setEstado("");
  };

  const handleEnviar = async () => {
    if (!archivo) {
      setEstado("Selecciona un archivo primero.");
      return;
    }

    setCargando(true);
    setEstado("");

    const formData = new FormData();
    formData.append("file", archivo);

    try {
      const res = await fetch("/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setEstado("Archivo enviado correctamente.");
      } else {
        setEstado("Error al enviar el archivo.");
      }
    } catch (err) {
      console.error("Error:", err);
      setEstado("No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={estilos.contenedor}>
      <h2>Subir archivo al emisor</h2>

      <p style={{ color: receptorActivo ? "green" : "red" }}>
        {receptorActivo
          ? "✅ Conexión establecida con el receptor"
          : "❌ Receptor no disponible"}
      </p>

      <input type="file" onChange={handleArchivo} />
      {archivo && <p>Archivo seleccionado: {archivo.name}</p>}

      <button onClick={handleEnviar} disabled={cargando}>
        {cargando ? "Enviando..." : "Enviar"}
      </button>

      {estado && <p>{estado}</p>}
    </div>
  );
}

const estilos = {
  contenedor: {
    maxWidth: "400px",
    margin: "40px auto",
    padding: "20px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    textAlign: "center",
    fontFamily: "Arial",
  },
};

export default UploadFile;