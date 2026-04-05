const state = {
  csvText: "",
  dashboardName: "Colon Cancer Screening Dashboard",
  rulesets: [],
  selectedRulesetId: "",
  evaluationResult: null,
  inbox: [],
  selectedOrderId: null
};

const dashboardNameInput = document.querySelector("#dashboardNameInput");
const csvFileInput = document.querySelector("#csvFileInput");
const rulesetSelect = document.querySelector("#rulesetSelect");
const runRulesButton = document.querySelector("#runRulesButton");
const generateOrdersButton = document.querySelector("#generateOrdersButton");
const exportReportButton = document.querySelector("#exportReportButton");
const loadSampleButton = document.querySelector("#loadSampleButton");
const resultsBody = document.querySelector("#resultsBody");
const queueList = document.querySelector("#queueList");
const detailPanel = document.querySelector("#detailPanel");
const totalRowsValue = document.querySelector("#totalRowsValue");
const ruleMatchesValue = document.querySelector("#ruleMatchesValue");
const inboxDraftsValue = document.querySelector("#inboxDraftsValue");
const runInsightValue = document.querySelector("#runInsightValue");
const rulesetName = document.querySelector("#rulesetName");
const rulesetDescription = document.querySelector("#rulesetDescription");
const rulesetMeasure = document.querySelector("#rulesetMeasure");
const rulesetOrder = document.querySelector("#rulesetOrder");
const fileStatusTitle = document.querySelector("#fileStatusTitle");
const fileStatusText = document.querySelector("#fileStatusText");

bootstrap();

async function bootstrap() {
  await resetDemoSession();
  await loadRulesets();
  await refreshInbox();
  bindEvents();
  resetClientState();
}

function bindEvents() {
  dashboardNameInput.addEventListener("input", () => {
    state.dashboardName = dashboardNameInput.value;
  });

  csvFileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    state.csvText = await file.text();
    updateFileStatus(file.name, `${file.name} loaded and ready for rule evaluation.`);
  });

  rulesetSelect.addEventListener("change", () => {
    state.selectedRulesetId = rulesetSelect.value;
    renderRulesetContext();
  });

  runRulesButton.addEventListener("click", runRules);
  generateOrdersButton.addEventListener("click", generateDraftOrders);
  exportReportButton.addEventListener("click", exportRunReport);
  loadSampleButton.addEventListener("click", loadSampleCsv);
}

async function loadRulesets() {
  const response = await fetch("/api/rulesets");
  const data = await response.json();
  state.rulesets = data.rulesets;
  state.selectedRulesetId = data.rulesets[0]?.id || "";
  rulesetSelect.innerHTML = data.rulesets
    .map(
      (ruleset) =>
        `<option value="${ruleset.id}">${ruleset.name}</option>`
    )
    .join("");
  rulesetSelect.value = state.selectedRulesetId;
  renderRulesetContext();
}

async function loadSampleCsv() {
  const response = await fetch("/sample-colon-screening.csv");
  state.csvText = await response.text();
  dashboardNameInput.value = "Colon Cancer Screening Dashboard";
  state.dashboardName = dashboardNameInput.value;
  rulesetSelect.value = "colon-cancer-fit";
  state.selectedRulesetId = "colon-cancer-fit";
  updateFileStatus(
    "Sample colon screening CSV ready",
    "Loaded the bundled demo file. You can run the colon cancer outreach rule immediately."
  );
  renderRulesetContext();
}

async function runRules() {
  if (!state.csvText.trim()) {
    window.alert("Upload a CSV or load the sample data first.");
    return;
  }

  const response = await fetch("/api/evaluate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      dashboardName: state.dashboardName,
      rulesetId: state.selectedRulesetId,
      csvText: state.csvText
    })
  });

  const data = await response.json();
  state.evaluationResult = data;
  generateOrdersButton.disabled = !data.evaluations.some((item) => item.triggered);
  exportReportButton.disabled = data.evaluations.length === 0;
  renderEvaluation();
}

async function generateDraftOrders() {
  const recommendations = (state.evaluationResult?.evaluations || []).filter(
    (item) => item.triggered
  );

  if (recommendations.length === 0) {
    window.alert("No triggered recommendations are available.");
    return;
  }

  await fetch("/api/orders/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      dashboardName: state.dashboardName,
      recommendations
    })
  });

  await refreshInbox();
}

async function refreshInbox() {
  const response = await fetch("/api/inbox");
  const data = await response.json();
  state.inbox = data.orders;
  if (!state.selectedOrderId && state.inbox[0]) {
    state.selectedOrderId = state.inbox[0].id;
  }
  if (!state.inbox.find((order) => order.id === state.selectedOrderId)) {
    state.selectedOrderId = state.inbox[0]?.id || null;
  }
  inboxDraftsValue.textContent = String(state.inbox.length);
  renderInbox();
}

async function resetDemoSession() {
  await fetch("/api/session/reset", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function resetClientState() {
  state.csvText = "";
  state.evaluationResult = null;
  state.inbox = [];
  state.selectedOrderId = null;
  csvFileInput.value = "";
  generateOrdersButton.disabled = true;
  exportReportButton.disabled = true;
  totalRowsValue.textContent = "0";
  ruleMatchesValue.textContent = "0";
  inboxDraftsValue.textContent = "0";
  runInsightValue.textContent = "Awaiting upload";
  updateFileStatus(
    "Fresh session ready",
    "This page clears previous demo runs on load. Upload a CSV or load the sample data to begin."
  );
  resultsBody.innerHTML =
    '<tr><td colspan="5" class="empty-state">Upload a CSV and run a ruleset to see patient recommendations.</td></tr>';
}

function renderEvaluation() {
  const evaluations = state.evaluationResult?.evaluations || [];
  totalRowsValue.textContent = String(state.evaluationResult?.totalRows || 0);
  const matches = evaluations.filter((item) => item.triggered).length;
  ruleMatchesValue.textContent = String(matches);
  runInsightValue.textContent =
    evaluations.length === 0
      ? "Awaiting upload"
      : matches === 0
        ? "No patients matched this rule"
        : `${matches} patient${matches === 1 ? "" : "s"} ready for provider review`;

  if (evaluations.length === 0) {
    resultsBody.innerHTML =
      '<tr><td colspan="5" class="empty-state">No rows were found in this CSV.</td></tr>';
    return;
  }

  resultsBody.innerHTML = evaluations
    .map(
      (item) => `
        <tr>
          <td>
            <strong>${escapeHtml(item.patientName || "Unknown patient")}</strong><br />
            <span class="queue-meta">${escapeHtml(item.patientId || "No identifier")}</span>
          </td>
          <td>${escapeHtml(item.gapReason || "No gap reason provided")}</td>
          <td>${escapeHtml(item.recommendedOrder)}</td>
          <td>${escapeHtml(item.provider)}</td>
          <td>
            <span class="status-badge ${item.triggered ? "status-match" : "status-skip"}">
              ${item.triggered ? "Draft recommended" : "No order"}
            </span>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderInbox() {
  if (state.inbox.length === 0) {
    queueList.innerHTML =
      '<div class="detail-empty">No draft orders yet. Generate orders from a dashboard run.</div>';
    detailPanel.innerHTML =
      '<div class="detail-empty">Generate draft orders to populate the provider inbox.</div>';
    return;
  }

  queueList.innerHTML = state.inbox
    .map(
      (order) => `
        <button class="queue-item ${order.id === state.selectedOrderId ? "active" : ""}" data-order-id="${order.id}">
          <strong>${escapeHtml(order.patientName)}</strong>
          <div class="queue-meta">${escapeHtml(order.recommendedOrder)}</div>
          <div class="queue-meta">${escapeHtml(order.decision)} · ${escapeHtml(order.provider)}</div>
          <span class="status-badge ${decisionBadgeClass(order.decision)}">${escapeHtml(order.decision)}</span>
        </button>
      `
    )
    .join("");

  queueList.querySelectorAll("[data-order-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedOrderId = button.dataset.orderId;
      renderInbox();
    });
  });

  renderDetail();
}

function renderDetail() {
  const order = state.inbox.find((item) => item.id === state.selectedOrderId);
  if (!order) {
    detailPanel.innerHTML =
      '<div class="detail-empty">Select an order to review its details.</div>';
    return;
  }

  detailPanel.innerHTML = `
    <div class="detail-grid">
      <div class="detail-group">
        <strong>${escapeHtml(order.patientName)} (${escapeHtml(order.patientId || "No identifier")})</strong>
        <div class="detail-note">Gap: ${escapeHtml(order.gapReason)}</div>
        <div class="detail-note">Recommended order: ${escapeHtml(order.recommendedOrder)}</div>
        <div class="detail-note">Provider: ${escapeHtml(order.provider)}</div>
        <div class="detail-note">Current decision: ${escapeHtml(order.decision)}</div>
      </div>

      <div class="detail-group">
        <strong>Why this draft was created</strong>
        <ul class="explanation-list">
          ${order.explanation.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
        </ul>
      </div>

      <div class="detail-group">
        <strong>Audit note</strong>
        <div class="detail-note">${escapeHtml(order.auditNote)}</div>
      </div>

      <div class="detail-group">
        <strong>Provider action</strong>
        <textarea id="decisionComment" class="decision-comment" rows="3" placeholder="Optional comment to chart or care team"></textarea>
        <div class="decision-row">
          <button class="decision-accept" data-decision="accepted">Accept</button>
          <button class="decision-reject" data-decision="rejected">Reject</button>
          <button class="decision-defer" data-decision="deferred">Defer</button>
        </div>
      </div>

      <div class="detail-group">
        <strong>FHIR ServiceRequest preview</strong>
        <div class="json-caption">Draft resource that could be sent to the EHR for signature workflow.</div>
        <pre>${escapeHtml(JSON.stringify(order.fhirServiceRequest, null, 2))}</pre>
      </div>
    </div>
  `;

  detailPanel.querySelectorAll("[data-decision]").forEach((button) => {
    button.addEventListener("click", async () => {
      const decisionComment = detailPanel.querySelector("#decisionComment").value;
      await fetch(`/api/inbox/${order.id}/decision`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          decision: button.dataset.decision,
          comment: decisionComment
        })
      });
      await refreshInbox();
    });
  });
}

function exportRunReport() {
  const evaluations = state.evaluationResult?.evaluations || [];
  if (evaluations.length === 0) {
    return;
  }

  const rows = [
    ["Patient", "Patient ID", "Gap", "Recommended Order", "Provider", "Triggered", "Explanation"].join(","),
    ...evaluations.map((item) =>
      [
        csvCell(item.patientName),
        csvCell(item.patientId),
        csvCell(item.gapReason),
        csvCell(item.recommendedOrder),
        csvCell(item.provider),
        csvCell(item.triggered ? "Yes" : "No"),
        csvCell(item.explanation.join(" | "))
      ].join(",")
    )
  ];

  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "dashboard-to-orders-report.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return `"${String(value || "").replaceAll('"', '""')}"`;
}

function renderRulesetContext() {
  const ruleset = state.rulesets.find((item) => item.id === state.selectedRulesetId);
  if (!ruleset) {
    return;
  }
  rulesetName.textContent = ruleset.name;
  rulesetDescription.textContent = ruleset.description;
  rulesetMeasure.textContent = ruleset.measure;
  rulesetOrder.textContent = ruleset.recommendedOrder;
}

function updateFileStatus(title, text) {
  fileStatusTitle.textContent = title;
  fileStatusText.textContent = text;
}

function decisionBadgeClass(decision) {
  if (decision === "accepted") return "status-match";
  if (decision === "rejected") return "status-skip";
  if (decision === "deferred") return "";
  return "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
