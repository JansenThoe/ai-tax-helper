/**
 * AI Tax Helper — Frontend
 * Handles file selection, form state, API calls, and result rendering.
 */

// ── DOM references ─────────────────────────────────────────────────
const dropZone       = document.getElementById("dropZone");
const fileInput      = document.getElementById("fileInput");
const fileList       = document.getElementById("fileList");
const questionInput  = document.getElementById("questionInput");
const charCount      = document.getElementById("charCount");
const filingStatus   = document.getElementById("filingStatus");
const stateSelect    = document.getElementById("stateOfResidence");
const analyzeBtn     = document.getElementById("analyzeBtn");

// Output panels
const outputIdle     = document.getElementById("outputIdle");
const outputLoading  = document.getElementById("outputLoading");
const outputResults  = document.getElementById("outputResults");
const outputError    = document.getElementById("outputError");

// Result sub-elements
const resultSummary       = document.getElementById("resultSummary");
const extractedTableBody  = document.getElementById("extractedTableBody");
const answerBox           = document.getElementById("answerBox");
const instructionList     = document.getElementById("instructionList");
const errorMessage        = document.getElementById("errorMessage");

const copyBtn  = document.getElementById("copyBtn");
const resetBtn = document.getElementById("resetBtn");
const retryBtn = document.getElementById("retryBtn");

// ── State ──────────────────────────────────────────────────────────
let selectedFiles = [];
let lastResult    = null;

// ── File handling ──────────────────────────────────────────────────
fileInput.addEventListener("change", () => {
  addFiles(Array.from(fileInput.files));
  fileInput.value = ""; // reset so same file can be re-added after removal
});

// Click on drop zone (not the hidden input — input handles it natively)
dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

// Drag and drop
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  addFiles(Array.from(e.dataTransfer.files));
});

function addFiles(newFiles) {
  const maxFiles = 10;
  const allowed  = ["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "text/csv"];

  for (const file of newFiles) {
    if (selectedFiles.length >= maxFiles) {
      alert(`You can upload up to ${maxFiles} files at a time.`);
      break;
    }
    if (!allowed.includes(file.type)) {
      alert(`"${file.name}" is not a supported file type.`);
      continue;
    }
    if (file.size > 20 * 1024 * 1024) {
      alert(`"${file.name}" exceeds the 20 MB limit.`);
      continue;
    }
    selectedFiles.push(file);
  }
  renderFileList();
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  renderFileList();
}

function renderFileList() {
  fileList.innerHTML = "";
  selectedFiles.forEach((file, i) => {
    const li = document.createElement("li");
    li.className = "file-item";
    li.innerHTML = `
      <span class="file-item-name">
        <span class="file-icon" aria-hidden="true">${fileIcon(file.type)}</span>
        <span>${escapeHtml(file.name)}</span>
      </span>
      <button class="file-remove" aria-label="Remove ${escapeHtml(file.name)}" data-index="${i}">✕</button>
    `;
    fileList.appendChild(li);
  });

  fileList.querySelectorAll(".file-remove").forEach((btn) => {
    btn.addEventListener("click", () => removeFile(Number(btn.dataset.index)));
  });
}

function fileIcon(mimeType) {
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.startsWith("image/"))  return "🖼️";
  return "📃";
}

// ── Question textarea ──────────────────────────────────────────────
questionInput.addEventListener("input", () => {
  charCount.textContent = `${questionInput.value.length} / 2000`;
});

// ── Quick question buttons ─────────────────────────────────────────
document.querySelectorAll(".quick-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    questionInput.value = btn.dataset.q;
    charCount.textContent = `${questionInput.value.length} / 2000`;
    questionInput.focus();
  });
});

// ── Analyze ───────────────────────────────────────────────────────
analyzeBtn.addEventListener("click", runAnalysis);

// Cmd+Enter keyboard shortcut
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    if (!analyzeBtn.disabled) runAnalysis();
  }
});

async function runAnalysis() {
  const question = questionInput.value.trim();

  if (selectedFiles.length === 0) {
    alert("Please upload at least one document before analyzing.");
    return;
  }
  if (!question) {
    alert("Please enter a question about your documents.");
    questionInput.focus();
    return;
  }

  showState("loading");
  analyzeBtn.disabled = true;
  analyzeBtn.classList.add("loading");
  analyzeBtn.querySelector(".btn-text").textContent = "Analyzing…";
  // Show accent spinner inside button
  let spinnerEl = analyzeBtn.querySelector(".btn-spinner");
  if (!spinnerEl) {
    spinnerEl = document.createElement("span");
    spinnerEl.className = "spinner btn-spinner";
    spinnerEl.setAttribute("aria-hidden", "true");
    analyzeBtn.prepend(spinnerEl);
  }

  try {
    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("documents", file));
    formData.append("question", question);
    formData.append("filingStatus", filingStatus.value);
    formData.append("stateOfResidence", stateSelect.value);

    const res = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.error || `Server error ${res.status}`);
    }

    lastResult = json.result;
    renderResults(json.result);
    showState("results");
  } catch (err) {
    errorMessage.textContent = err.message || "An unexpected error occurred.";
    showState("error");
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.classList.remove("loading");
    analyzeBtn.querySelector(".btn-text").textContent = "Analyze Documents";
    const spinner = analyzeBtn.querySelector(".btn-spinner");
    if (spinner) spinner.remove();
  }
}

// ── Render results ─────────────────────────────────────────────────
function renderResults(result) {
  // Summary banner
  resultSummary.textContent = result.summary || "Analysis complete.";

  // Extracted data table
  extractedTableBody.innerHTML = "";
  const rows = result.extractedData || [];
  if (rows.length === 0) {
    extractedTableBody.innerHTML = `<tr><td colspan="3" style="color:var(--text-muted);font-style:italic;padding:.75rem">No structured data extracted.</td></tr>`;
  } else {
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(row.label || "—")}</td>
        <td class="value-cell">${escapeHtml(row.value || "—")}</td>
        <td class="source-cell">${escapeHtml(row.source || "—")}</td>
      `;
      extractedTableBody.appendChild(tr);
    });
  }

  // Direct answer
  answerBox.textContent = result.directAnswer || "No answer provided.";

  // Instructions
  instructionList.innerHTML = "";
  const steps = result.instructions || [];
  if (steps.length === 0) {
    instructionList.innerHTML = `<li style="color:var(--text-muted);font-style:italic">No specific form instructions for this query.</li>`;
  } else {
    steps.forEach((step) => {
      const li = document.createElement("li");
      li.className = "instruction-item";
      li.innerHTML = `
        <span class="instruction-number" aria-hidden="true">${step.step}</span>
        <div class="instruction-body">
          <div class="instruction-form">${escapeHtml(step.form || "")}</div>
          <div class="instruction-line">${escapeHtml(step.line || "")}</div>
          <div class="instruction-value">${escapeHtml(step.value || "")}</div>
          ${step.note ? `<div class="instruction-note">ℹ️ ${escapeHtml(step.note)}</div>` : ""}
        </div>
      `;
      instructionList.appendChild(li);
    });
  }

  // Reset to first tab
  switchTab("extracted");
}

// ── Tabs ───────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t) => {
    const active = t.dataset.tab === name;
    t.classList.toggle("active", active);
    t.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("hidden", panel.id !== `tab${capitalize(name)}`);
    panel.classList.toggle("active", panel.id === `tab${capitalize(name)}`);
  });
}

// ── Copy results ───────────────────────────────────────────────────
copyBtn.addEventListener("click", () => {
  if (!lastResult) return;
  const text = buildPlainText(lastResult);
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = "✅ Copied!";
    setTimeout(() => (copyBtn.textContent = "📋 Copy Results"), 2000);
  });
});

function buildPlainText(result) {
  const lines = [];
  lines.push("=== AI TAX HELPER RESULTS ===\n");

  lines.push("SUMMARY");
  lines.push(result.summary || "");
  lines.push("");

  lines.push("EXTRACTED DATA");
  (result.extractedData || []).forEach((r) => {
    lines.push(`  ${r.label}: ${r.value}  (Source: ${r.source})`);
  });
  lines.push("");

  lines.push("DIRECT ANSWER");
  lines.push(result.directAnswer || "");
  lines.push("");

  lines.push("INSTRUCTIONS");
  (result.instructions || []).forEach((s) => {
    lines.push(`  Step ${s.step}: ${s.form} — ${s.line}: ${s.value}`);
    if (s.note) lines.push(`    Note: ${s.note}`);
  });

  return lines.join("\n");
}

// ── Reset / retry ──────────────────────────────────────────────────
resetBtn.addEventListener("click", resetAll);
retryBtn.addEventListener("click", () => {
  showState("idle");
  runAnalysis();
});

function resetAll() {
  selectedFiles = [];
  lastResult    = null;
  renderFileList();
  questionInput.value  = "";
  filingStatus.value   = "";
  stateSelect.value    = "";
  charCount.textContent = "0 / 2000";
  showState("idle");
}

// ── UI state manager ───────────────────────────────────────────────
function showState(state) {
  outputIdle.classList.toggle("hidden",    state !== "idle");
  outputLoading.classList.toggle("hidden", state !== "loading");
  outputResults.classList.toggle("hidden", state !== "results");
  outputError.classList.toggle("hidden",   state !== "error");
}

// ── Utility ────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
