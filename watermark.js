const API_BASE = "/api";

const fileInput = document.querySelector("#fileInput");
const dropZone = document.querySelector("#dropZone");
const fileSummary = document.querySelector("#fileSummary");
const sourceModeButtons = document.querySelectorAll(".source-mode-button");
const textSourcePanel = document.querySelector("#textSourcePanel");
const fileSourcePanel = document.querySelector("#fileSourcePanel");
const pastedText = document.querySelector("#pastedText");
const serviceStatus = document.querySelector("#serviceStatus");
const inspectButton = document.querySelector("#inspectButton");
const cleanButton = document.querySelector("#cleanButton");
const resetButton = document.querySelector("#resetButton");
const copyReportButton = document.querySelector("#copyReportButton");
const copyCleanedTextButton = document.querySelector("#copyCleanedTextButton");
const downloadLink = document.querySelector("#downloadLink");
const resultTitle = document.querySelector("#resultTitle");
const kindMetric = document.querySelector("#kindMetric");
const suspiciousMetric = document.querySelector("#suspiciousMetric");
const sizeMetric = document.querySelector("#sizeMetric");
const serviceMetric = document.querySelector("#serviceMetric");
const originalPreview = document.querySelector("#originalPreview");
const cleanedPreview = document.querySelector("#cleanedPreview");
const reportOutput = document.querySelector("#reportOutput");
const nfkcOption = document.querySelector("#nfkcOption");
const homoglyphOption = document.querySelector("#homoglyphOption");
const containerTextOption = document.querySelector("#containerTextOption");
const keepMetadataOption = document.querySelector("#keepMetadataOption");
const stripAllOption = document.querySelector("#stripAllOption");

let selectedFile = null;
let selectedBase64 = "";
let selectedSourceType = "";
let inputMode = "text";
let latestReport = "";
let latestCleanedText = "";
let originalObjectUrl = "";
let cleanedObjectUrl = "";

function setStatus(text, state) {
  serviceStatus.textContent = text;
  serviceStatus.classList.toggle("ok", state === "ok");
  serviceStatus.classList.toggle("bad", state === "bad");
}

function setReport(summary, copyable = false) {
  latestReport = summary || "";
  reportOutput.innerHTML = summary ? summaryToHtml(summary) : "";
  copyReportButton.disabled = !latestReport || !copyable;
}

function summaryToHtml(summary) {
  return escapeHtml(summary)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n- /g, "\n<li>")
    .split("\n")
    .map((line, index, lines) => {
      if (line.startsWith("<li>")) {
        const nextLine = lines[index + 1] || "";
        const close = nextLine.startsWith("<li>") ? "" : "</ul>";
        const open = index === 0 || !lines[index - 1].startsWith("<li>") ? "<ul>" : "";
        return `${open}${line}</li>${close}`;
      }
      return line ? `<p>${line}</p>` : "";
    })
    .join("");
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return "-";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function revokeUrl(url) {
  if (url) {
    URL.revokeObjectURL(url);
  }
}

function isTextFile(file) {
  return (
    file.type.startsWith("text/") ||
    /\.(txt|md|markdown|html|htm|css|js|json|csv|xml|svg)$/i.test(file.name)
  );
}

function isImageFile(file) {
  return file.type.startsWith("image/") || /\.(png|jpe?g|webp|svg)$/i.test(file.name);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",").pop() : value);
    };
    reader.onerror = () => reject(reader.error || new Error("Could not read file"));
    reader.readAsDataURL(blob);
  });
}

function blobToText(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read text"));
    reader.readAsText(blob);
  });
}

function textToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  const chunkSize = 8192;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }

  return btoa(binary);
}

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const chunks = [];
  const chunkSize = 8192;

  for (let index = 0; index < binary.length; index += chunkSize) {
    const slice = binary.slice(index, index + chunkSize);
    const bytes = new Uint8Array(slice.length);
    for (let i = 0; i < slice.length; i += 1) {
      bytes[i] = slice.charCodeAt(i);
    }
    chunks.push(bytes);
  }

  return new Blob(chunks, { type: mimeType || "application/octet-stream" });
}

function hideOutputActions() {
  latestCleanedText = "";
  downloadLink.classList.add("hidden");
  downloadLink.textContent = "Download cleaned file";
  copyCleanedTextButton.classList.add("hidden");
  revokeUrl(cleanedObjectUrl);
  cleanedObjectUrl = "";
}

async function requestJson(path, payload) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: payload ? "POST" : "GET",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined
  });
  const data = await response.json().catch(() => ({ ok: false, error: "Invalid JSON response" }));

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Request failed with ${response.status}`);
  }

  return data;
}

function cleanOptions() {
  return {
    nfkc: nfkcOption.checked,
    aggressive_homoglyphs: homoglyphOption.checked,
    also_layer_a_text: containerTextOption.checked,
    keep_non_ai_metadata: keepMetadataOption.checked,
    strip_all_metadata: stripAllOption.checked
  };
}

function sourceLabel() {
  return selectedSourceType === "text" ? "pasted text" : selectedFile?.name || "selected file";
}

function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function markerLabel(hit) {
  const label = hit.label || hit.codepoint || hit.kind || "hidden marker";
  return label.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function inspectHits(result) {
  return result?.report?.hits || result?.hits || [];
}

function removedItems(result) {
  const report = result?.report || {};
  const stats = report.stats || {};

  if (stats.removed && typeof stats.removed === "object" && !Array.isArray(stats.removed)) {
    return Object.entries(stats.removed).map(([label, count]) => ({ label, count }));
  }

  const candidates = [
    stats.removed,
    report.removed,
    report.removed_marks,
    report.removed_hits,
    report.actions,
    report.changes,
    result.removed,
    result.actions,
    result.changes
  ];
  return candidates.find((item) => Array.isArray(item)) || [];
}

function summarizeInspect(result) {
  const hits = inspectHits(result);
  const suspicious = Boolean(result.suspicious || hits.length);
  const lines = [];

  lines.push(suspicious ? `Inspect found ${hits.length} ${pluralize(hits.length, "hidden marker")} in the ${sourceLabel()}.` : `Inspect found no obvious hidden watermark markers in the ${sourceLabel()}.`);

  if (hits.length > 0) {
    lines.push("");
    for (const hit of hits.slice(0, 8)) {
      const count = hit.count || 1;
      const offsets = Array.isArray(hit.sample_offsets) && hit.sample_offsets.length ? ` near character ${hit.sample_offsets[0]}` : "";
      lines.push(`- ${markerLabel(hit)} appeared ${count} ${pluralize(count, "time")}${offsets}.`);
    }
    if (hits.length > 8) {
      lines.push(`- ${hits.length - 8} more marker ${pluralize(hits.length - 8, "type")} found.`);
    }
    lines.push("");
    lines.push("Click `Clean` to remove the markers and preview the cleaned result.");
  } else {
    lines.push("");
    lines.push("You can still click `Clean`; the cleaned output will usually match the original if there are no hidden markers.");
  }

  return lines.join("\n");
}

function summarizeClean(result, blobSize) {
  const removed = removedItems(result);
  const lines = [];
  const isPastedText = selectedSourceType === "text";

  lines.push(isPastedText ? "Clean finished. The cleaned text is ready to copy or download." : "Clean finished. The cleaned file is ready to preview or download.");

  if (removed.length > 0) {
    lines.push("");
    for (const item of removed.slice(0, 8)) {
      if (typeof item === "string") {
        lines.push(`- Removed ${item}.`);
      } else {
        const count = item.count || 1;
        lines.push(`- Removed ${markerLabel(item)} ${count} ${pluralize(count, "time")}.`);
      }
    }
    lines.push("- The visible wording may look the same because these markers are invisible.");
  } else {
    lines.push("");
    lines.push("- No hidden markers were removed, so the cleaned output may match the original.");
  }

  lines.push(`- Output size: ${formatBytes(blobSize)}.`);
  return lines.join("\n");
}

function summarizeError(prefix, error) {
  return `${prefix} failed.\n- ${error.message}`;
}

function clearActiveSource({
  summary = "No text or file selected.",
  title = "Paste text or add a file",
  report = "Paste text or add a file to inspect or clean."
} = {}) {
  selectedFile = null;
  selectedBase64 = "";
  selectedSourceType = "";
  inspectButton.disabled = true;
  cleanButton.disabled = true;
  copyReportButton.disabled = true;
  hideOutputActions();
  revokeUrl(originalObjectUrl);
  revokeUrl(cleanedObjectUrl);
  originalObjectUrl = "";
  cleanedObjectUrl = "";
  fileSummary.textContent = summary;
  resultTitle.textContent = title;
  kindMetric.textContent = "-";
  suspiciousMetric.textContent = "-";
  sizeMetric.textContent = "-";
  originalPreview.textContent = inputMode === "text" ? "Paste text to preview it here." : "No file selected.";
  cleanedPreview.textContent = "Run clean to preview output.";
  setReport(report);
}

function setSourceMode(mode) {
  inputMode = mode;
  sourceModeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.sourceMode === mode);
  });
  textSourcePanel.classList.toggle("hidden", mode !== "text");
  textSourcePanel.classList.toggle("active", mode === "text");
  fileSourcePanel.classList.toggle("hidden", mode !== "file");
  fileSourcePanel.classList.toggle("active", mode === "file");

  if (mode === "text") {
    handlePastedText();
    return;
  }

  if (selectedSourceType !== "file") {
    clearActiveSource({
      summary: "No file selected.",
      title: "Add a file",
      report: "Add a file to inspect or clean."
    });
  }
}

function handlePastedText() {
  if (inputMode !== "text") {
    return;
  }

  const text = pastedText.value;
  if (!text.trim()) {
    clearActiveSource();
    return;
  }

  selectedFile = new File([text], "pasted-text.txt", { type: "text/plain;charset=utf-8" });
  selectedBase64 = textToBase64(text);
  selectedSourceType = "text";
  inspectButton.disabled = false;
  cleanButton.disabled = false;
  hideOutputActions();
  fileSummary.textContent = `Pasted text - ${formatBytes(selectedFile.size)} - text/plain`;
  resultTitle.textContent = "Ready to inspect";
  kindMetric.textContent = "text";
  suspiciousMetric.textContent = "-";
  sizeMetric.textContent = formatBytes(selectedFile.size);
  cleanedPreview.textContent = "Run clean to preview output.";
  originalPreview.innerHTML = `<div class="text-preview">${escapeHtml(text.slice(0, 5000))}</div>`;
  setReport("Ready to inspect.\n- Click `Inspect` to check for hidden watermark markers.\n- Click `Clean` to produce cleaned output.");
}

async function renderOriginalPreview(file) {
  revokeUrl(originalObjectUrl);
  originalObjectUrl = "";

  if (isImageFile(file)) {
    originalObjectUrl = URL.createObjectURL(file);
    originalPreview.innerHTML = `<img alt="Original preview" src="${originalObjectUrl}" />`;
    return;
  }

  if (isTextFile(file)) {
    const text = await blobToText(file);
    originalPreview.innerHTML = `<div class="text-preview">${escapeHtml(text.slice(0, 5000))}</div>`;
    return;
  }

  originalPreview.textContent = "Preview is unavailable for this file type.";
}

async function renderCleanedPreview(blob, sourceFile) {
  latestCleanedText = "";
  copyCleanedTextButton.classList.add("hidden");

  if (isImageFile(sourceFile)) {
    cleanedPreview.innerHTML = `<img alt="Cleaned preview" src="${cleanedObjectUrl}" />`;
    return;
  }

  if (isTextFile(sourceFile)) {
    const text = await blobToText(blob);
    latestCleanedText = text;
    copyCleanedTextButton.classList.remove("hidden");
    cleanedPreview.innerHTML = `<div class="text-preview">${escapeHtml(text.slice(0, 5000))}</div>`;
    return;
  }

  cleanedPreview.textContent = "Cleaned file is ready. Use the download link above.";
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function handleFile(file) {
  selectedFile = file;
  selectedBase64 = await blobToBase64(file);
  selectedSourceType = "file";
  inspectButton.disabled = false;
  cleanButton.disabled = false;
  hideOutputActions();
  fileSummary.textContent = `${file.name} - ${formatBytes(file.size)} - ${file.type || "unknown type"}`;
  resultTitle.textContent = "Ready to inspect";
  kindMetric.textContent = "-";
  suspiciousMetric.textContent = "-";
  sizeMetric.textContent = formatBytes(file.size);
  cleanedPreview.textContent = "Run clean to preview output.";
  setReport("Ready to inspect.\n- Click `Inspect` to check for hidden watermark markers.\n- Click `Clean` to produce cleaned output.");
  await renderOriginalPreview(file);
}

async function inspectSelectedFile() {
  if (!selectedFile || !selectedBase64) {
    return;
  }

  inspectButton.disabled = true;
  resultTitle.textContent = "Inspecting";

  try {
    const result = await requestJson("/inspect", {
      file: selectedBase64,
      name: selectedFile.name
    });
    resultTitle.textContent = result.suspicious ? "Marks detected" : "No obvious marks";
    kindMetric.textContent = result.kind || "-";
    suspiciousMetric.textContent = result.suspicious ? "Yes" : "No";
    setReport(summarizeInspect(result), true);
  } catch (error) {
    resultTitle.textContent = "Inspect failed";
    setReport(summarizeError("Inspect", error), true);
  } finally {
    inspectButton.disabled = false;
  }
}

async function cleanSelectedFile() {
  if (!selectedFile || !selectedBase64) {
    return;
  }

  cleanButton.disabled = true;
  resultTitle.textContent = "Cleaning";
  hideOutputActions();

  try {
    const result = await requestJson("/clean", {
      file: selectedBase64,
      name: selectedFile.name,
      options: cleanOptions()
    });
    const blob = base64ToBlob(result.cleaned, selectedFile.type);
    const isPastedText = selectedSourceType === "text";
    revokeUrl(cleanedObjectUrl);
    cleanedObjectUrl = URL.createObjectURL(blob);
    downloadLink.href = cleanedObjectUrl;
    downloadLink.download = isPastedText ? "cleaned-text.txt" : cleanedName(selectedFile.name);
    downloadLink.textContent = isPastedText ? "Download cleaned text" : "Download cleaned file";
    downloadLink.classList.remove("hidden");
    resultTitle.textContent = isPastedText ? "Cleaned text ready" : "Cleaned file ready";
    kindMetric.textContent = result.kind || "-";
    suspiciousMetric.textContent = "-";
    sizeMetric.textContent = formatBytes(blob.size);
    setReport(summarizeClean(result, blob.size), true);
    await renderCleanedPreview(blob, selectedFile);
  } catch (error) {
    resultTitle.textContent = "Clean failed";
    setReport(summarizeError("Clean", error), true);
  } finally {
    cleanButton.disabled = false;
  }
}

function cleanedName(name) {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) {
    return `${name}.cleaned`;
  }
  return `${name.slice(0, dot)}.cleaned${name.slice(dot)}`;
}

function reset() {
  pastedText.value = "";
  fileInput.value = "";
  setSourceMode("text");
  clearActiveSource({
    report: "The inspection summary will appear here."
  });
}

async function checkService() {
  try {
    const health = await requestJson("/health");
    await requestJson("/capabilities");
    setStatus("Service ready", "ok");
    serviceMetric.textContent = health.version || "ready";
    setReport("Service ready.\n- Paste text or add a file.\n- Click `Inspect` to see what was found.\n- Click `Clean` to produce cleaned output.");
  } catch (error) {
    setStatus("Service offline", "bad");
    serviceMetric.textContent = "offline";
    setReport(`Service offline.\n- ${error.message}\n- Start the local app server with \`python3 server.py\`.`);
  }
}

fileInput.addEventListener("change", async () => {
  const [file] = fileInput.files || [];
  if (file) {
    setSourceMode("file");
    await handleFile(file);
  }
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("dragging");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragging");
});

dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragging");
  const [file] = event.dataTransfer.files || [];
  if (file) {
    setSourceMode("file");
    await handleFile(file);
  }
});

sourceModeButtons.forEach((button) => {
  button.addEventListener("click", () => setSourceMode(button.dataset.sourceMode));
});

pastedText.addEventListener("input", handlePastedText);
inspectButton.addEventListener("click", inspectSelectedFile);
cleanButton.addEventListener("click", cleanSelectedFile);
resetButton.addEventListener("click", reset);

copyReportButton.addEventListener("click", async () => {
  if (!latestReport) {
    return;
  }
  await navigator.clipboard.writeText(latestReport);
  copyReportButton.textContent = "Copied";
  window.setTimeout(() => {
    copyReportButton.textContent = "Copy summary";
  }, 1200);
});

copyCleanedTextButton.addEventListener("click", async () => {
  if (!latestCleanedText) {
    return;
  }

  try {
    await navigator.clipboard.writeText(latestCleanedText);
    copyCleanedTextButton.textContent = "Copied";
    window.setTimeout(() => {
      copyCleanedTextButton.textContent = "Copy cleaned text";
    }, 1200);
  } catch {
    cleanedPreview.focus();
  }
});

checkService();
