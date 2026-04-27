const Papa = require("papaparse");

function analyzeCsv(csvText) {
  const preparedText = preprocessCsv(csvText);
  const result = Papa.parse(preparedText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: sanitizeHeader
  });

  if (result.errors.length > 0) {
    const blockingErrors = result.errors.filter((error) => error.code !== "UndetectableDelimiter");
    if (blockingErrors.length > 0) {
      throw new Error(blockingErrors[0].message);
    }
  }

  const headers = (result.meta.fields || []).map(sanitizeHeader).filter(Boolean);
  const rows = result.data
    .map((row) =>
      headers.reduce((nextRow, header) => {
        nextRow[header] = normalizeCell(row[header]);
        return nextRow;
      }, {})
    )
    .filter((row) => Object.values(row).some((value) => String(value || "").trim() !== ""));

  const fields = headers.map((header) => ({
    name: header,
    sampleValues: uniqueSampleValues(rows, header)
  }));

  return {
    headers,
    rows,
    fields
  };
}

function preprocessCsv(csvText) {
  const text = String(csvText || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const lines = text.split("\n");

  while (lines.length > 1 && likelyTitleRow(lines[0])) {
    lines.shift();
  }

  return lines.join("\n");
}

function likelyTitleRow(line) {
  const cells = line.split(",").map((cell) => cell.trim()).filter(Boolean);
  return cells.length <= 1;
}

function sanitizeHeader(header) {
  return String(header || "")
    .replace(/\s+/g, " ")
    .replace(/^"|"$/g, "")
    .trim();
}

function normalizeCell(value) {
  return typeof value === "string" ? value.trim() : value ?? "";
}

function uniqueSampleValues(rows, header) {
  return [...new Set(rows.map((row) => row[header]).filter((value) => value !== ""))].slice(0, 5);
}

function evaluateRuleset(ruleRecord, row) {
  const evaluation = evaluateNode(ruleRecord.definition.root, row);
  const action = ruleRecord.definition.action || {};

  return {
    triggered: evaluation.matched,
    patientId: guessPatientId(row),
    patientName: buildPatientName(row),
    provider: guessProvider(row),
    gapReason: action.gapReason || `${ruleRecord.name} gap`,
    dueDate: deriveDueDate(action, row),
    recommendedOrder: action.recommendedOrder || action.orderInput?.display || ruleRecord.recommendedOrder,
    explanation: evaluation.explanations,
    rawRow: row,
    orderInput: action.orderInput || {
      code: "DRAFT",
      display: action.recommendedOrder || ruleRecord.name,
      occurrenceText: "Review for appropriateness"
    },
    sourceLabel: ruleRecord.sourceLabel,
    ruleName: ruleRecord.name,
    rulesetId: ruleRecord.id
  };
}

function evaluateNode(node, row) {
  if (!node) {
    return { matched: true, explanations: [] };
  }

  if (node.type === "group") {
    const childResults = (node.children || []).map((child) => evaluateNode(child, row));
    const operator = (node.operator || "AND").toUpperCase();
    const matched =
      operator === "OR"
        ? childResults.some((result) => result.matched)
        : childResults.every((result) => result.matched);
    const finalMatch = node.not ? !matched : matched;

    return {
      matched: finalMatch,
      explanations: childResults.flatMap((result) => result.explanations)
    };
  }

  const rawValue = row[node.field];
  const baseMatch = compareValue(rawValue, node.comparator, node.value);
  const matched = node.not ? !baseMatch : baseMatch;
  const label = node.label || `${node.field} ${node.comparator}`;

  return {
    matched,
    explanations: [
      `${label}: ${matched ? "matched" : "not matched"} (value: ${rawValue || "blank"})`
    ]
  };
}

function compareValue(rawValue, comparator, expectedValue) {
  const normalizedValue = normalize(rawValue);
  switch (comparator) {
    case "between": {
      const [minimum, maximum] = expectedValue || [];
      const rangeComparison = compareRangeValue(rawValue, minimum, maximum);
      return rangeComparison !== null ? rangeComparison : false;
    }
    case "greaterThanOrEqual": {
      return compareOrderedValue(rawValue, expectedValue, (left, right) => left >= right);
    }
    case "lessThanOrEqual": {
      return compareOrderedValue(rawValue, expectedValue, (left, right) => left <= right);
    }
    case "equals":
      return normalizedValue === normalize(expectedValue);
    case "contains":
      return normalizedValue.includes(normalize(expectedValue));
    case "blank":
      return normalizedValue === "";
    case "notBlank":
      return normalizedValue !== "";
    case "affirmative":
      return isAffirmative(rawValue);
    case "notAffirmative":
      return !isAffirmative(rawValue);
    case "olderThanDays": {
      const dateValue = parseDate(rawValue);
      return Boolean(dateValue) && daysBetween(dateValue, new Date()) > Number(expectedValue);
    }
    case "withinLastDays": {
      const dateValue = parseDate(rawValue);
      return Boolean(dateValue) && daysBetween(dateValue, new Date()) <= Number(expectedValue);
    }
    case "oneOf":
      return (expectedValue || []).map(normalize).includes(normalizedValue);
    default:
      return false;
  }
}

function compareRangeValue(rawValue, minimum, maximum) {
  const rawDate = parseDate(rawValue);
  const minimumDate = parseDate(minimum);
  const maximumDate = parseDate(maximum);
  if (rawDate && minimumDate && maximumDate) {
    return rawDate >= minimumDate && rawDate <= maximumDate;
  }

  const numericValue = parseNumber(rawValue);
  return Number.isFinite(numericValue) && numericValue >= Number(minimum) && numericValue <= Number(maximum);
}

function compareOrderedValue(rawValue, expectedValue, comparator) {
  const rawDate = parseDate(rawValue);
  const expectedDate = parseDate(expectedValue);
  if (rawDate && expectedDate) {
    return comparator(rawDate.getTime(), expectedDate.getTime());
  }

  const numericValue = parseNumber(rawValue);
  return Number.isFinite(numericValue) && comparator(numericValue, Number(expectedValue));
}

function buildServiceRequest(recommendation, dashboardName) {
  const authoredOn = new Date().toISOString().slice(0, 10);
  return {
    resourceType: "ServiceRequest",
    status: "draft",
    intent: "order",
    priority: "routine",
    category: [
      {
        text: "Population health"
      }
    ],
    code: {
      text: recommendation.orderInput.display,
      coding: [
        {
          system: "http://example.org/dashboard-to-order-codes",
          code: recommendation.orderInput.code,
          display: recommendation.orderInput.display
        }
      ]
    },
    subject: {
      reference: `Patient/${recommendation.patientId || "unknown"}`,
      display: recommendation.patientName || "Unknown patient"
    },
    requester: {
      display: recommendation.provider
    },
    occurrenceString: recommendation.orderInput.occurrenceText,
    authoredOn,
    reasonCode: [
      {
        text: recommendation.gapReason || "Clinical gap identified"
      }
    ],
    note: [
      {
        text: `Generated from ${dashboardName}. ${recommendation.explanation.join(" ")}`
      }
    ]
  };
}

function guessPatientId(row) {
  return row["CDCR#"] || row.MRN || row["Patient identifier"] || "";
}

function buildPatientName(row) {
  if (row["Patient Name"]) {
    return row["Patient Name"];
  }

  if (row["First Name"] || row["Last Name"]) {
    return `${row["Last Name"] || ""}, ${row["First Name"] || ""}`.replace(/(^,\s*)|,\s*$/g, "").trim();
  }

  return row["Last Name"] || "Unknown patient";
}

function guessProvider(row) {
  return row["Care Team"] || row["Assigned Provider"] || row["Assigned provider or clinic"] || "Unassigned provider";
}

function deriveDueDate(action, row) {
  if (action.dueDateField && row[action.dueDateField]) {
    return row[action.dueDateField];
  }
  
  if (action.dueDaysFromToday) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + Number(action.dueDaysFromToday));
    return dueDate.toISOString().slice(0, 10);
  }

  return "";
}

function parseNumber(value) {
  const parsed = Number(String(value || "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const normalizedValue = String(value).trim();
  const date = new Date(normalizedValue);
  if (!Number.isNaN(date.getTime())) {
    return date;
  }

  const match = normalizedValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) {
    return null;
  }

  const [, month, day, year] = match;
  const fullYear = year.length === 2 ? `20${year}` : year;
  const manualDate = new Date(`${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
  return Number.isNaN(manualDate.getTime()) ? null : manualDate;
}

function daysBetween(dateA, dateB) {
  return Math.floor((dateB - dateA) / (1000 * 60 * 60 * 24));
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function isAffirmative(value) {
  return ["yes", "y", "true", "1", "✓"].includes(normalize(value));
}

module.exports = {
  analyzeCsv,
  buildPatientName,
  buildServiceRequest,
  evaluateRuleset,
  guessPatientId,
  guessProvider
};
