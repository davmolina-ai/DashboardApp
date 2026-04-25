const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

async function createRulesDb({ dbFilePath, seedRules }) {
  fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });

  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, "..", "node_modules", "sql.js", "dist", file)
  });

  let db;
  if (fs.existsSync(dbFilePath)) {
    db = new SQL.Database(fs.readFileSync(dbFilePath));
  } else {
    db = new SQL.Database();
  }

  createSchema(db);
  await seedIfNeeded(db, seedRules);
  syncSeedMetadata(db, seedRules);
  persist(dbFilePath, db);

  return {
    listRulesets(filters = {}) {
      const where = [];
      const params = [];

      if (filters.status) {
        where.push("status = ?");
        params.push(filters.status);
      }

      const statement = [
        "SELECT id, slug, name, description, status, measure, profile, source_type, source_label, source_url, rationale, definition_json, created_at, updated_at",
        "FROM rulesets",
        where.length ? `WHERE ${where.join(" AND ")}` : "",
        "ORDER BY updated_at DESC, name ASC"
      ].join(" ");

      return readAll(db, statement, params).map(parseRuleRow);
    },

    getRuleset(id) {
      const row = readOne(
        db,
        "SELECT id, slug, name, description, status, measure, profile, source_type, source_label, source_url, rationale, definition_json, created_at, updated_at FROM rulesets WHERE id = ?",
        [id]
      );
      return row ? parseRuleRow(row) : null;
    },

    saveRuleset(record) {
      const now = new Date().toISOString();
      const serializedDefinition = JSON.stringify(record.definition || {});
      const uniqueSlug = resolveUniqueSlug(
        db,
        record.slug || slugify(record.name || "untitled-ruleset"),
        record.id
      );
      const payload = [
        uniqueSlug,
        record.name || "Untitled Ruleset",
        record.description || "",
        record.status || "Draft",
        record.measure || "",
        record.profile || "generic",
        record.sourceType || "custom_builder",
        record.sourceLabel || "",
        record.sourceUrl || "",
        record.rationale || "",
        serializedDefinition,
        now
      ];

      if (record.id) {
        run(
          db,
          `UPDATE rulesets
           SET slug = ?, name = ?, description = ?, status = ?, measure = ?, profile = ?, source_type = ?, source_label = ?, source_url = ?, rationale = ?, definition_json = ?, updated_at = ?
           WHERE id = ?`,
          [...payload, record.id]
        );
      } else {
        run(
          db,
          `INSERT INTO rulesets (slug, name, description, status, measure, profile, source_type, source_label, source_url, rationale, definition_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [...payload, now]
        );
      }

      persist(dbFilePath, db);

      const saved = record.id
        ? this.getRuleset(record.id)
        : readOne(
            db,
            "SELECT id, slug, name, description, status, measure, profile, source_type, source_label, source_url, rationale, definition_json, created_at, updated_at FROM rulesets ORDER BY id DESC LIMIT 1"
          );
      return record.id ? saved : parseRuleRow(saved);
    },

    deleteRuleset(id) {
      run(db, "DELETE FROM rulesets WHERE id = ?", [id]);
      persist(dbFilePath, db);
    }
  };
}

function createSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS rulesets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Draft',
      measure TEXT DEFAULT '',
      profile TEXT DEFAULT 'generic',
      source_type TEXT DEFAULT 'custom_builder',
      source_label TEXT DEFAULT '',
      source_url TEXT DEFAULT '',
      rationale TEXT DEFAULT '',
      definition_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  try {
    db.run("ALTER TABLE rulesets ADD COLUMN source_url TEXT DEFAULT ''");
  } catch (error) {
    // Column already exists in existing databases.
  }
}

async function seedIfNeeded(db, seedRules) {
  const countRow = readOne(db, "SELECT COUNT(*) AS count FROM rulesets");
  if (Number(countRow?.count || 0) > 0) {
    return;
  }

  const now = new Date().toISOString();
  seedRules.forEach((rule) => {
    run(
      db,
      `INSERT INTO rulesets (slug, name, description, status, measure, profile, source_type, source_label, source_url, rationale, definition_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rule.slug,
        rule.name,
        rule.description || "",
        rule.status || "Active",
        rule.measure || "",
        rule.profile || "generic",
        rule.sourceType || "curated_guideline",
        rule.sourceLabel || "",
        rule.sourceUrl || "",
        rule.rationale || "",
        JSON.stringify(rule.definition || {}),
        now,
        now
      ]
    );
  });
}

function syncSeedMetadata(db, seedRules) {
  seedRules.forEach((rule) => {
    if (!rule.slug) {
      return;
    }

    run(
      db,
      `UPDATE rulesets
       SET source_type = COALESCE(NULLIF(source_type, ''), ?),
           source_label = CASE WHEN source_label = '' THEN ? ELSE source_label END,
           source_url = CASE WHEN source_url = '' THEN ? ELSE source_url END,
           rationale = CASE WHEN rationale = '' THEN ? ELSE rationale END
       WHERE slug = ?`,
      [
        rule.sourceType || "curated_guideline",
        rule.sourceLabel || "",
        rule.sourceUrl || "",
        rule.rationale || "",
        rule.slug
      ]
    );
  });
}

function persist(dbFilePath, db) {
  const data = db.export();
  fs.writeFileSync(dbFilePath, Buffer.from(data));
}

function run(db, statement, params = []) {
  const prepared = db.prepare(statement);
  prepared.run(params);
  prepared.free();
}

function readAll(db, statement, params = []) {
  const prepared = db.prepare(statement);
  prepared.bind(params);
  const rows = [];
  while (prepared.step()) {
    rows.push(prepared.getAsObject());
  }
  prepared.free();
  return rows;
}

function readOne(db, statement, params = []) {
  return readAll(db, statement, params)[0] || null;
}

function parseRuleRow(row) {
  const definition =
    row.definition ||
    JSON.parse(row.definition_json || "{}");

  return {
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    description: row.description,
    status: row.status,
    measure: row.measure,
    profile: row.profile,
    sourceType: row.sourceType || row.source_type,
    sourceLabel: row.sourceLabel || row.source_label,
    sourceUrl: row.sourceUrl || row.source_url || "",
    rationale: row.rationale,
    definition,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at
  };
}

function slugify(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled-ruleset";
}

function resolveUniqueSlug(db, baseSlug, currentId) {
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = currentId
      ? readOne(db, "SELECT id FROM rulesets WHERE slug = ? AND id != ?", [candidate, currentId])
      : readOne(db, "SELECT id FROM rulesets WHERE slug = ?", [candidate]);

    if (!existing) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

module.exports = {
  createRulesDb
};
