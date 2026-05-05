import { buildQrImageUrl, printQrCode, saveQrCode } from "./qrStore.js";

const qrCodeInput = document.querySelector("#qr-code-input");
const qrModeInputs = document.querySelectorAll("[name='qr-mode']");
const generateQrButton = document.querySelector("#generate-qr-button");
const printQrButton = document.querySelector("#print-qr-button");
const qrPreview = document.querySelector("#qr-preview");
const qrImage = document.querySelector("#qr-image");
const qrPreviewLabel = document.querySelector("#qr-preview-label");
const qrPayload = document.querySelector("#qr-payload");
const qrDownloadLink = document.querySelector("#qr-download-link");

let activeCode = "raw:charizard-base-4";
let activeRecord = null;

function extractSleeveCode(value) {
  const rawValue = value.trim();

  try {
    const url = new URL(rawValue);
    return url.searchParams.get("card")?.trim().toLowerCase() ?? rawValue.toLowerCase();
  } catch (error) {
    return rawValue.toLowerCase();
  }
}

function buildDetailsUrl(code) {
  const detailsUrl = new URL("./details.html", window.location.href);
  detailsUrl.searchParams.set("card", code);
  return detailsUrl.toString();
}

function getSelectedQrMode() {
  return [...qrModeInputs].find((input) => input.checked)?.value ?? "code";
}

function getQrPayload(code) {
  if (getSelectedQrMode() === "link") {
    return buildDetailsUrl(code);
  }

  return code;
}

function renderQrCode({ save = false } = {}) {
  const normalized = extractSleeveCode(qrCodeInput.value || activeCode);

  if (!normalized) {
    return;
  }

  activeCode = normalized;
  qrCodeInput.value = normalized;
  const payload = getQrPayload(normalized);
  const mode = getSelectedQrMode();
  const qrUrl = buildQrImageUrl(payload);
  const record = {
    code: normalized,
    mode,
    payload,
  };

  activeRecord = save ? saveQrCode(record) : record;
  qrImage.src = qrUrl;
  qrPreviewLabel.textContent = mode === "link" ? "Direct card link" : normalized;
  qrPayload.textContent = payload;
  qrDownloadLink.href = qrUrl;
  qrPreview.hidden = false;
  printQrButton.hidden = false;
}

function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const mode = params.get("mode");

  if (code) {
    qrCodeInput.value = code;
    activeCode = extractSleeveCode(code);
  }

  if (mode === "code" || mode === "link") {
    const input = [...qrModeInputs].find((item) => item.value === mode);
    if (input) {
      input.checked = true;
    }
  }
}

generateQrButton.addEventListener("click", () => {
  renderQrCode({ save: true });
});

printQrButton.addEventListener("click", () => {
  if (activeRecord) {
    printQrCode(activeRecord);
  }
});

qrCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    renderQrCode({ save: true });
  }
});

qrModeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    if (!qrPreview.hidden) {
      renderQrCode();
    }
  });
});

qrCodeInput.value = activeCode;
applyUrlParams();
