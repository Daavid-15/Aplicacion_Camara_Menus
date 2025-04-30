// Mensajes de depuración
function debugLog(message) {
  console.log(message);
  const debugList = document.getElementById("debugList");
  const li = document.createElement("li");
  li.textContent = message;
  debugList.appendChild(li);
}

// Variable global para cancelar el procesamiento de carga de imágenes
let cancelImageLoading = false;

// Variables globales añadidas
let imageCapture;
let stream = null;
let loadedR_Index = [];


// Elementos del DOM
const video = document.getElementById("video");
const captureButton = document.getElementById("capture");
const sendButton = document.getElementById("send");
const lastImage = document.getElementById("lastImage");

// Inicializa la cámara
function initCamera() {
  navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "environment",
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    }
  })
    .then(s => {
      stream = s;
      video.srcObject = stream;
      
      // Actualizar el overlay cuando se carguen los metadatos
      video.addEventListener("loadedmetadata", updateOverlay);
      
      const track = stream.getVideoTracks()[0];
      imageCapture = new ImageCapture(track);
      
      // Mostrar capacidades de la cámara
      const capabilities = track.getCapabilities();
      debugLog("Cámara:" + JSON.stringify({
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

// Función para capturar la foto
captureButton.addEventListener("click", async () => {
  debugLog("Capturando Imagen...");
  
  let track;
  try {
    track = stream.getVideoTracks()[0];
    const capabilities = track.getCapabilities();
    
    // 1. Usar flash nativo si está disponible
    if (capabilities.fillLightMode?.includes("flash")) {
      await imageCapture.setOptions({ fillLightMode: "flash" });
      const blob = await imageCapture.takePhoto();
      lastImage.src = URL.createObjectURL(blob);
      debugLog("Foto con flash");
      
    // 2. Usar antorcha si flash nativo no está disponible
    } else if (capabilities.torch) {
      try {
        await track.applyConstraints({ advanced: [{ torch: true }] });
        debugLog("Linterna activada");
        await new Promise(resolve => setTimeout(resolve, 200)); // Espera de estabilización
        const blob = await imageCapture.takePhoto();
        lastImage.src = URL.createObjectURL(blob);
        debugLog("Foto sacada");
      } finally {
        if (track && capabilities.torch) {
          await track.applyConstraints({ advanced: [{ torch: false }] })
            .then(() => debugLog("Linterna desactivada"))
            .catch(err => debugLog("Error apagando Linterna: " + err));
        }
      }
    } else {
      // Captura sin flash
      const blob = await imageCapture.takePhoto();
      lastImage.src = URL.createObjectURL(blob);
      debugLog("Foto sin flash");
    }
    
  } catch (error) {
    debugLog("Error en captura: " + error);
    if (track?.getCapabilities().torch) {
      await track.applyConstraints({ advanced: [{ torch: false }] })
        .catch(err => debugLog("Error limpiando flash: " + err));
    }
    throw error;
    
  } finally {
    if (track?.getCapabilities().torch) {
      await track.applyConstraints({ advanced: [{ torch: false }] })
        .catch(err => debugLog("Error final apagando flash: " + err));
    }
  }
});

// Envía la imagen capturada al back-end
function sendPhoto() {
  if (!lastImage.src || lastImage.src.indexOf("blob:") !== 0) {
    debugLog("No hay imagen para enviar");
    alert("No hay imagen para enviar");
    return;
  }
  
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
  // Al cambiar de pantalla, se cancela la carga pendiente marcando la bandera
  cancelImageLoading = true;
  document.querySelectorAll(".subscreen").forEach(screen => screen.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");
  if (screenId === "camera-screen") {
    if (!video.srcObject) initCamera();
    setTimeout(updateOverlay, 100);
  }
}

function loadImages(containerId, folder) {
  // Reiniciamos la bandera de cancelación para iniciar el proceso
  cancelImageLoading = false;

  // Reiniciamos la lista global de índices reversos ya cargados.
  loadedR_Index = [];

  const container = document.getElementById(containerId);
  container.innerHTML = "";
  // Reemplaza esta URL con la base de tu Web App de Apps Script
  const baseEndpoint = "https://script.google.com/macros/s/AKfycbxQfegR3BRQg44Hn_FFWsnr1LirTv1EoaBK5MSssMidPNp5T6zPTGb5TzpHHHLpklmW/exec";
  let countEndpoint = `${baseEndpoint}?action=listCount`;
  if (folder) countEndpoint += "&folder=" + folder;

  // Paso 1: Obtener el número total de imágenes
  fetch(countEndpoint)
    .then(response => response.json())
    .then(countData => {
      const totalImages = countData.count;
      if (totalImages === 0) {
        container.insertAdjacentHTML("beforeend", `<p>No se encontraron imágenes.</p>`);
      } else {
        container.insertAdjacentHTML("beforeend", `<p>Cargando ${totalImages} imagen(es)...</p>`);
      }
      debugLog(`Se detectaron ${totalImages} imagen(es) para cargar en ${containerId}.`);

      // Función recursiva para cargar imagen por imagen
      function loadImageByIndex(index) {
        if (cancelImageLoading) {
          debugLog(`Carga cancelada para ${containerId} en índice ${index}.`);
          return;
        }
        if (index >= totalImages) {
          debugLog("Todas las imágenes han sido solicitadas.");
          return;
        }
        let imageEndpoint = `${baseEndpoint}?action=getImage&index=${index}`;
        if (folder) imageEndpoint += "&folder=" + folder;
        fetch(imageEndpoint)
          .then(response => response.json())
          .then(imgData => {
            if (cancelImageLoading) {
              debugLog(`Carga cancelada al recibir imagen ${index}.`);
              return;
            }
            // Calcular el índice inverso (reverseIndex)
            // La fórmula que usamos es: reverseIndex = totalImages - index.
            const reverseIndex = totalImages - index;
            
            // Si este reverseIndex ya se encuentra en la lista global, omitimos la carga.
            if (loadedR_Index.includes(reverseIndex)) {
              debugLog(`Imagen duplicada omitida (índice reverso: ${reverseIndex}): ${imgData.name}`);
            } else {
              // Agregamos el reverseIndex a la lista global.
              loadedR_Index.push(reverseIndex);
              if (loadedR_Index.length >= totalImages) {
                cancelImageLoading = true;
                debugLog(`Flag No Subida activado: loadedR_Index.length (${loadedR_Index.length}) >= totalImages (${totalImages})`);
              }
              

              if (imgData && imgData.dataUrl) {
                const imgContainer = document.createElement("div");
                imgContainer.style.marginBottom = "20px";

                const imgEl = document.createElement("img");
                imgEl.src = imgData.dataUrl;
                imgEl.alt = imgData.name || `Imagen ${index + 1}`;
                imgEl.style.cssText = "width: 100%; max-width: 400px; display: block; margin: 0 auto;";
                imgContainer.appendChild(imgEl);

                // Mostrar debajo de la imagen el reverseIndex
                const indexLabel = document.createElement("p");
                indexLabel.textContent = `Índice reverso: ${reverseIndex}`;
                indexLabel.style.margin = "5px 0 0";
                indexLabel.style.fontSize = "0.9em";
                indexLabel.style.color = "#555";
                imgContainer.appendChild(indexLabel);

                container.appendChild(imgContainer);
                debugLog(`Imagen cargada (índice ${index}): ${imgData.name || "sin nombre"} con índice reverso: ${reverseIndex}`);
              } else {
                debugLog(`Error: No se pudo obtener la imagen en el índice ${index}`);
              }
            }
            // Solicita la siguiente imagen
            loadImageByIndex(index + 1);
          })
          .catch(error => {
            if (cancelImageLoading) {
              debugLog(`Carga cancelada en el índice ${index} (error: ${error})`);
              return;
            }
            debugLog(`Error al cargar la imagen en el índice ${index}: ${error}`);
            loadImageByIndex(index + 1);
          });
      }
      loadImageByIndex(0);
    })
    .catch(error =>
      debugLog("Error al obtener el total de imágenes: " + error)
    );
}





// EventListeners de navegación
document.getElementById("input-btn").addEventListener("click", () => {

  showScreen("input-screen");
  loadImages("input-images", "input");
});
document.getElementById("output-btn").addEventListener("click", () => {

  showScreen("output-screen");
  loadImages("output-images", "output");
});
document.getElementById("camera-btn").addEventListener("click", () => {
  // Simplemente establece la bandera y muestra la pantalla
  cancelImageLoading = true;
  showScreen("camera-screen");
});

// Evento para enviar la fotografía capturada
sendButton.addEventListener("click", sendPhoto);
