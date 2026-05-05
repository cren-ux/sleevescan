const qrCodeInput = document.querySelector("#qr-code-input");
const qrModeInputs = document.querySelectorAll("[name='qr-mode']");
const generateQrButton = document.querySelector("#generate-qr-button");
const qrImage = document.querySelector("#qr-image");
const qrPreviewLabel = document.querySelector("#qr-preview-label");
const qrPayload = document.querySelector("#qr-payload");
const qrDownloadLink = document.querySelector("#qr-download-link");

let activeCode = "raw:charizard-base-4";

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

function renderQrCode() {
  const normalized = extractSleeveCode(qrCodeInput.value || activeCode);

  if (!normalized) {
    return;
  }

  activeCode = normalized;
  qrCodeInput.value = normalized;
  const payload = getQrPayload(normalized);
  const qrUrl = new URL("https://api.qrserver.com/v1/create-qr-code/");
  qrUrl.searchParams.set("size", "420x420");
  qrUrl.searchParams.set("margin", "16");
  qrUrl.searchParams.set("data", payload);

  qrImage.src = qrUrl.toString();
  qrPreviewLabel.textContent = getSelectedQrMode() === "link" ? "Direct card link" : normalized;
  qrPayload.textContent = payload;
  qrDownloadLink.href = qrUrl.toString();
}

generateQrButton.addEventListener("click", renderQrCode);

qrCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    renderQrCode();
  }
});

qrModeInputs.forEach((input) => {
  input.addEventListener("change", renderQrCode);
});

qrCodeInput.value = activeCode;
renderQrCode();
