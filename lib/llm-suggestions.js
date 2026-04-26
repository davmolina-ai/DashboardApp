const SUPPORTED_COMPARATORS = [
  "between",
  "greaterThanOrEqual",
  "lessThanOrEqual",
  "equals",
  "contains",
  "blank",
  "notBlank",
  "affirmative",
  "notAffirmative",
  "olderThanDays",
  "withinLastDays",
  "oneOf"
];

function llmConfig() {
  return {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || "",
    apiKey: process.env.AZURE_OPENAI_API_KEY || "",
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "",
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-05-01-preview"
  };
}

function isLlmConfigured() {
  const config = llmConfig();
  return Boolean(config.endpoint && config.apiKey && config.deployment);
}

async function generateAiRuleSuggestions(context) {
  if (!isLlmConfigured()) {
    return {
      suggestions: [],
      meta: {
        enabled: false,
        used: false,
        error: "Azure AI Foundry environment variables are not configured."
      }
    };
  }

  const config = llmConfig();
  const payload = buildPromptPayload(context);
  const requestOptions = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": config.apiKey
    },
    body: JSON.stringify({
      model: config.deployment,
      messages: [
        {
          role: "system",
          content: buildSystemPrompt()
        },
        {
          role: "user",
          content: JSON.stringify(payload, null, 2)
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1200
    })
  };

  let response = null;
  let errorText = "";
  for (const requestUrl of buildChatCompletionsUrls(config.endpoint, config.apiVersion)) {
    response = await fetchWithTimeout(requestUrl, requestOptions, 60000);
    if (response.ok) {
      break;
    }
    errorText = await safeReadText(response);
  }

  if (!response || !response.ok) {
    return {
      suggestions: [],
      meta: {
        enabled: true,
        used: false,
        deployment: config.deployment,
        error: `Azure AI request failed (${response.status}). ${truncate(errorText, 260)}`
      }
    };
  }

  const body = await response.json();
  const content = extractMessageContent(body);
  const parsed = parseJsonLoose(content);
  const suggestionItems = extractSuggestionItems(parsed);
  if (!parsed || !Array.isArray(suggestionItems)) {
    return {
      suggestions: [],
      meta: {
        enabled: true,
        used: false,
        deployment: config.deployment,
        error: "The Azure AI response did not contain valid suggestion JSON."
      }
    };
  }

  const suggestions = suggestionItems
    .map((suggestion, index) => normalizeAiSuggestion(suggestion, context, index))
    .filter(Boolean);

  return {
    suggestions,
    meta: {
      enabled: true,
      used: suggestions.length > 0,
      deployment: config.deployment,
      suggestionCount: suggestions.length
    }
  };
}

function buildSystemPrompt() {
  return [
    "You are a clinical ruleset drafting assistant for a healthcare dashboard-to-FHIR tool.",
    "Your job is to read CSV headers, sample rows, and curated guideline templates, then return only valid JSON suggestions for a ruleset builder.",
    "Important rules:",
    "- Do not invent fields that are not present in the CSV.",
    "- Suggestions must stay in Draft status and are only proposals for human review.",
    "- Prefer conservative, clinically explainable suggestions.",
    "- Map logic only to the provided CSV fields.",
    "- Use only these comparators: " + SUPPORTED_COMPARATORS.join(", "),
    "- If evidence is weak, lower confidence and explain why.",
    "- Suggested actions must only create draft orders and FHIR order metadata.",
    "- Output JSON only. No markdown. No commentary.",
    "",
    "Return this shape:",
    JSON.stringify(
      {
        profile: "string",
        suggestions: [
          {
            name: "string",
            description: "string",
            measure: "string",
            confidence: 0.0,
            sourceLabel: "string",
            sourceUrl: "string",
            rationale: "string",
            definition: {
              version: 1,
              profile: "string",
              root: {
                id: "root",
                type: "group",
                operator: "AND",
                not: false,
                children: []
              },
              action: {
                type: "draftOrder",
                gapReason: "string",
                recommendedOrder: "string",
                orderInput: {
                  code: "string",
                  display: "string",
                  occurrenceText: "string"
                }
              }
            }
          }
        ]
      },
      null,
      2
    )
  ].join("\n");
}

function buildPromptPayload(context) {
  const guidelineSources = (context.guidelineSources || []).slice(0, 3);
  return {
    task: "Suggest draft clinical rules from this dashboard CSV for use in a ruleset builder.",
    profile_hint: context.profile,
    clinical_context:
      "Population health and chronic disease management dashboards used to identify patients who may need draft screening or management orders.",
    headers: context.headers,
    fields: context.fields.map((field) => ({
      name: field.name,
      sampleValues: (field.sampleValues || []).slice(0, 3)
    })),
    sample_rows: (context.previewRows || []).slice(0, 3),
    guideline_templates: (context.curatedSuggestions || []).slice(0, 2).map((rule) => ({
      name: rule.name,
      measure: rule.measure,
      description: rule.description,
      sourceLabel: rule.sourceLabel,
      sourceUrl: rule.sourceUrl,
      rationale: rule.rationale,
      rootSummary: summarizeRoot(rule.definition?.root),
      action: {
        gapReason: rule.definition?.action?.gapReason,
        recommendedOrder: rule.definition?.action?.recommendedOrder,
        orderInput: rule.definition?.action?.orderInput || null
      }
    })),
    guideline_sources: guidelineSources.map((source) => ({
      authority: source.authority,
      title: source.title,
      url: source.url,
      summary: source.summary,
      keyPoints: source.keyPoints
    })),
    requirements: [
      "Return 1 to 3 draft suggestions only.",
      "Use only the provided CSV fields.",
      "Keep each suggestion compatible with the existing JSON ruleset format.",
      "Every suggestion must include draft-order metadata.",
      "Prefer medical recommendation alignment when the schema strongly suggests a known guideline pattern.",
      "Prefer the official guideline sources provided in guideline_sources over general knowledge.",
      "If no strong rule is supported, return an empty suggestions array."
    ]
  };
}

function summarizeRoot(node) {
  if (!node) {
    return "";
  }

  if (node.type === "condition") {
    return `${node.field} ${node.comparator}`;
  }

  return `${node.operator || "AND"}(${(node.children || []).map(summarizeRoot).filter(Boolean).join(", ")})`;
}

function buildChatCompletionsUrls(endpoint, apiVersion) {
  const normalized = String(endpoint || "").trim().replace(/\/$/, "");
  const base = normalized.includes("/api/projects/")
    ? normalized.split("/api/projects/")[0]
    : normalized
        .replace(/\/openai\/v1\/?$/i, "")
        .replace(/\/api\/models\/?$/i, "")
        .replace(/\/models\/?$/i, "");

  return [
    `${base}/openai/v1/chat/completions`,
    `${base}/models/chat/completions?api-version=${encodeURIComponent(apiVersion)}`,
    `${base}/api/models/chat/completions?api-version=${encodeURIComponent(apiVersion)}`
  ];
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch (error) {
    return String(error?.message || error || "");
  }
}

function extractMessageContent(body) {
  const content = body?.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item === "string" ? item : item?.text || ""))
      .join("");
  }
  return typeof content === "string" ? content : "";
}

function parseJsonLoose(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim());
      } catch (innerError) {
        return null;
      }
    }
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
      } catch (innerError) {
        return null;
      }
    }
    return null;
  }
}

function extractSuggestionItems(parsed) {
  if (!parsed) {
    return null;
  }

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (Array.isArray(parsed.suggestions)) {
    return parsed.suggestions;
  }

  if (Array.isArray(parsed.rules)) {
    return parsed.rules;
  }

  if (Array.isArray(parsed.drafts)) {
    return parsed.drafts;
  }

  if (Array.isArray(parsed.recommendations)) {
    return parsed.recommendations;
  }

  if (parsed.result && Array.isArray(parsed.result.suggestions)) {
    return parsed.result.suggestions;
  }

  if (parsed.data && Array.isArray(parsed.data.suggestions)) {
    return parsed.data.suggestions;
  }

  return null;
}

function normalizeAiSuggestion(suggestion, context, index) {
  if (!suggestion || typeof suggestion !== "object") {
    return null;
  }

  const definition = normalizeDefinition(suggestion.definition, context.profile);
  if (!definition) {
    return null;
  }

  return {
    slug: `ai-${slugify(suggestion.name || `suggestion-${index + 1}`)}`,
    name: String(suggestion.name || `AI Suggestion ${index + 1}`).trim(),
    description: String(suggestion.description || "AI-assisted draft suggestion.").trim(),
    status: "Draft",
    measure: String(suggestion.measure || inferMeasure(context.profile)).trim(),
    profile: context.profile,
    sourceType: "ai_guided_curated",
    sourceLabel: String(suggestion.sourceLabel || "AI-assisted draft suggestion").trim(),
    sourceUrl: String(suggestion.sourceUrl || "").trim(),
    rationale: String(suggestion.rationale || "Generated from CSV structure and curated guideline context.").trim(),
    confidence: Number.isFinite(Number(suggestion.confidence)) ? Number(suggestion.confidence) : null,
    definition,
    suggestionOrigin: "ai",
    suggestionModel: llmConfig().deployment
  };
}

function normalizeDefinition(definition, profile) {
  if (!definition || typeof definition !== "object") {
    return null;
  }

  const root = normalizeNode(definition.root, true);
  if (!root) {
    return null;
  }

  const action = definition.action && typeof definition.action === "object"
    ? {
        type: "draftOrder",
        gapReason: String(definition.action.gapReason || "Identified by AI-assisted rule draft").trim(),
        recommendedOrder: String(
          definition.action.recommendedOrder || definition.action.orderInput?.display || "Clinical review"
        ).trim(),
        orderInput: {
          code: String(definition.action.orderInput?.code || "DRAFT").trim(),
          display: String(
            definition.action.orderInput?.display || definition.action.recommendedOrder || "Clinical review"
          ).trim(),
          occurrenceText: String(
            definition.action.orderInput?.occurrenceText || "Review for appropriateness"
          ).trim()
        }
      }
    : null;

  if (!action) {
    return null;
  }

  return {
    version: 1,
    profile,
    root,
    action
  };
}

function normalizeNode(node, isRoot = false) {
  if (!node || typeof node !== "object") {
    return null;
  }

  if (node.type === "group" || (isRoot && !node.type)) {
    const children = Array.isArray(node.children)
      ? node.children.map((child) => normalizeNode(child)).filter(Boolean)
      : [];
    return {
      id: String(node.id || (isRoot ? "root" : `group-${Math.random().toString(36).slice(2, 10)}`)),
      type: "group",
      operator: String(node.operator || "AND").toUpperCase() === "OR" ? "OR" : "AND",
      not: Boolean(node.not),
      children
    };
  }

  if (node.type === "condition" && typeof node.field === "string") {
    const comparator = SUPPORTED_COMPARATORS.includes(node.comparator) ? node.comparator : "equals";
    const value = normalizeConditionValue(comparator, node.value);
    return {
      id: String(node.id || `condition-${Math.random().toString(36).slice(2, 10)}`),
      type: "condition",
      field: node.field.trim(),
      comparator,
      value,
      not: Boolean(node.not),
      label: String(node.label || "").trim()
    };
  }

  return null;
}

function normalizeConditionValue(comparator, value) {
  if (comparator === "between") {
    return Array.isArray(value) ? value.slice(0, 2) : ["", ""];
  }
  if (comparator === "oneOf") {
    return Array.isArray(value) ? value : [value].filter(Boolean);
  }
  return value ?? "";
}

function inferMeasure(profile) {
  switch (profile) {
    case "colon_cancer":
      return "Colon cancer screening";
    case "cirrhosis":
      return "Cirrhosis management";
    case "asthma":
      return "Asthma management";
    case "ascvd":
      return "ASCVD prevention";
    case "lung_cancer":
      return "Lung cancer screening";
    default:
      return "Clinical quality rule";
  }
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function truncate(value, length) {
  const text = String(value || "").trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

module.exports = {
  generateAiRuleSuggestions,
  isLlmConfigured
};
