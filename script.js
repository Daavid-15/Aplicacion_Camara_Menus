// Mensajes de depuración
function debugLog(message) {
  console.log(message);
  const debugList = document.getElementById("debugList");
  const li = document.createElement("li");
  li.textContent = message;
  debugList.appendChild(li);
}

// Elementos del DOM
const video = document.getElementById("video");
const captureButton = document.getElementById("capture");
const sendButton = document.getElementById("send");
const lastImage = document.getElementById("lastImage");

// Inicializa la cámara
function initCamera() {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(stream => {
      video.srcObject = stream;
      debugLog("Acceso a la cámara concedido");
      video.addEventListener("loadedmetadata", updateOverlay);
    })
    .catch(error => debugLog("Error al acceder a la cámara: " + error));
}
initCamera();

// Actualiza el overlay verde sobre el video
function updateOverlay() {
  const container = document.getElementById("camera-container"),
        overlay = document.querySelector(".green-overlay-video"),
        { width, height } = container.getBoundingClientRect(),
        size = Math.min(width, height) * 0.6;
  overlay.style.width = size + "px";
  overlay.style.height = size + "px";
  overlay.style.left = ((width - size) / 2) + "px";
  overlay.style.top = ((height - size) / 2) + "px";
}
window.addEventListener("resize", updateOverlay);

// Captura la imagen desde el video
function capturePhoto() {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  lastImage.src = canvas.toDataURL("image/png");
  debugLog("Imagen capturada y mostrada");
}

// Envía la imagen capturada al back-end
function sendPhoto() {
  if (!lastImage.src || lastImage.src.indexOf("data:image") !== 0) {
    debugLog("No hay imagen capturada para enviar");
    alert("No hay imagen capturada para enviar");
    return;
  }
  let base64Image = lastImage.src.split(",")[1],
      endpoint = "https://script.google.com/macros/s/AKfycbyp-_LEh2vpD6s48Rly9bmurJGWD0FdjjzXWTqlyiLA2lZl6kLBa3QCb2nvvR4oK_yu/exec";
  fetch(endpoint, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64Image })
  })
  .then(() => {
    debugLog("Imagen enviada correctamente");
    lastImage.src = "";
  })
  .catch(err => debugLog("Error enviando la imagen: " + err.message));
}

// Eventos para capturar y enviar
captureButton.addEventListener("click", async () => {
  debugLog("Botón 'Capturar Foto' presionado");
  const track = video.srcObject.getVideoTracks()[0],
        capabilities = track.getCapabilities();
  if (capabilities.torch) {
    try {
      await track.applyConstraints({ advanced: [{ torch: true }] });
      debugLog("Flash activado");
      capturePhoto();
      await track.applyConstraints({ advanced: [{ torch: false }] });
      debugLog("Flash desactivado");
    } catch (e) {
      debugLog("Error con el flash: " + e);
      capturePhoto();
    }
  } else {
    capturePhoto();
  }
});
sendButton.addEventListener("click", () => {
  debugLog("Botón 'Enviar Imagen' presionado");
  sendPhoto();
});

// Navegación entre pantallas
function showScreen(screenId) {
  document.querySelectorAll('.subscreen').forEach(screen => screen.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  if (screenId === "camera-screen") {
    if (!video.srcObject) initCamera();
    setTimeout(updateOverlay, 100);
  }
}

// Función genérica para cargar imágenes según contenedor y carpeta (para visualizar las imágenes del Drive)
function loadImages(containerId, folder) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  let endpoint = "https://script.google.com/macros/s/AKfycbxNZJxU3s6j1hJO2OHBw9_tL8_mMaZkVImX-iKfTb_BlmAyrQ7FexjmQuFEUw3BRJpD/exec?action=listImages";
  if (folder) endpoint += "&folder=" + folder;
  fetch(endpoint)
    .then(response => response.json())
    .then(data => {
      data.forEach(imgData => {
        const imgContainer = document.createElement("div");
        imgContainer.style.marginBottom = "20px";
        const imgEl = document.createElement("img");
        imgEl.src = imgData.dataUrl;  // Usamos la dataUrl ya en JPEG
        imgEl.alt = imgData.name;
        imgEl.style.cssText = "width: 100%; max-width: 400px; display: block; margin: 0 auto;";
        imgContainer.appendChild(imgEl);
        container.appendChild(imgContainer);
      });
      debugLog("Se han cargado " + data.length + " imágenes en " + containerId);
    })
    .catch(error => debugLog("Error al cargar imágenes en " + containerId + ": " + error));
}



// EventListeners de navegación
document.getElementById('input-btn').addEventListener('click', () => {
  showScreen('input-screen');
  // Para Input, puedes omitir folder o pasar "input" según lo requiera el back-end
  loadImages("input-images", "input");
});
document.getElementById('output-btn').addEventListener('click', () => {
  showScreen('output-screen');
  loadImages("output-images", "output");
});
document.getElementById('camera-btn').addEventListener('click', () => {
  showScreen('camera-screen');
});

