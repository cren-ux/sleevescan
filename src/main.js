const codeInput = document.querySelector("#code-input");
const lookupButton = document.querySelector("#lookup-button");
const cameraButton = document.querySelector("#camera-button");
const scannerVideo = document.querySelector("#scanner-video");
const scannerStatus = document.querySelector("#scanner-status");
const scannerBadge = document.querySelector("#scanner-badge");

let activeCode = "psa:117401741";
let videoStream = null;
let detectorInterval = null;

function extractSleeveCode(value) {
  const rawValue = value.trim();

  try {
    const url = new URL(rawValue);
    return url.searchParams.get("card")?.trim().toLowerCase() ?? rawValue.toLowerCase();
  } catch (error) {
    return rawValue.toLowerCase();
  }
}

function navigateToDetails(code) {
  const normalized = extractSleeveCode(code);

  if (!normalized) {
    scannerStatus.textContent =
      "Enter a sleeve ID or scan a QR code to open the pricing page.";
    return;
  }

  activeCode = normalized;
  codeInput.value = normalized;

  try {
    const scannedUrl = new URL(code.trim());
    if (scannedUrl.searchParams.has("card")) {
      window.location.href = scannedUrl.toString();
      return;
    }
  } catch (error) {
    // Plain sleeve IDs are handled by the local details route below.
  }

  window.location.href = `./details.html?card=${encodeURIComponent(normalized)}`;
}

function stopScanner() {
  if (detectorInterval) {
    window.clearInterval(detectorInterval);
    detectorInterval = null;
  }

  if (videoStream) {
    videoStream.getTracks().forEach((track) => track.stop());
    videoStream = null;
  }

  scannerVideo.srcObject = null;
  scannerVideo.classList.remove("is-live");
  scannerBadge.textContent = "Camera idle";
  cameraButton.textContent = "Start Camera Scan";
}

async function startScanner() {
  if (!navigator.mediaDevices?.getUserMedia) {
    scannerStatus.textContent =
      "This browser does not support camera capture. Paste a sleeve code instead.";
    return;
  }

  if (videoStream) {
    stopScanner();
    scannerStatus.textContent = "Camera stopped.";
    return;
  }

  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    scannerVideo.srcObject = videoStream;
    scannerVideo.classList.add("is-live");
    await scannerVideo.play();
    scannerBadge.textContent = "Camera live";
    cameraButton.textContent = "Stop Camera Scan";
    scannerStatus.textContent =
      "Point the camera at a QR sticker. This prototype expects encoded sleeve IDs like psa:117401741.";

    if ("BarcodeDetector" in window) {
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });

      detectorInterval = window.setInterval(async () => {
        try {
          const codes = await detector.detect(scannerVideo);
          const value = codes[0]?.rawValue;
          if (value) {
            stopScanner();
            navigateToDetails(value);
          }
        } catch (error) {
          scannerStatus.textContent =
            "Camera is live, but QR detection is not available on this device yet.";
        }
      }, 800);
    } else {
      scannerStatus.textContent =
        "Camera is live. This browser lacks BarcodeDetector, so use manual lookup for now.";
    }
  } catch (error) {
    stopScanner();
    scannerStatus.textContent =
      "Camera access was blocked or unavailable. Manual sleeve lookup still works.";
  }
}

lookupButton.addEventListener("click", () => {
  navigateToDetails(codeInput.value || activeCode);
});

codeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    navigateToDetails(codeInput.value || activeCode);
  }
});

cameraButton.addEventListener("click", () => {
  startScanner();
});

window.addEventListener("beforeunload", () => {
  stopScanner();
});

codeInput.value = activeCode;
