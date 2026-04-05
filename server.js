const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const rulesets = [
  {
    id: "colon-cancer-fit",
    name: "Colon Cancer FIT Outreach",
    description:
      "Patients age 45-75 who are overdue for screening, have not recently refused, and do not already have another screening documented.",
    recommendedOrder: "FIT test",
    measure: "Colon cancer screening",
    evaluate(row) {
      const age = parseNumber(row.Age);
      const screened = normalize(row["Screened within Timeframes"]);
      const otherScreeningType = normalize(row["Other Screening Type"]);
      const refusalDate = parseDate(row["Screening Refusal Date"]);
      const excludedFromScreening = isAffirmative(row["Excluded from Screening"]);
      const historyOfPositive = isAffirmative(row["History of Positive"]);
      const today = new Date();
      const refusalExpired =
        !refusalDate || daysBetween(refusalDate, today) > 365;
      const eligibleAge = age >= 45 && age <= 75;
      const triggered =
        eligibleAge &&
        screened === "no" &&
        !otherScreeningType &&
        !excludedFromScreening &&
        !historyOfPositive &&
        refusalExpired;

      return buildEvaluation(row, {
        triggered,
        patientId: row["CDCR#"] || row["Patient identifier"] || "",
        patientName: buildPatientName(row),
        provider:
          row["Care Team"] ||
          row["Assigned provider or clinic"] ||
          "Unassigned PCP",
        gapReason:
          row["Measure name / gap reason"] || "Overdue colon cancer screening",
        dueDate: row["Screening Due Date"] || "",
        explanation: [
          `Age ${Number.isFinite(age) ? age : "unknown"} ${
            eligibleAge ? "is within" : "is outside"
          } the 45-75 screening window.`,
          `Screened within timeframes is ${row["Screened within Timeframes"] || "blank"}.`,
          `Screening refusal date is ${
            row["Screening Refusal Date"] || "blank"
          }, so the refusal lookback is ${
            refusalExpired ? "cleared" : "still active"
          }.`,
          `Excluded from screening is ${
            excludedFromScreening ? "Yes" : row["Excluded from Screening"] || "blank"
          }.`,
          `History of positive screening is ${
            historyOfPositive ? "Yes" : row["History of Positive"] || "blank"
          }.`,
          `Other screening type is ${
            row["Other Screening Type"] || "blank"
          }.`
        ],
        orderInput: {
          code: "FIT",
          display: "Fecal immunochemical test",
          occurrenceText: "Routine within next month"
        }
      });
    }
  },
  {
    id: "cirrhosis-ultrasound-surveillance",
    name: "Cirrhosis HCC Ultrasound Surveillance",
    description:
      "Patients on the cirrhosis registry with a cirrhosis diagnosis who are overdue for liver ultrasound surveillance and have not refused it.",
    recommendedOrder: "Liver ultrasound for HCC surveillance",
    measure: "Cirrhosis management",
    evaluate(row) {
      const age = parseNumber(row.Age);
      const diagnosisPresent = isAffirmative(row.Diagnosis);
      const ultrasoundDate = parseDate(row["Ultrasound Screening Date"]);
      const ultrasoundOrdered = isAffirmative(row["Ultrasound Screening Ordered"]);
      const ultrasoundRefused = parseDate(row["Ultrasound Screening Refused"]);
      const refusalExpired = !ultrasoundRefused || daysBetween(ultrasoundRefused, new Date()) > 365;
      const screeningOverdue = !ultrasoundDate || daysBetween(ultrasoundDate, new Date()) > 180;
      const triggered =
        diagnosisPresent &&
        age >= 18 &&
        screeningOverdue &&
        !ultrasoundOrdered &&
        refusalExpired;

      return buildEvaluation(row, {
        triggered,
        patientId: row["CDCR#"] || "",
        patientName: buildPatientName(row),
        provider: row["Care Team"] || "Cirrhosis care team",
        gapReason: "Overdue ultrasound surveillance for hepatocellular carcinoma",
        dueDate: formatDateValue(addDays(ultrasoundDate || new Date(), 30)),
        explanation: [
          `Diagnosis flag is ${row.Diagnosis || "blank"}.`,
          `Last ultrasound screening date is ${row["Ultrasound Screening Date"] || "blank"}.`,
          `Ultrasound already ordered is ${row["Ultrasound Screening Ordered"] || "blank"}.`,
          `Ultrasound refusal date is ${row["Ultrasound Screening Refused"] || "blank"}, so the refusal lookback is ${
            refusalExpired ? "cleared" : "still active"
          }.`
        ],
        orderInput: {
          code: "CIRR-US",
          display: "Liver ultrasound for HCC surveillance",
          occurrenceText: "Schedule within 30 days"
        }
      });
    }
  },
  {
    id: "cirrhosis-afp-lab",
    name: "Cirrhosis AFP Monitoring",
    description:
      "Patients on the cirrhosis registry who are due for alpha-fetoprotein lab monitoring and have no active refusal.",
    recommendedOrder: "AFP lab",
    measure: "Cirrhosis management",
    evaluate(row) {
      const diagnosisPresent = isAffirmative(row.Diagnosis);
      const afpDate = parseDate(row["AFP Date"]);
      const afpOrdered = isAffirmative(row["AFP Ordered"]);
      const afpRefused = parseDate(row["AFP Refused"]);
      const refusalExpired = !afpRefused || daysBetween(afpRefused, new Date()) > 365;
      const afpOverdue = !afpDate || daysBetween(afpDate, new Date()) > 180;
      const triggered =
        diagnosisPresent &&
        afpOverdue &&
        !afpOrdered &&
        refusalExpired;

      return buildEvaluation(row, {
        triggered,
        patientId: row["CDCR#"] || "",
        patientName: buildPatientName(row),
        provider: row["Care Team"] || "Cirrhosis care team",
        gapReason: "Overdue AFP laboratory monitoring",
        dueDate: formatDateValue(addDays(afpDate || new Date(), 30)),
        explanation: [
          `Diagnosis flag is ${row.Diagnosis || "blank"}.`,
          `Last AFP date is ${row["AFP Date"] || "blank"}.`,
          `AFP already ordered is ${row["AFP Ordered"] || "blank"}.`,
          `AFP refusal date is ${row["AFP Refused"] || "blank"}, so the refusal lookback is ${
            refusalExpired ? "cleared" : "still active"
          }.`
        ],
        orderInput: {
          code: "CIRR-AFP",
          display: "Alpha-fetoprotein lab monitoring",
          occurrenceText: "Collect within 30 days"
        }
      });
    }
  },
  {
    id: "cirrhosis-varices-screening",
    name: "Cirrhosis Varices Screening",
    description:
      "Patients flagged as needing EGD or Fibroscan who are overdue for varices screening and have not recently refused.",
    recommendedOrder: "EGD or Fibroscan for varices screening",
    measure: "Cirrhosis management",
    evaluate(row) {
      const diagnosisPresent = isAffirmative(row.Diagnosis);
      const required = normalize(row["EGD or Fibroscan Required?"]);
      const egdDate = parseDate(row["Varices Screened (EGD) Date"]);
      const varicesOrdered = isAffirmative(row["Varices Screening Ordered"]);
      const varicesRefused = parseDate(row["Varices Screening Refusal Date"]);
      const refusalExpired = !varicesRefused || daysBetween(varicesRefused, new Date()) > 365;
      const screeningOverdue = !egdDate || daysBetween(egdDate, new Date()) > 365;
      const triggered =
        diagnosisPresent &&
        (required === "egd" || required === "fibroscan") &&
        screeningOverdue &&
        !varicesOrdered &&
        refusalExpired;

      return buildEvaluation(row, {
        triggered,
        patientId: row["CDCR#"] || "",
        patientName: buildPatientName(row),
        provider: row["Care Team"] || "Cirrhosis care team",
        gapReason: "Overdue esophageal varices screening",
        dueDate: formatDateValue(addDays(egdDate || new Date(), 30)),
        explanation: [
          `Diagnosis flag is ${row.Diagnosis || "blank"}.`,
          `EGD or Fibroscan required is ${row["EGD or Fibroscan Required?"] || "blank"}.`,
          `Last varices screening date is ${row["Varices Screened (EGD) Date"] || "blank"}.`,
          `Varices screening already ordered is ${row["Varices Screening Ordered"] || "blank"}.`,
          `Varices screening refusal date is ${
            row["Varices Screening Refusal Date"] || "blank"
          }, so the refusal lookback is ${refusalExpired ? "cleared" : "still active"}.`
        ],
        orderInput: {
          code: "CIRR-EGD",
          display: "EGD or Fibroscan for varices screening",
          occurrenceText: "Arrange within 30 days"
        }
      });
    }
  },
  {
    id: "lung-cancer-ldct",
    name: "Lung Cancer LDCT Screening",
    description:
      "Patients age 50-80 with a smoking history of at least 20 pack years who currently smoke or quit within 15 years.",
    recommendedOrder: "Low-dose CT chest",
    measure: "Lung cancer screening",
    evaluate(row) {
      const age = parseNumber(row.Age);
      const packYears =
        parseNumber(row["Pack Years"]) || parseNumber(row["Smoking Pack Years"]);
      const currentSmoker = normalize(row["Smoking Status"]) === "current";
      const quitYearsAgo =
        parseNumber(row["Years Since Quit"]) ||
        yearsSinceDate(parseDate(row["Quit Date"]));
      const eligibleAge = age >= 50 && age <= 80;
      const eligibleSmoking =
        packYears >= 20 && (currentSmoker || quitYearsAgo <= 15);
      const triggered = eligibleAge && eligibleSmoking;

      return buildEvaluation(row, {
        triggered,
        patientId: row.MRN || row["Patient identifier"] || "",
        patientName: row["Patient Name"] || "Unknown patient",
        provider:
          row["Assigned Provider"] ||
          row["Assigned provider or clinic"] ||
          "Unassigned PCP",
        gapReason:
          row["Measure name / gap reason"] || "Eligible for lung cancer screening",
        dueDate: row["Due Date"] || "",
        explanation: [
          `Age ${Number.isFinite(age) ? age : "unknown"} ${
            eligibleAge ? "meets" : "does not meet"
          } the 50-80 screening window.`,
          `Smoking history is ${Number.isFinite(packYears) ? packYears : "unknown"} pack years.`,
          `Smoking status is ${row["Smoking Status"] || "blank"}.`,
          `Years since quit is ${
            Number.isFinite(quitYearsAgo) ? quitYearsAgo : "unknown"
          }.`
        ],
        orderInput: {
          code: "LDCT",
          display: "Low-dose CT for lung cancer screening",
          occurrenceText: "Schedule within 30 days"
        }
      });
    }
  }
];

const inbox = [];
let nextOrderId = 1;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    return handleApi(req, res, url);
  }

  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  return serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Dashboard-to-Orders demo running on http://localhost:${PORT}`);
});

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/rulesets") {
    return sendJson(res, 200, {
      rulesets: rulesets.map(({ id, name, description, recommendedOrder, measure }) => ({
        id,
        name,
        description,
        recommendedOrder,
        measure
      }))
    });
  }

  if (req.method === "POST" && url.pathname === "/api/session/reset") {
    resetSessionState();
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/evaluate") {
    const body = await readJson(req, res);
    if (!body) {
      return;
    }

    const ruleset = rulesets.find((item) => item.id === body.rulesetId);
    if (!ruleset) {
      return sendJson(res, 400, { error: "Unknown ruleset" });
    }

    const rows = parseCsv(body.csvText || "");
    const evaluations = rows.map((row) => ruleset.evaluate(row));
    return sendJson(res, 200, {
      dashboardName: body.dashboardName || "Uploaded dashboard",
      totalRows: rows.length,
      triggeredCount: evaluations.filter((item) => item.triggered).length,
      evaluations
    });
  }

  if (req.method === "POST" && url.pathname === "/api/orders/generate") {
    const body = await readJson(req, res);
    if (!body) {
      return;
    }

    const created = (body.recommendations || []).map((recommendation) => {
      const now = new Date().toISOString();
      const order = {
        id: String(nextOrderId++),
        status: "draft",
        decision: "pending",
        createdAt: now,
        dashboardName: body.dashboardName || "Uploaded dashboard",
        patientId: recommendation.patientId,
        patientName: recommendation.patientName,
        provider: recommendation.provider,
        gapReason: recommendation.gapReason,
        recommendedOrder: recommendation.recommendedOrder,
        explanation: recommendation.explanation,
        auditNote: `Created by Dashboard-to-Order app from ${
          body.dashboardName || "Uploaded dashboard"
        } on ${formatDate(now)}.`,
        fhirServiceRequest: buildServiceRequest(recommendation, body.dashboardName || "Uploaded dashboard")
      };
      inbox.push(order);
      return order;
    });

    return sendJson(res, 201, { created });
  }

  if (req.method === "GET" && url.pathname === "/api/inbox") {
    return sendJson(res, 200, { orders: inbox });
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/inbox/")) {
    const [, , , orderId, action] = url.pathname.split("/");
    if (action !== "decision") {
      return sendJson(res, 404, { error: "Not found" });
    }

    const body = await readJson(req, res);
    if (!body) {
      return;
    }

    const order = inbox.find((item) => item.id === orderId);
    if (!order) {
      return sendJson(res, 404, { error: "Order not found" });
    }

    if (!["accepted", "rejected", "deferred"].includes(body.decision)) {
      return sendJson(res, 400, { error: "Invalid decision" });
    }

    order.decision = body.decision;
    order.status = body.decision === "accepted" ? "active" : "draft";
    order.reviewedAt = new Date().toISOString();
    order.reviewerComment = body.comment || "";

    return sendJson(res, 200, { order });
  }

  return sendJson(res, 404, { error: "Not found" });
}

function serveStatic(req, res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(PUBLIC_DIR, requestedPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendText(res, 403, "Forbidden");
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      return sendText(res, 404, "Not found");
    }
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(content);
  });
}

async function readJson(req, res) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch (error) {
    sendJson(res, 400, { error: "Invalid JSON body" });
    return null;
  }
}

function sendJson(res, statusCode, payload) {
  const text = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
    "Cache-Control": "no-store"
  });
  res.end(text);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(text);
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".csv")) return "text/csv; charset=utf-8";
  return "application/octet-stream";
}

function parseCsv(csvText) {
  const lines = csvText
    .replace(/\r/g, "")
    .replace(/^\uFEFF/, "")
    .split("\n")
    .filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    return [];
  }

  const headerIndex = findHeaderRowIndex(lines);
  if (headerIndex === -1) {
    return [];
  }

  const headers = splitCsvLine(lines[headerIndex]);
  return lines.slice(headerIndex + 1).map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] || "";
      return row;
    }, {});
  });
}

function findHeaderRowIndex(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const cells = splitCsvLine(lines[index]);
    const nonEmptyCells = cells.filter((cell) => cell.trim() !== "");
    if (nonEmptyCells.length >= 3) {
      return index;
    }
  }
  return -1;
}

function resetSessionState() {
  inbox.length = 0;
  nextOrderId = 1;
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const next = line[index + 1];

    if (character === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  result.push(current.trim());
  return result;
}

function buildEvaluation(row, context) {
  return {
    triggered: context.triggered,
    patientId: context.patientId,
    patientName: context.patientName,
    provider: context.provider,
    gapReason: context.gapReason,
    dueDate: context.dueDate,
    recommendedOrder: context.orderInput.display,
    explanation: context.explanation,
    rawRow: row,
    orderInput: context.orderInput
  };
}

function buildServiceRequest(recommendation, dashboardName) {
  const authoredOn = new Date().toISOString().slice(0, 10);
  return {
    resourceType: "ServiceRequest",
    status: "draft",
    intent: "order",
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
      reference: `Patient/${recommendation.patientId || "unknown"}`
    },
    requester: {
      display: recommendation.provider
    },
    occurrenceString: recommendation.orderInput.occurrenceText,
    authoredOn,
    note: [
      {
        text: `Generated from ${dashboardName}. ${recommendation.explanation.join(" ")}`
      }
    ]
  };
}

function buildPatientName(row) {
  const withFirstLast = `${row["Last Name"] || ""}, ${row["First Name"] || ""}`.replace(
    /(^,\s*)|(^\s*,\s*$)|,\s*$/,
    ""
  );
  return withFirstLast || row["Patient Name"] || row["Last Name"] || "Unknown patient";
}

function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function parseDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(dateA, dateB) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((dateB - dateA) / msPerDay);
}

function yearsSinceDate(date) {
  if (!date) {
    return NaN;
  }
  return Math.floor(daysBetween(date, new Date()) / 365);
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function isAffirmative(value) {
  const normalized = normalize(value);
  return normalized === "yes" || normalized === "y" || normalized === "true" || normalized === "1" || normalized === "✓";
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatDateValue(value) {
  if (!value) {
    return "";
  }
  return new Date(value).toISOString().slice(0, 10);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}
