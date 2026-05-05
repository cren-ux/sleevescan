const STORAGE_KEY = "sleeveScanSavedQrCodes";

export function buildQrImageUrl(payload) {
  const qrUrl = new URL("https://api.qrserver.com/v1/create-qr-code/");
  qrUrl.searchParams.set("size", "420x420");
  qrUrl.searchParams.set("margin", "16");
  qrUrl.searchParams.set("data", payload);
  return qrUrl.toString();
}

export function getSavedQrCodes() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return saved.sort((a, b) => {
      const codeSort = a.code.localeCompare(b.code);
      return codeSort || a.mode.localeCompare(b.mode);
    });
  } catch (error) {
    return [];
  }
}

export function saveQrCode(record) {
  const saved = getSavedQrCodes();
  const nextRecord = {
    ...record,
    id: `${record.code}::${record.mode}`,
    createdAt: record.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const nextSaved = saved.filter((item) => item.id !== nextRecord.id);
  nextSaved.push(nextRecord);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSaved));
  return nextRecord;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function printQrCode(record) {
  const printWindow = window.open("", "_blank", "width=520,height=720");

  if (!printWindow) {
    return false;
  }

  const qrUrl = buildQrImageUrl(record.payload);
  const code = escapeHtml(record.code);
  const payload = escapeHtml(record.payload);
  const mode = record.mode === "link" ? "Direct link" : "App scan";
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Print ${code}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            font-family: Arial, sans-serif;
            color: #0b111a;
          }
          .sheet {
            width: 3.5in;
            padding: 0.22in;
            border: 1px solid #ccd3df;
            text-align: center;
          }
          img {
            display: block;
            width: 2.6in;
            height: 2.6in;
            margin: 0 auto 0.16in;
          }
          h1 {
            margin: 0;
            font-size: 18px;
          }
          p {
            margin: 0.08in 0 0;
            color: #505a6b;
            font-size: 11px;
            overflow-wrap: anywhere;
          }
          @media print {
            body { min-height: auto; }
            .sheet { border: 0; }
          }
        </style>
      </head>
      <body>
        <section class="sheet">
          <img src="${qrUrl}" alt="QR code for ${code}">
          <h1>${code}</h1>
          <p>${mode}</p>
          <p>${payload}</p>
        </section>
        <script>
          window.addEventListener("load", () => {
            window.print();
          });
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
  return true;
}
