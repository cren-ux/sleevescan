import { buildQrImageUrl, getSavedQrCodes, printQrCode } from "./qrStore.js";

const savedQrList = document.querySelector("#saved-qr-list");
const savedQrEmpty = document.querySelector("#saved-qr-empty");

function renderSavedQrCodes() {
  const savedCodes = getSavedQrCodes();
  savedQrList.innerHTML = "";
  savedQrEmpty.hidden = savedCodes.length > 0;

  savedCodes.forEach((record) => {
    const item = document.createElement("article");
    const image = document.createElement("img");
    const content = document.createElement("div");
    const code = document.createElement("strong");
    const mode = document.createElement("p");
    const payload = document.createElement("p");
    const actions = document.createElement("div");
    const editLink = document.createElement("a");
    const printButton = document.createElement("button");

    item.className = "saved-qr-item";
    image.src = buildQrImageUrl(record.payload);
    image.alt = `QR code for ${record.code}`;
    content.className = "saved-qr-item__content";
    code.textContent = record.code;
    mode.textContent = record.mode === "link" ? "Direct link" : "App scan";
    payload.textContent = record.payload;
    actions.className = "saved-qr-item__actions";
    editLink.href = `./qr.html?code=${encodeURIComponent(record.code)}&mode=${record.mode}`;
    editLink.textContent = "Edit";
    printButton.type = "button";
    printButton.dataset.printId = record.id;
    printButton.textContent = "Print";

    content.append(code, mode, payload);
    actions.append(editLink, printButton);
    item.append(image, content, actions);
    savedQrList.appendChild(item);
  });

  savedQrList.querySelectorAll("[data-print-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const record = savedCodes.find((item) => item.id === button.dataset.printId);
      if (record) {
        printQrCode(record);
      }
    });
  });
}

renderSavedQrCodes();
