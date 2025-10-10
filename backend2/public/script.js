const fileList = document.getElementById("fileList");
const refreshBtn = document.getElementById("refreshBtn");

refreshBtn.addEventListener("click", loadFiles);
window.addEventListener("load", loadFiles);

async function loadFiles() {
  fileList.innerHTML = "<li>Cargando...</li>";

  try {
    const res = await fetch("/api/files");
    const files = await res.json();

    fileList.innerHTML = "";

    if (!files.length) {
      fileList.innerHTML = "<li>No hay archivos recibidos aún.</li>";
      return;
    }

    files.forEach((f) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${f.filename}</strong><br>
        <small>📅 ${new Date(f.created_at).toLocaleString()}</small><br>
        <a href="/api/decrypt/${f.id}" download>⬇️ Descargar desencriptado</a>
      `;
      fileList.appendChild(li);
    });
  } catch (err) {
    fileList.innerHTML = `<li>Error cargando archivos: ${err.message}</li>`;
  }
}
