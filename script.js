// Mensajes de depuración
function debugLog(message) {
  console.log(message);
  const debugList = document.getElementById("debugList");
  const li = document.createElement("li");
  li.textContent = message;
  debugList.appendChild(li);
}
// Variables globales añadidas
let imageCapture;
let stream=null;

// Elementos del DOM
const video = document.getElementById("video");
const captureButton = document.getElementById("capture");
const sendButton = document.getElementById("send");
const lastImage = document.getElementById("lastImage");

// Inicializa la cámara (modificado)
function initCamera() {
  navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "environment",
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    }
  }).then(s => {
    stream = s;
    video.srcObject = stream;
    
    const track = stream.getVideoTracks()[0];
    imageCapture = new ImageCapture(track);
    
    // Detectar capacidades del dispositivo
    const capabilities = track.getCapabilities();
    debugLog("Capacidades de la cámara: " + JSON.stringify({
      flash: capabilities.fillLightMode || 'no soportado',
      torch: capabilities.torch ? 'soportado' : 'no soportado'
    }));
    
  }).catch(error => debugLog("Error cámara: " + error));
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

// Función para capturar la foto (versión corregida)
captureButton.addEventListener("click", async () => {
  debugLog("Botón 'Capturar Foto' presionado");
  
  let track;
  try {
    track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    let flashUsed = false;

    // 1. Intentar usar flash nativo
    if (capabilities.fillLightMode?.includes('flash')) {
      await imageCapture.setOptions({ fillLightMode: 'flash' });
      const blob = await imageCapture.takePhoto();
      lastImage.src = URL.createObjectURL(blob);
      debugLog("Foto con flash nativo");
      flashUsed = true;
      
    // 2. Intentar usar antorcha
    } else if (capabilities.torch) {
      try {
        await track.applyConstraints({ advanced: [{ torch: true }] });
        debugLog("Antorcha activada");
        await new Promise(resolve => setTimeout(resolve, 200)); // Espera estabilización
        const blob = await imageCapture.takePhoto();
        lastImage.src = URL.createObjectURL(blob);
        debugLog("Foto con antorcha");
        flashUsed = true;
      } finally {
        // Asegurar apagado de antorcha
        if (track && capabilities.torch) {
          await track.applyConstraints({ advanced: [{ torch: false }] })
            .then(() => debugLog("Antorcha desactivada"))
            .catch(err => debugLog("Error apagando antorcha: " + err));
        }
      }
      
    // 3. Captura sin flash
    } else {
      const blob = await imageCapture.takePhoto();
      lastImage.src = URL.createObjectURL(blob);
      debugLog("Foto sin flash");
    }
    
  } catch (error) {
    debugLog("Error en captura: " + error);
    // Asegurar apagado de flash si hubo error
    if (track?.getCapabilities().torch) {
      await track.applyConstraints({ advanced: [{ torch: false }] })
        .catch(err => debugLog("Error limpiando flash: " + err));
    }
    throw error;
    
  } finally {
    // Aseguramos apagado del flash en cualquier caso
    if (track?.getCapabilities().torch) {
      await track.applyConstraints({ advanced: [{ torch: false }] })
        .catch(err => debugLog("Error final apagando flash: " + err));
    }
  }
});

// Envía la imagen capturada al back-end
function sendPhoto() {
  // Se espera que la imagen se muestre como URL de objeto (blob)
  if (!lastImage.src || lastImage.src.indexOf("blob:") !== 0) {
    debugLog("No hay imagen capturada para enviar");
    alert("No hay imagen capturada para enviar");
    return;
  }
  
  // Convertir el blob a base64 para enviarlo
  fetch(lastImage.src)
    .then(response => response.blob())
    .then(blob => {
      const reader = new FileReader();
      reader.onloadend = () => {
        let base64Image = reader.result.split(",")[1];
        let endpoint = "https://script.google.com/macros/s/AKfycbyp-_LEh2vpD6s48Rly9bmurJGWD0FdjjzXWTqlyiLA2lZl6kLBa3QCb2nvvR4oK_yu/exec";
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
      };
      reader.readAsDataURL(blob);
    })
    .catch(err => debugLog("Error procesando la imagen: " + err));
}

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
