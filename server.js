const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { createRulesDb } = require("./lib/rules-db");
const { getSeedRules, detectClinicalProfile, getRuleSuggestions } = require("./lib/seed-rules");
const { analyzeCsv, buildServiceRequest, evaluateRuleset } = require("./lib/rule-engine");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DB_DIR = process.env.HOME
  ? path.join(process.env.HOME, "site", "data")
  : path.join(__dirname, ".data");
const DB_FILE_PATH = path.join(DB_DIR, "rulesets.sqlite");

async function main() {
  const rulesDb = await createRulesDb({
    dbFilePath: DB_FILE_PATH,
    seedRules: getSeedRules()
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(req, res, url, rulesDb);
    }

    if (req.method !== "GET") {
      return sendJson(res, 405, { error: "Method not allowed" });
    }

    return serveStatic(res, url.pathname);
  });

  server.listen(PORT, () => {
    console.log(`Dashboard-to-Orders demo running on http://localhost:${PORT}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function handleApi(req, res, url, rulesDb) {
  if (req.method === "GET" && url.pathname === "/api/rulesets") {
    const status = url.searchParams.get("status");
    return sendJson(res, 200, {
      rulesets: rulesDb.listRulesets(status ? { status } : {})
    });
  }

  if (req.method === "POST" && url.pathname === "/api/session/reset") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/evaluate") {
    const body = await readJson(req, res);
    if (!body) {
      return;
    }

    const ruleset = rulesDb.getRuleset(body.rulesetId);
    if (!ruleset) {
      return sendJson(res, 400, { error: "Unknown ruleset" });
    }

    const analysis = analyzeCsv(body.csvText || "");
    const evaluations = analysis.rows.map((row) => {
      const evaluation = evaluateRuleset(ruleset, row);
      return {
        ...evaluation,
        fhirServiceRequest: buildServiceRequest(evaluation, body.dashboardName || "Uploaded dashboard")
      };
    });
    return sendJson(res, 200, {
      dashboardName: body.dashboardName || "Uploaded dashboard",
      totalRows: analysis.rows.length,
      triggeredCount: evaluations.filter((item) => item.triggered).length,
      evaluations
    });
  }

  if (req.method === "POST" && url.pathname === "/api/builder/analyze") {
    const body = await readJson(req, res);
    if (!body) {
      return;
    }

    const analysis = analyzeCsv(body.csvText || "");
    const profile = detectClinicalProfile(analysis.headers);
    const suggestions = getRuleSuggestions(profile);

    return sendJson(res, 200, {
      profile,
      headers: analysis.headers,
      fields: analysis.fields,
      previewRows: analysis.rows.slice(0, 5),
      suggestions
    });
  }

  if (req.method === "POST" && url.pathname === "/api/csv/preview") {
    const body = await readJson(req, res);
    if (!body) {
      return;
    }

    const analysis = analyzeCsv(body.csvText || "");
    return sendJson(res, 200, {
      headers: analysis.headers,
      previewRows: analysis.rows.slice(0, 25),
      totalRows: analysis.rows.length
    });
  }

  if (req.method === "POST" && url.pathname === "/api/rulesets") {
    const body = await readJson(req, res);
    if (!body) {
      return;
    }

    const saved = rulesDb.saveRuleset(body);
    return sendJson(res, 200, { ruleset: saved });
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/rulesets/")) {
    const id = Number(url.pathname.split("/")[3]);
    rulesDb.deleteRuleset(id);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: "Not found" });
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

function serveStatic(res, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(PUBLIC_DIR, requestedPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendText(res, 403, "Forbidden");
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      return sendText(res, 404, "Not found");
    }
    res.writeHead(200, {
      "Content-Type": contentType(filePath),
      "Cache-Control": "no-store"
    });
    res.end(content);
  });
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
  if (filePath.endsWith(".wasm")) return "application/wasm";
  return "application/octet-stream";
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}
