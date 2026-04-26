const state = {
  view: "operations",
  operations: {
    csvText: "",
    dashboardName: "Colon Cancer Screening Dashboard",
    rulesets: [],
    selectedRulesetId: "",
    evaluationResult: null,
    expandedEvaluationIndexes: [],
    fhirServerUrl: "https://example-fhir-server.azurehealthcareapis.com"
  },
  builder: {
    view: "canvas",
    csvText: "",
    analysis: null,
    storedRules: [],
    draft: createBlankRuleDraft(),
    selectedNodeId: "root",
    suggestionsCollapsed: true,
    fieldsCollapsed: true,
    nodeCollapsed: true
  }
};

const DEFAULT_DASHBOARD_NAME = "<Add Dasboard name here>";
const DEFAULT_FHIR_SERVER_URL = "https://example-fhir-server.azurehealthcareapis.com";

const elements = {
  operationsTab: document.querySelector("#operationsTab"),
  builderTab: document.querySelector("#builderTab"),
  operationsView: document.querySelector("#operationsView"),
  builderView: document.querySelector("#builderView"),
  dashboardNameInput: document.querySelector("#dashboardNameInput"),
  csvFileInput: document.querySelector("#csvFileInput"),
  rulesetSelect: document.querySelector("#rulesetSelect"),
  loadSampleButton: document.querySelector("#loadSampleButton"),
  runRulesButton: document.querySelector("#runRulesButton"),
  quickViewButton: document.querySelector("#quickViewButton"),
  exportReportButton: document.querySelector("#exportReportButton"),
  sendOrdersButton: document.querySelector("#sendOrdersButton"),
  addFhirServerButton: document.querySelector("#addFhirServerButton"),
  resultsBody: document.querySelector("#resultsBody"),
  totalRowsValue: document.querySelector("#totalRowsValue"),
  ruleMatchesValue: document.querySelector("#ruleMatchesValue"),
  runInsightValue: document.querySelector("#runInsightValue"),
  activeRulesCountValue: document.querySelector("#activeRulesCountValue"),
  rulesetName: document.querySelector("#rulesetName"),
  rulesetDescription: document.querySelector("#rulesetDescription"),
  rulesetMeasure: document.querySelector("#rulesetMeasure"),
  rulesetStatus: document.querySelector("#rulesetStatus"),
  rulesetSource: document.querySelector("#rulesetSource"),
  fileStatusTitle: document.querySelector("#fileStatusTitle"),
  fileStatusText: document.querySelector("#fileStatusText"),
  builderCsvFileInput: document.querySelector("#builderCsvFileInput"),
  analyzeBuilderCsvButton: document.querySelector("#analyzeBuilderCsvButton"),
  builderLoadColonButton: document.querySelector("#builderLoadColonButton"),
  builderAnalysisSummary: document.querySelector("#builderAnalysisSummary"),
  builderProfileName: document.querySelector("#builderProfileName"),
  builderProfileSummary: document.querySelector("#builderProfileSummary"),
  builderFieldCount: document.querySelector("#builderFieldCount"),
  builderSuggestionCount: document.querySelector("#builderSuggestionCount"),
  builderFieldsList: document.querySelector("#builderFieldsList"),
  builderSuggestionsList: document.querySelector("#builderSuggestionsList"),
  builderCanvasTab: document.querySelector("#builderCanvasTab"),
  builderStoredTab: document.querySelector("#builderStoredTab"),
  builderCanvasView: document.querySelector("#builderCanvasView"),
  builderStoredView: document.querySelector("#builderStoredView"),
  builderQuickViewButton: document.querySelector("#builderQuickViewButton"),
  builderToolsSidebar: document.querySelector("#builderToolsSidebar"),
  toggleSuggestionsButton: document.querySelector("#toggleSuggestionsButton"),
  toggleFieldsButton: document.querySelector("#toggleFieldsButton"),
  toggleNodePanelButton: document.querySelector("#toggleNodePanelButton"),
  ruleCanvas: document.querySelector("#ruleCanvas"),
  builderSelectedNodePanel: document.querySelector("#builderSelectedNodePanel"),
  builderRuleSettingsPanel: document.querySelector("#builderRuleSettingsPanel"),
  storedRulesList: document.querySelector("#storedRulesList"),
  csvQuickViewDialog: document.querySelector("#csvQuickViewDialog"),
  csvQuickViewTitle: document.querySelector("#csvQuickViewTitle"),
  csvQuickViewMeta: document.querySelector("#csvQuickViewMeta"),
  csvQuickViewHead: document.querySelector("#csvQuickViewHead"),
  csvQuickViewBody: document.querySelector("#csvQuickViewBody"),
  closeCsvQuickViewButton: document.querySelector("#closeCsvQuickViewButton"),
  saveRuleButton: document.querySelector("#saveRuleButton"),
  resetCanvasButton: document.querySelector("#resetCanvasButton"),
  addAndGroupButton: document.querySelector("#addAndGroupButton"),
  addOrGroupButton: document.querySelector("#addOrGroupButton"),
  deleteNodeButton: document.querySelector("#deleteNodeButton")
};

bootstrap();

async function bootstrap() {
  bindEvents();
  await resetDemoSession();
  await Promise.all([loadOperationsRulesets(), loadStoredRulesets()]);
  resetOperationsState();
  renderCurrentView();
  renderRulesetContext();
  renderEvaluation();
  renderBuilderAnalysis();
  renderBuilderCanvas();
  renderBuilderPanels();
  renderBuilderSidebarState();
  renderStoredRules();
}

function bindEvents() {
  elements.operationsTab.addEventListener("click", () => {
    void switchView("operations");
  });
  elements.builderTab.addEventListener("click", () => {
    void switchView("builder");
  });

  elements.dashboardNameInput.addEventListener("input", () => {
    state.operations.dashboardName = elements.dashboardNameInput.value;
  });

  elements.csvFileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    state.operations.csvText = await file.text();
    maybeSuggestDashboardName(file.name);
    updateFileStatus(file.name, `${file.name} loaded and ready for rule evaluation.`);
  });

  elements.rulesetSelect.addEventListener("change", () => {
    state.operations.selectedRulesetId = elements.rulesetSelect.value;
    maybeSuggestDashboardName();
    renderRulesetContext();
  });

  elements.loadSampleButton.addEventListener("click", loadSampleCsv);
  elements.runRulesButton.addEventListener("click", runRules);
  elements.quickViewButton.addEventListener("click", openCsvQuickView);
  elements.exportReportButton.addEventListener("click", exportRunReport);
  elements.sendOrdersButton.addEventListener("click", sendOrders);
  elements.addFhirServerButton.addEventListener("click", addFhirServer);
  elements.resultsBody.addEventListener("click", handleResultsTableClick);
  elements.closeCsvQuickViewButton.addEventListener("click", () => {
    elements.csvQuickViewDialog.close();
  });

  elements.builderCsvFileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    state.builder.csvText = await file.text();
    elements.builderAnalysisSummary.textContent = `${file.name} loaded. Analyze it to detect fields and suggested rules.`;
  });

  elements.analyzeBuilderCsvButton.addEventListener("click", analyzeBuilderCsv);
  elements.builderLoadColonButton.addEventListener("click", loadBuilderSampleCsv);
  elements.builderCanvasTab.addEventListener("click", () => switchBuilderView("canvas"));
  elements.builderStoredTab.addEventListener("click", () => switchBuilderView("stored"));
  elements.builderQuickViewButton.addEventListener("click", () => openCsvQuickView("builder"));
  elements.saveRuleButton.addEventListener("click", saveCurrentRule);
  elements.resetCanvasButton.addEventListener("click", () => {
    state.builder.draft = createBlankRuleDraft();
    state.builder.selectedNodeId = state.builder.draft.definition.root.id;
    renderBuilderCanvas();
    renderBuilderPanels();
  });
  elements.toggleSuggestionsButton.addEventListener("click", () => {
    state.builder.suggestionsCollapsed = !state.builder.suggestionsCollapsed;
    renderBuilderSidebarState();
  });
  elements.toggleFieldsButton.addEventListener("click", () => {
    state.builder.fieldsCollapsed = !state.builder.fieldsCollapsed;
    renderBuilderSidebarState();
  });
  elements.toggleNodePanelButton.addEventListener("click", () => {
    state.builder.nodeCollapsed = !state.builder.nodeCollapsed;
    renderBuilderSidebarState();
  });
  elements.addAndGroupButton.addEventListener("click", () => addGroupToSelected("AND"));
  elements.addOrGroupButton.addEventListener("click", () => addGroupToSelected("OR"));
  elements.deleteNodeButton.addEventListener("click", () => {
    deleteSelectedNode();
  });

  elements.ruleCanvas.addEventListener("dragover", (event) => {
    const groupElement = event.target.closest("[data-group-id]");
    if (groupElement) {
      event.preventDefault();
      groupElement.classList.add("drop-target");
    }
  });

  elements.ruleCanvas.addEventListener("dragleave", (event) => {
    const groupElement = event.target.closest("[data-group-id]");
    if (groupElement) {
      groupElement.classList.remove("drop-target");
    }
  });

  elements.ruleCanvas.addEventListener("drop", (event) => {
    const groupElement = event.target.closest("[data-group-id]");
    if (!groupElement) {
      return;
    }
    event.preventDefault();
    groupElement.classList.remove("drop-target");
    const field = event.dataTransfer.getData("text/plain");
    if (!field) {
      return;
    }
    const groupNode = findNodeById(state.builder.draft.definition.root, groupElement.dataset.groupId);
    if (!groupNode || groupNode.type !== "group") {
      return;
    }
    groupNode.children.push(createConditionNode(field));
    state.builder.selectedNodeId = groupNode.children[groupNode.children.length - 1].id;
    renderBuilderCanvas();
    renderBuilderPanels();
  });

  elements.ruleCanvas.addEventListener("click", (event) => {
    const nodeElement = event.target.closest("[data-node-id]");
    if (!nodeElement) {
      return;
    }
    state.builder.selectedNodeId = nodeElement.dataset.nodeId;
    renderBuilderCanvas();
    renderBuilderPanels();
  });

  elements.builderSelectedNodePanel.addEventListener("input", handleInspectorInput);
  elements.builderSelectedNodePanel.addEventListener("change", handleInspectorInput);
  elements.builderRuleSettingsPanel.addEventListener("input", handleInspectorInput);
  elements.builderRuleSettingsPanel.addEventListener("change", handleInspectorInput);
  elements.builderRuleSettingsPanel.addEventListener("click", handleInspectorClicks);

  elements.builderSuggestionsList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-suggestion-index]");
    if (!button) {
      return;
    }
    const suggestion = state.builder.analysis?.suggestions?.[Number(button.dataset.suggestionIndex)];
    if (!suggestion) {
      return;
    }
    const confirmed = window.confirm("Confirm you want to add a suggested rule.");
    if (!confirmed) {
      return;
    }
    state.builder.draft = cloneRuleRecord({
      ...suggestion,
      id: null,
      status: "Draft"
    });
    state.builder.selectedNodeId = state.builder.draft.definition.root.id;
    renderBuilderCanvas();
    renderBuilderPanels();
    window.alert("Suggested rule was added.");
  });

  elements.builderFieldsList.addEventListener("dragstart", (event) => {
    const chip = event.target.closest("[data-field-name]");
    if (!chip) {
      return;
    }
    event.dataTransfer.setData("text/plain", chip.dataset.fieldName);
  });

  elements.storedRulesList.addEventListener("click", async (event) => {
    const loadButton = event.target.closest("[data-load-rule-id]");
    const deleteButton = event.target.closest("[data-delete-rule-id]");

    if (loadButton) {
      const rule = state.builder.storedRules.find((item) => String(item.id) === loadButton.dataset.loadRuleId);
      if (!rule) {
        return;
      }
      state.builder.draft = cloneRuleRecord(rule);
      state.builder.selectedNodeId = state.builder.draft.definition.root.id;
      renderBuilderCanvas();
      renderBuilderPanels();
      void switchView("builder", { skipResetPrompt: true });
      switchBuilderView("canvas");
      return;
    }

    if (deleteButton) {
      await fetch(`/api/rulesets/${deleteButton.dataset.deleteRuleId}`, {
        method: "DELETE"
      });
      await Promise.all([loadStoredRulesets(), loadOperationsRulesets()]);
      renderStoredRules();
      renderRulesetContext();
      renderEvaluation();
    }
  });
}

async function switchView(view, options = {}) {
  if (view === state.view) {
    return;
  }

  if (!options.skipResetPrompt) {
    const confirmed = window.confirm(
      "Changing views will reset the next page to its default state. Any work not saved will be lost. Do you want to continue?"
    );
    if (!confirmed) {
      return;
    }
  }

  if (view === "operations") {
    resetOperationsState();
  } else {
    resetBuilderState();
  }

  state.view = view;
  renderCurrentView();
  renderRulesetContext();
  renderEvaluation();
  renderBuilderAnalysis();
  renderBuilderCanvas();
  renderBuilderPanels();
  renderBuilderSidebarState();
  renderStoredRules();
}

function renderCurrentView() {
  const operationsActive = state.view === "operations";
  elements.operationsTab.classList.toggle("active", operationsActive);
  elements.builderTab.classList.toggle("active", !operationsActive);
  elements.operationsView.classList.toggle("hidden", !operationsActive);
  elements.builderView.classList.toggle("hidden", operationsActive);
}

function switchBuilderView(view) {
  state.builder.view = view;
  elements.builderCanvasTab.classList.toggle("active", view === "canvas");
  elements.builderStoredTab.classList.toggle("active", view === "stored");
  elements.builderCanvasView.classList.toggle("hidden", view !== "canvas");
  elements.builderStoredView.classList.toggle("hidden", view !== "stored");
}

function renderBuilderSidebarState() {
  elements.builderSuggestionsList.classList.toggle("hidden", state.builder.suggestionsCollapsed);
  elements.builderFieldsList.classList.toggle("hidden", state.builder.fieldsCollapsed);
  elements.builderSelectedNodePanel.classList.toggle("hidden", state.builder.nodeCollapsed);
  elements.toggleSuggestionsButton.textContent = state.builder.suggestionsCollapsed ? "Show" : "Hide";
  elements.toggleFieldsButton.textContent = state.builder.fieldsCollapsed ? "Show" : "Hide";
  elements.toggleNodePanelButton.textContent = state.builder.nodeCollapsed ? "Show" : "Hide";
}

async function resetDemoSession() {
  await fetch("/api/session/reset", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  });
}

async function loadOperationsRulesets() {
  const response = await fetch("/api/rulesets?status=Active");
  const data = await response.json();
  state.operations.rulesets = data.rulesets;
  state.operations.selectedRulesetId = "";
  elements.activeRulesCountValue.textContent = String(data.rulesets.length);
  const options = ['<option value="">&lt;NoRule&gt;</option>'];
  if (data.rulesets.length) {
    options.push(...data.rulesets.map((ruleset) => `<option value="${ruleset.id}">${escapeHtml(ruleset.name)}</option>`));
  }
  elements.rulesetSelect.innerHTML = options.join("");
  elements.rulesetSelect.value = "";
}

async function loadStoredRulesets() {
  const response = await fetch("/api/rulesets");
  const data = await response.json();
  state.builder.storedRules = data.rulesets;
}

async function loadSampleCsv() {
  const response = await fetch("/sample-colon-screening.csv");
  state.operations.csvText = await response.text();
  maybeSuggestDashboardName("sample-colon-screening.csv");
  updateFileStatus(
    "Sample colon screening CSV ready",
    "Loaded the bundled colon screening export. Choose an active rule and run it."
  );
}

async function loadBuilderSampleCsv() {
  const response = await fetch("/sample-colon-screening.csv");
  state.builder.csvText = await response.text();
  elements.builderAnalysisSummary.textContent =
    "Loaded the bundled colon screening CSV. Analyze it to generate suggestions and field chips.";
}

async function runRules() {
  if (!state.operations.csvText.trim()) {
    window.alert("Upload a CSV or load the sample data first.");
    return;
  }

  if (!state.operations.selectedRulesetId) {
    window.alert("Please select an active ruleset before running rules.");
    return;
  }

  const response = await fetch("/api/evaluate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      dashboardName: state.operations.dashboardName,
      rulesetId: Number(state.operations.selectedRulesetId),
      csvText: state.operations.csvText
    })
  });

  const data = await response.json();
  state.operations.evaluationResult = data;
  state.operations.expandedEvaluationIndexes = [];
  elements.exportReportButton.disabled = data.evaluations.length === 0;
  updateSendOrdersState();
  renderEvaluation();
}

function handleResultsTableClick(event) {
  const row = event.target.closest("[data-evaluation-index]");
  if (!row) {
    return;
  }

  const index = Number(row.dataset.evaluationIndex);
  const evaluation = state.operations.evaluationResult?.evaluations?.[index];
  if (!evaluation?.triggered) {
    return;
  }

  if (state.operations.expandedEvaluationIndexes.includes(index)) {
    state.operations.expandedEvaluationIndexes = state.operations.expandedEvaluationIndexes.filter((value) => value !== index);
  } else {
    state.operations.expandedEvaluationIndexes = [...state.operations.expandedEvaluationIndexes, index];
  }

  renderEvaluation();
}

async function analyzeBuilderCsv() {
  if (!state.builder.csvText.trim()) {
    window.alert("Upload a CSV for builder analysis first.");
    return;
  }

  const response = await fetch("/api/builder/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      csvText: state.builder.csvText
    })
  });

  const data = await response.json();
  state.builder.analysis = data;
  elements.builderAnalysisSummary.textContent =
    `Detected ${data.headers.length} fields across the uploaded schema. Drag fields into the canvas or start from a suggested rule.`;
  renderBuilderAnalysis();
}

async function openCsvQuickView(source = "operations") {
  const csvText = source === "builder" ? state.builder.csvText : state.operations.csvText;
  if (!String(csvText || "").trim()) {
    window.alert(
      source === "builder"
        ? "Upload a builder CSV or load builder sample data before opening quick view."
        : "Upload a CSV or load sample data before opening quick view."
    );
    return;
  }

  const response = await fetch("/api/csv/preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      csvText
    })
  });

  const data = await response.json();
  elements.csvQuickViewTitle.textContent =
    source === "builder" ? "Builder CSV preview" : "Uploaded CSV preview";
  elements.csvQuickViewMeta.textContent = `Showing ${data.previewRows.length} of ${data.totalRows} row(s) across ${data.headers.length} column(s).`;
  elements.csvQuickViewHead.innerHTML = `
    <tr>${data.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
  `;
  elements.csvQuickViewBody.innerHTML = data.previewRows.length
    ? data.previewRows
        .map(
          (row) => `
            <tr>
              ${data.headers.map((header) => `<td>${escapeHtml(row[header] || "")}</td>`).join("")}
            </tr>
          `
        )
        .join("")
    : '<tr><td class="empty-state">No rows available.</td></tr>';

  elements.csvQuickViewDialog.showModal();
}

function renderRulesetContext() {
  const ruleset = currentOperationsRuleset();
  if (!ruleset) {
    elements.rulesetName.textContent = "No rule selected";
    elements.rulesetDescription.textContent = "Choose an active ruleset to evaluate the uploaded dashboard.";
    elements.rulesetMeasure.textContent = "No measure";
    elements.rulesetStatus.textContent = "Awaiting selection";
    elements.rulesetSource.textContent = "No guideline selected yet.";
    return;
  }

  elements.rulesetName.textContent = ruleset.name;
  elements.rulesetDescription.textContent = ruleset.description;
  elements.rulesetMeasure.textContent = ruleset.measure || "General";
  elements.rulesetStatus.textContent = ruleset.status;
  elements.rulesetSource.innerHTML = ruleset.sourceLabel
    ? ruleset.sourceUrl
      ? `Source: <a class="source-link" href="${escapeAttribute(ruleset.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(ruleset.sourceLabel)}</a>`
      : `Source: ${escapeHtml(ruleset.sourceLabel)}`
    : "";
}

function updateFileStatus(title, text) {
  elements.fileStatusTitle.textContent = title;
  elements.fileStatusText.textContent = text;
}

function renderEvaluation() {
  const evaluations = state.operations.evaluationResult?.evaluations || [];
  elements.totalRowsValue.textContent = String(state.operations.evaluationResult?.totalRows || 0);
  const matches = evaluations.filter((item) => item.triggered).length;
  elements.ruleMatchesValue.textContent = String(matches);
  elements.runInsightValue.textContent =
    evaluations.length === 0
      ? "Awaiting upload"
      : matches === 0
        ? "No patients matched this rule"
        : `${matches} patient${matches === 1 ? "" : "s"} ready for provider review`;

  if (evaluations.length === 0) {
    elements.resultsBody.innerHTML =
      '<tr><td colspan="5" class="empty-state">Upload a CSV and run a ruleset to see patient recommendations.</td></tr>';
    return;
  }

  elements.resultsBody.innerHTML = evaluations
    .map((item, index) => renderEvaluationRow(item, index))
    .join("");
}

function renderEvaluationRow(item, index) {
  const isExpanded = state.operations.expandedEvaluationIndexes.includes(index);
  const previewJson = item.fhirServiceRequest || buildClientFallbackServiceRequest(item);
  const mainRow = `
    <tr class="results-row ${item.triggered ? "expandable-row" : ""} ${isExpanded ? "expanded" : ""}" ${item.triggered ? `data-evaluation-index="${index}"` : ""}>
      <td>
        <strong>${escapeHtml(item.patientName || "Unknown patient")}</strong><br />
        <span class="queue-meta">${escapeHtml(item.patientId || "No identifier")}</span>
      </td>
      <td>${escapeHtml(item.gapReason || "No gap reason provided")}</td>
      <td>
        ${escapeHtml(item.recommendedOrder)}
        ${item.triggered ? `<div class="row-link-hint">Click to ${isExpanded ? "hide" : "view"} FHIR JSON</div>` : ""}
      </td>
      <td>${escapeHtml(item.provider)}</td>
      <td>
        <span class="status-badge ${item.triggered ? "status-match" : "status-skip"}">
          ${item.triggered ? "Draft recommended" : "No order"}
        </span>
      </td>
    </tr>
  `;

  const expandedRow =
    item.triggered && isExpanded
      ? `
        <tr class="expanded-json-row">
          <td colspan="5">
            <div class="fhir-preview-shell">
              <div class="info-copy"><strong>FHIR draft preview</strong></div>
              <pre>${escapeHtml(JSON.stringify(previewJson, null, 2))}</pre>
            </div>
          </td>
        </tr>
      `
      : "";

  return `${mainRow}${expandedRow}`;
}

function renderBuilderAnalysis() {
  const analysis = state.builder.analysis;
  if (!analysis) {
    elements.builderProfileName.textContent = "Not analyzed yet";
    elements.builderProfileSummary.textContent = "The builder will identify a likely clinical profile and surface matching rule suggestions.";
    elements.builderFieldCount.textContent = "0 fields";
    elements.builderSuggestionCount.textContent = "0 suggestions";
    elements.builderFieldsList.innerHTML = '<div class="detail-empty">Analyze a CSV to populate field chips.</div>';
    elements.builderSuggestionsList.innerHTML = '<div class="detail-empty">Suggested rules will appear here after analysis.</div>';
    return;
  }

  elements.builderProfileName.textContent = formatProfileName(analysis.profile);
  elements.builderProfileSummary.textContent =
    analysis.profile === "generic"
      ? "No known clinical template was recognized, so start from a blank canvas and map your own fields."
      : `The uploaded schema matches the ${formatProfileName(analysis.profile)} profile. Suggestions below are prefilled from guideline-inspired templates.`;
  elements.builderFieldCount.textContent = `${analysis.fields.length} fields`;
  elements.builderSuggestionCount.textContent = `${analysis.suggestions.length} suggestions`;

  elements.builderFieldsList.innerHTML = analysis.fields
    .map(
      (field) => `
        <div class="field-chip" draggable="true" data-field-name="${escapeHtml(field.name)}">
          <div>
            <strong>${escapeHtml(field.name)}</strong>
            <small>${escapeHtml((field.sampleValues || []).join(", ") || "No sample values")}</small>
          </div>
          <span class="badge">Drag</span>
        </div>
      `
    )
    .join("");

  elements.builderSuggestionsList.innerHTML = analysis.suggestions.length
    ? analysis.suggestions
        .map(
          (suggestion, index) => `
            <article class="suggestion-card">
              <strong>${escapeHtml(suggestion.name)}</strong>
              <small>${escapeHtml(suggestion.measure)} · ${escapeHtml(suggestion.sourceLabel || "Custom")}</small>
              <p class="info-copy">${escapeHtml(suggestion.description)}</p>
              <div class="suggestion-values">${renderSuggestionSummary(suggestion)}</div>
              <p class="info-copy subtle-copy">${escapeHtml(suggestion.rationale || "")}</p>
              ${
                suggestion.sourceUrl
                  ? `<p class="info-copy subtle-copy"><a class="source-link" href="${escapeAttribute(suggestion.sourceUrl)}" target="_blank" rel="noreferrer">Guideline reference</a></p>`
                  : ""
              }
              <div class="button-row compact-row">
                <button data-suggestion-index="${index}">Load into canvas</button>
              </div>
            </article>
          `
        )
        .join("")
    : '<div class="detail-empty">No profile-specific suggestions were found for this CSV yet.</div>';
}

function renderBuilderCanvas() {
  elements.ruleCanvas.innerHTML = renderGroupNode(state.builder.draft.definition.root, true);
}

function renderGroupNode(node, isRoot = false) {
  return `
    <div class="canvas-group ${isRoot ? "root-group" : ""} ${node.id === state.builder.selectedNodeId ? "selected" : ""}" data-group-id="${node.id}" data-node-id="${node.id}">
      <div class="canvas-group-header">
        <div>
          <strong>${isRoot ? "Root Group" : "Nested Group"}</strong>
          <div class="group-badges">
            <span class="badge">${escapeHtml(node.operator)}</span>
            ${node.not ? '<span class="badge">NOT</span>' : ""}
            <span class="badge">${node.children.length} nodes</span>
          </div>
        </div>
      </div>
      <div class="canvas-children">
        ${node.children.length
          ? node.children.map((child) => (child.type === "group" ? renderGroupNode(child) : renderConditionNode(child))).join("")
          : '<div class="detail-empty">Drop a field here or add a nested group.</div>'}
      </div>
    </div>
  `;
}

function renderConditionNode(node) {
  return `
    <article class="canvas-node ${node.id === state.builder.selectedNodeId ? "selected" : ""}" data-node-id="${node.id}">
      <div class="canvas-node-header">
        <div>
          <strong>${escapeHtml(node.field || "New condition")}</strong>
          <div class="node-badges">
            <span class="badge">${escapeHtml(node.comparator || "equals")}</span>
            ${node.not ? '<span class="badge">NOT</span>' : ""}
          </div>
        </div>
      </div>
      <div class="info-copy">${escapeHtml(formatConditionValue(node))}</div>
    </article>
  `;
}

function renderBuilderPanels() {
  renderBuilderSelectedNodePanel();
  renderBuilderRuleSettingsPanel();
}

function renderBuilderSelectedNodePanel() {
  const selectedNode = findNodeById(state.builder.draft.definition.root, state.builder.selectedNodeId);
  const fields = state.builder.analysis?.headers || collectRuleFields(state.builder.draft.definition.root);
  elements.builderSelectedNodePanel.innerHTML = !selectedNode
    ? '<div class="detail-empty">Select a group or condition on the canvas.</div>'
    : selectedNode.type === "group"
      ? `
        <section class="inspector-section">
          <h4>Group settings</h4>
          <div class="inspector-grid two-up">
            <label class="field">
              <span>Group operator</span>
              <select data-node-field="operator">
                ${["AND", "OR"].map((operator) => `<option value="${operator}" ${selectedNode.operator === operator ? "selected" : ""}>${operator}</option>`).join("")}
              </select>
            </label>
            <label class="field">
              <span>Apply NOT</span>
              <select data-node-field="not">
                <option value="false" ${!selectedNode.not ? "selected" : ""}>No</option>
                <option value="true" ${selectedNode.not ? "selected" : ""}>Yes</option>
              </select>
            </label>
          </div>
          <div class="info-copy">This group is droppable. Drag CSV fields here to create new conditions.</div>
        </section>
      `
      : `
        <section class="inspector-section">
          <h4>Condition settings</h4>
          <div class="inspector-grid">
            <label class="field">
              <span>Field</span>
              <select data-node-field="field">
                ${fields.map((field) => `<option value="${escapeAttribute(field)}" ${selectedNode.field === field ? "selected" : ""}>${escapeHtml(field)}</option>`).join("")}
              </select>
            </label>
            <div class="inspector-grid two-up">
              <label class="field">
                <span>Comparator</span>
                <select data-node-field="comparator">
                  ${comparatorOptions().map((comparator) => `<option value="${comparator.value}" ${selectedNode.comparator === comparator.value ? "selected" : ""}>${comparator.label}</option>`).join("")}
                </select>
              </label>
              <label class="field">
                <span>Apply NOT</span>
                <select data-node-field="not">
                  <option value="false" ${!selectedNode.not ? "selected" : ""}>No</option>
                  <option value="true" ${selectedNode.not ? "selected" : ""}>Yes</option>
                </select>
              </label>
            </div>
            ${renderConditionValueInputs(selectedNode)}
          </div>
        </section>
      `;
}

function renderBuilderRuleSettingsPanel() {
  const action = state.builder.draft.definition.action;
  elements.builderRuleSettingsPanel.innerHTML = `
    <section class="inspector-section">
      <h4>Ruleset</h4>
      <div class="inspector-grid">
        <label class="field">
          <span>Name</span>
          <input data-meta-field="name" value="${escapeAttribute(state.builder.draft.name)}" />
        </label>
        <label class="field">
          <span>Status</span>
          <select data-meta-field="status">
            ${["Draft", "Reviewed", "Active"].map((status) => `<option value="${status}" ${state.builder.draft.status === status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </label>
        ${
          state.builder.draft.sourceUrl
            ? `<div class="info-copy"><a class="source-link" href="${escapeAttribute(state.builder.draft.sourceUrl)}" target="_blank" rel="noreferrer">Guideline reference</a></div>`
            : ""
        }
      </div>
    </section>

    <section class="inspector-section">
      <h4>Draft order metadata</h4>
      <div class="inspector-grid">
        <label class="field">
          <span>Gap reason</span>
          <input data-action-field="gapReason" value="${escapeAttribute(action.gapReason || "")}" />
        </label>
        <label class="field">
          <span>Recommended order</span>
          <input data-action-field="recommendedOrder" value="${escapeAttribute(action.recommendedOrder || "")}" />
        </label>
        <div class="inspector-grid two-up">
          <label class="field">
            <span>FHIR order code</span>
            <input data-order-field="code" value="${escapeAttribute(action.orderInput?.code || "")}" />
          </label>
          <label class="field">
            <span>FHIR display</span>
            <input data-order-field="display" value="${escapeAttribute(action.orderInput?.display || "")}" />
          </label>
        </div>
        <label class="field">
          <span>Occurrence text</span>
          <input data-order-field="occurrenceText" value="${escapeAttribute(action.orderInput?.occurrenceText || "")}" />
        </label>
      </div>
    </section>
  `;
}

function renderConditionValueInputs(node) {
  const comparatorsWithoutValues = ["blank", "notBlank", "affirmative", "notAffirmative"];
  if (comparatorsWithoutValues.includes(node.comparator)) {
    return "";
  }

  const inputType = inputTypeForNode(node);

  if (node.comparator === "between") {
    const values = Array.isArray(node.value) ? node.value : ["", ""];
    return `
      <div class="inspector-grid two-up">
        <label class="field">
          <span>Minimum</span>
          <input type="${inputType}" data-node-value-index="0" value="${escapeAttribute(values[0] ?? "")}" />
        </label>
        <label class="field">
          <span>Maximum</span>
          <input type="${inputType}" data-node-value-index="1" value="${escapeAttribute(values[1] ?? "")}" />
        </label>
      </div>
    `;
  }

  return `
    <label class="field">
      <span>Value ${node.comparator === "oneOf" ? "(comma separated)" : ""}</span>
      <input type="${inputType}" data-node-value value="${escapeAttribute(Array.isArray(node.value) ? node.value.join(", ") : node.value ?? "")}" />
    </label>
  `;
}

function renderStoredRules() {
  elements.storedRulesList.innerHTML = state.builder.storedRules.length
    ? state.builder.storedRules
        .map(
          (rule) => `
            <article class="stored-rule-card">
              <strong>${escapeHtml(rule.name)}</strong>
              <small>${escapeHtml(rule.measure || "General")} · ${escapeHtml(rule.status)} · ${escapeHtml(rule.profile || "generic")}</small>
              <p class="info-copy">${escapeHtml(rule.description || "")}</p>
              <div class="button-row compact-row">
                <button data-load-rule-id="${rule.id}">Load</button>
                <button class="ghost-button" data-delete-rule-id="${rule.id}">Delete</button>
              </div>
            </article>
          `
        )
        .join("")
    : '<div class="detail-empty">No stored rulesets yet. Save one from the builder.</div>';
}

function handleInspectorInput(event) {
  const target = event.target;
  const selectedNode = findNodeById(state.builder.draft.definition.root, state.builder.selectedNodeId);
  let shouldRenderCanvas = false;
  let shouldRenderPanels = false;

  if (target.dataset.metaField) {
    state.builder.draft[target.dataset.metaField] = target.value;
  }

  if (target.dataset.actionField) {
    state.builder.draft.definition.action[target.dataset.actionField] = target.value;
  }

  if (target.dataset.orderField) {
    state.builder.draft.definition.action.orderInput[target.dataset.orderField] = target.value;
  }

  if (selectedNode && target.dataset.nodeField) {
    const field = target.dataset.nodeField;
    if (field === "not") {
      selectedNode.not = target.value === "true";
    } else {
      selectedNode[field] = target.value;
      if (field === "comparator") {
        if (selectedNode.comparator === "between") {
          selectedNode.value = ["", ""];
        } else if (["blank", "notBlank", "affirmative", "notAffirmative"].includes(selectedNode.comparator)) {
          selectedNode.value = "";
        } else if (selectedNode.comparator === "oneOf") {
          selectedNode.value = [];
        } else {
          selectedNode.value = "";
        }
        shouldRenderPanels = true;
      }
    }
    shouldRenderCanvas = true;
  }

  if (selectedNode && target.dataset.nodeValue !== undefined) {
    selectedNode.value = selectedNode.comparator === "oneOf"
      ? target.value.split(",").map((item) => item.trim()).filter(Boolean)
      : target.value;
    shouldRenderCanvas = true;
  }

  if (selectedNode && target.dataset.nodeValueIndex !== undefined) {
    if (!Array.isArray(selectedNode.value)) {
      selectedNode.value = ["", ""];
    }
    selectedNode.value[Number(target.dataset.nodeValueIndex)] = target.value;
    shouldRenderCanvas = true;
  }

  if (shouldRenderCanvas) {
    renderBuilderCanvas();
  }
  if (shouldRenderPanels) {
    renderBuilderPanels();
  }
}

async function handleInspectorClicks(event) {
  const button = event.target.closest("[data-inspector-action]");
  if (!button) {
    return;
  }

  if (button.dataset.inspectorAction === "save-rule") {
    await saveCurrentRule();
  }
}

async function saveCurrentRule() {
  const confirmed = window.confirm("Save this ruleset to the stored rulesets library?");
  if (!confirmed) {
    return;
  }
  const payload = cloneRuleRecord(state.builder.draft);
  const response = await fetch("/api/rulesets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  await Promise.all([loadStoredRulesets(), loadOperationsRulesets()]);
  resetBuilderState();
  renderStoredRules();
  renderBuilderCanvas();
  renderBuilderPanels();
  renderBuilderSidebarState();
  renderRulesetContext();
  renderEvaluation();
  switchBuilderView("stored");
  window.alert(`Ruleset "${data.ruleset.name}" was saved.`);
}

function getDraftableOrders() {
  return (state.operations.evaluationResult?.evaluations || []).filter(
    (item) => item.triggered && (item.fhirServiceRequest || item.orderInput)
  );
}

function hasRealFhirServerUrl() {
  const value = String(state.operations.fhirServerUrl || "").trim();
  return Boolean(value) && value !== DEFAULT_FHIR_SERVER_URL;
}

function updateSendOrdersState() {
  elements.sendOrdersButton.disabled = !(getDraftableOrders().length > 0 && hasRealFhirServerUrl());
}

function addFhirServer() {
  const currentValue =
    state.operations.fhirServerUrl && state.operations.fhirServerUrl !== DEFAULT_FHIR_SERVER_URL
      ? state.operations.fhirServerUrl
      : DEFAULT_FHIR_SERVER_URL;
  const enteredUrl = window.prompt("Enter the FHIR server URL.", currentValue);
  if (enteredUrl === null) {
    return;
  }

  state.operations.fhirServerUrl = String(enteredUrl || "").trim() || DEFAULT_FHIR_SERVER_URL;
  updateSendOrdersState();

  if (state.operations.fhirServerUrl === DEFAULT_FHIR_SERVER_URL) {
    window.alert("FHIR server remains set to the example value. Update it to a real server before sending orders.");
    return;
  }

  window.alert(`FHIR server saved: ${state.operations.fhirServerUrl}`);
}

function sendOrders() {
  const draftableOrders = getDraftableOrders();
  if (draftableOrders.length === 0) {
    window.alert("No draft orders are available to send.");
    return;
  }

  if (!hasRealFhirServerUrl()) {
    window.alert("Please replace the example FHIR server URL with a real server before sending orders.");
    return;
  }

  const serverUrl = String(state.operations.fhirServerUrl || "").trim();
  window.alert(
    `${draftableOrders.length} order${draftableOrders.length === 1 ? "" : "s"} would be send it now to the ${serverUrl} FHIR server.`
  );
}

function currentOperationsRuleset() {
  return state.operations.rulesets.find((item) => String(item.id) === String(state.operations.selectedRulesetId)) || null;
}

function resetOperationsState() {
  state.operations.csvText = "";
  state.operations.evaluationResult = null;
  state.operations.expandedEvaluationIndexes = [];
  state.operations.dashboardName = DEFAULT_DASHBOARD_NAME;
  state.operations.fhirServerUrl = DEFAULT_FHIR_SERVER_URL;
  elements.csvFileInput.value = "";
  elements.dashboardNameInput.value = state.operations.dashboardName;
  state.operations.selectedRulesetId = "";
  elements.rulesetSelect.value = "";
  elements.exportReportButton.disabled = true;
  elements.sendOrdersButton.disabled = true;
  elements.totalRowsValue.textContent = "0";
  elements.ruleMatchesValue.textContent = "0";
  elements.runInsightValue.textContent = "Awaiting upload";
  updateFileStatus(
    "No CSV uploaded",
    "Upload a CSV or load the sample data to begin."
  );
}

function resetBuilderState() {
  state.builder.view = "canvas";
  state.builder.csvText = "";
  state.builder.analysis = null;
  state.builder.draft = createBlankRuleDraft();
  state.builder.selectedNodeId = state.builder.draft.definition.root.id;
  state.builder.suggestionsCollapsed = true;
  state.builder.fieldsCollapsed = true;
  state.builder.nodeCollapsed = true;
  elements.builderCsvFileInput.value = "";
  elements.builderAnalysisSummary.textContent =
    "Upload a CSV to detect fields, identify a clinical profile, and propose starter rules.";
  switchBuilderView("canvas");
}

function maybeSuggestDashboardName(fileName = "") {
  const currentValue = String(elements.dashboardNameInput.value || "").trim();
  const currentRuleset = currentOperationsRuleset();
  if (!state.operations.csvText.trim() && !fileName) {
    return;
  }

  const canReplace =
    currentValue === "" ||
    currentValue === DEFAULT_DASHBOARD_NAME ||
    currentValue.includes("Dashboard");

  if (!canReplace) {
    return;
  }

  const fileLabel = String(fileName || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();

  const suggestedName =
    currentRuleset && fileLabel
      ? `${fileLabel} - ${currentRuleset.name}`
      : currentRuleset
        ? `${currentRuleset.name} Dashboard`
        : fileLabel
          ? `${fileLabel} Dashboard`
          : DEFAULT_DASHBOARD_NAME;

  state.operations.dashboardName = suggestedName;
  elements.dashboardNameInput.value = suggestedName;
}

function exportReport() {
  const evaluations = state.operations.evaluationResult?.evaluations || [];
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

function exportRunReport() {
  exportReport();
}

function ensureSelectedGroup() {
  const selected = findNodeById(state.builder.draft.definition.root, state.builder.selectedNodeId);
  if (selected?.type === "group") {
    return selected;
  }

  const parent = findParentGroup(state.builder.draft.definition.root, state.builder.selectedNodeId);
  return parent || state.builder.draft.definition.root;
}

function addGroupToSelected(operator) {
  const group = ensureSelectedGroup();
  const childGroup = createGroupNode(operator);
  group.children.push(childGroup);
  state.builder.selectedNodeId = childGroup.id;
  renderBuilderCanvas();
  renderBuilderPanels();
}

function deleteSelectedNode() {
  if (state.builder.selectedNodeId === state.builder.draft.definition.root.id) {
    return;
  }

  const parent = findParentGroup(state.builder.draft.definition.root, state.builder.selectedNodeId);
  if (!parent) {
    return;
  }

  parent.children = parent.children.filter((child) => child.id !== state.builder.selectedNodeId);
  state.builder.selectedNodeId = parent.id;
  renderBuilderCanvas();
  renderBuilderPanels();
}

function findNodeById(node, id) {
  if (!node) {
    return null;
  }
  if (node.id === id) {
    return node;
  }
  if (node.type === "group") {
    for (const child of node.children) {
      const found = findNodeById(child, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function findParentGroup(node, childId) {
  if (!node || node.type !== "group") {
    return null;
  }

  if (node.children.some((child) => child.id === childId)) {
    return node;
  }

  for (const child of node.children) {
    const found = findParentGroup(child, childId);
    if (found) {
      return found;
    }
  }

  return null;
}

function collectRuleFields(node, fields = new Set()) {
  if (!node) {
    return [...fields];
  }

  if (node.type === "condition" && node.field) {
    fields.add(node.field);
  }

  if (node.type === "group") {
    node.children.forEach((child) => collectRuleFields(child, fields));
  }

  return [...fields];
}

function comparatorOptions() {
  return [
    { value: "equals", label: "Equals" },
    { value: "between", label: "Between" },
    { value: "greaterThanOrEqual", label: "Greater than or equal" },
    { value: "lessThanOrEqual", label: "Less than or equal" },
    { value: "contains", label: "Contains" },
    { value: "blank", label: "Is blank" },
    { value: "notBlank", label: "Is not blank" },
    { value: "affirmative", label: "Is affirmative" },
    { value: "notAffirmative", label: "Is not affirmative" },
    { value: "olderThanDays", label: "Older than days" },
    { value: "withinLastDays", label: "Within last days" },
    { value: "oneOf", label: "One of" }
  ];
}

function createBlankRuleDraft() {
  const root = createGroupNode();
  root.id = "root";
  return {
    id: null,
    name: "New ruleset",
    status: "Draft",
    profile: "generic",
    sourceType: "custom_builder",
    sourceLabel: "Builder-authored rule",
    sourceUrl: "",
    definition: {
      version: 1,
      profile: "generic",
      root,
      action: {
        type: "draftOrder",
        gapReason: "Clinical gap identified by custom ruleset",
        recommendedOrder: "Draft order recommendation",
        orderInput: {
          code: "CUSTOM",
          display: "Custom draft order recommendation",
          occurrenceText: "Review for appropriateness"
        }
      }
    }
  };
}

function buildClientFallbackServiceRequest(item) {
  return {
    resourceType: "ServiceRequest",
    status: "draft",
    intent: "order",
    subject: {
      reference: `Patient/${item.patientId || "unknown"}`,
      display: item.patientName || "Unknown patient"
    },
    requester: {
      display: item.provider || "Unassigned provider"
    },
    code: {
      text: item.orderInput?.display || item.recommendedOrder || "Draft order recommendation",
      coding: [
        {
          system: "http://example.org/dashboard-to-order-codes",
          code: item.orderInput?.code || "DRAFT",
          display: item.orderInput?.display || item.recommendedOrder || "Draft order recommendation"
        }
      ]
    },
    occurrenceString: item.orderInput?.occurrenceText || "Review for appropriateness",
    authoredOn: new Date().toISOString().slice(0, 10),
    reasonCode: [
      {
        text: item.gapReason || "Clinical gap identified"
      }
    ],
    note: [
      {
        text: Array.isArray(item.explanation) ? item.explanation.join(" ") : "Generated from dashboard ruleset."
      }
    ]
  };
}

function createGroupNode(operator = "AND") {
  return {
    id: randomId("group"),
    type: "group",
    operator,
    not: false,
    children: []
  };
}

function createConditionNode(field = "") {
  return {
    id: randomId("condition"),
    type: "condition",
    field,
    comparator: "equals",
    value: "",
    not: false,
    label: ""
  };
}

function cloneRuleRecord(rule) {
  return JSON.parse(JSON.stringify(rule));
}

function renderSuggestionSummary(rule) {
  const lines = summarizeRuleNode(rule.definition?.root || {});
  const action = rule.definition?.action;
  const actionLine = action
    ? `THEN ${action.recommendedOrder || action.orderInput?.display || "Draft order"} (${action.orderInput?.code || "no code"})`
    : "";

  return [...lines.slice(0, 5), actionLine]
    .filter(Boolean)
    .map((line) => `<div class="suggestion-line">${escapeHtml(line)}</div>`)
    .join("");
}

function summarizeRuleNode(node) {
  if (!node) {
    return [];
  }

  if (node.type === "condition") {
    return [summarizeCondition(node)];
  }

  const lines = [];
  if (node.type === "group") {
    lines.push(`${node.not ? "NOT " : ""}${node.operator || "AND"} group`);
    (node.children || []).forEach((child) => {
      lines.push(...summarizeRuleNode(child));
    });
  }
  return lines;
}

function summarizeCondition(node) {
  const value = Array.isArray(node.value) ? node.value.join(" to ") : node.value;
  return `${node.not ? "NOT " : ""}${node.field} ${node.comparator}${value !== undefined && value !== "" ? ` ${value}` : ""}`;
}

function randomId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatProfileName(profile) {
  return String(profile || "generic")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatConditionValue(node) {
  if (Array.isArray(node.value)) {
    return node.value.join(" to ");
  }
  return node.value === "" ? "No value specified yet" : String(node.value);
}

function inputTypeForNode(node) {
  if (node.comparator === "olderThanDays" || node.comparator === "withinLastDays") {
    return "number";
  }

  if (isLikelyDateField(node.field)) {
    return "date";
  }

  return "text";
}

function isLikelyDateField(fieldName) {
  return /date|due|screened|refusal|occurrence|authored/i.test(String(fieldName || ""));
}

function csvCell(value) {
  return `"${String(value || "").replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("\n", "&#10;");
}
