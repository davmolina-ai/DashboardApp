const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

async function createRulesDb({ dbFilePath, seedRules, seedGuidelineSources = [] }) {
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
  await seedIfNeeded(db, seedRules, seedGuidelineSources);
  syncSeedMetadata(db, seedRules);
  syncGuidelineSources(db, seedGuidelineSources);
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
    },

    listGuidelineSources(filters = {}) {
      const where = [];
      const params = [];

      if (filters.domain) {
        where.push("domain = ?");
        params.push(filters.domain);
      }

      const statement = [
        "SELECT id, source_key, domain, authority, title, url, summary, key_points_json, status, source_type, created_at, updated_at",
        "FROM guideline_sources",
        where.length ? `WHERE ${where.join(" AND ")}` : "",
        "ORDER BY domain ASC, authority ASC, title ASC"
      ].join(" ");

      return readAll(db, statement, params).map(parseGuidelineSourceRow);
    },

    saveGuidelineSource(record) {
      const now = new Date().toISOString();
      const sourceKey = resolveUniqueSourceKey(
        db,
        record.sourceKey || slugify(`${record.domain || "generic"}-${record.authority || "source"}-${record.title || "guideline"}`),
        record.id
      );
      const payload = [
        sourceKey,
        record.domain || "generic",
        record.authority || "Custom source",
        record.title || "Untitled guideline source",
        record.url || "",
        record.summary || "",
        JSON.stringify(Array.isArray(record.keyPoints) ? record.keyPoints : splitKeyPoints(record.keyPoints)),
        record.status || "Active",
        record.sourceType || "custom_guideline_source",
        now
      ];

      if (record.id) {
        run(
          db,
          `UPDATE guideline_sources
           SET source_key = ?, domain = ?, authority = ?, title = ?, url = ?, summary = ?, key_points_json = ?, status = ?, source_type = ?, updated_at = ?
           WHERE id = ?`,
          [...payload, record.id]
        );
      } else {
        run(
          db,
          `INSERT INTO guideline_sources (source_key, domain, authority, title, url, summary, key_points_json, status, source_type, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [...payload, now]
        );
      }

      persist(dbFilePath, db);
      const saved = record.id
        ? this.getGuidelineSource(record.id)
        : readOne(
            db,
            "SELECT id, source_key, domain, authority, title, url, summary, key_points_json, status, source_type, created_at, updated_at FROM guideline_sources ORDER BY id DESC LIMIT 1"
          );
      return record.id ? saved : parseGuidelineSourceRow(saved);
    },

    getGuidelineSource(id) {
      const row = readOne(
        db,
        "SELECT id, source_key, domain, authority, title, url, summary, key_points_json, status, source_type, created_at, updated_at FROM guideline_sources WHERE id = ?",
        [id]
      );
      return row ? parseGuidelineSourceRow(row) : null;
    },

    deleteGuidelineSource(id) {
      run(db, "DELETE FROM guideline_sources WHERE id = ?", [id]);
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

  db.run(`
    CREATE TABLE IF NOT EXISTS guideline_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_key TEXT NOT NULL UNIQUE,
      domain TEXT NOT NULL DEFAULT 'generic',
      authority TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      key_points_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'Active',
      source_type TEXT NOT NULL DEFAULT 'curated_guideline_source',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

async function seedIfNeeded(db, seedRules, seedGuidelineSources) {
  const countRow = readOne(db, "SELECT COUNT(*) AS count FROM rulesets");
  if (Number(countRow?.count || 0) === 0) {
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

  const sourceCountRow = readOne(db, "SELECT COUNT(*) AS count FROM guideline_sources");
  if (Number(sourceCountRow?.count || 0) === 0) {
    const now = new Date().toISOString();
    seedGuidelineSources.forEach((source) => {
      run(
        db,
        `INSERT INTO guideline_sources (source_key, domain, authority, title, url, summary, key_points_json, status, source_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          source.sourceKey,
          source.domain || "generic",
          source.authority || "Unknown authority",
          source.title || "Untitled guideline source",
          source.url || "",
          source.summary || "",
          JSON.stringify(source.keyPoints || []),
          source.status || "Active",
          source.sourceType || "curated_guideline_source",
          now,
          now
        ]
      );
    });
  }
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

function syncGuidelineSources(db, seedGuidelineSources) {
  seedGuidelineSources.forEach((source) => {
    if (!source.sourceKey) {
      return;
    }

    const now = new Date().toISOString();
    const existing = readOne(db, "SELECT id FROM guideline_sources WHERE source_key = ?", [source.sourceKey]);
    if (existing) {
      run(
        db,
        `UPDATE guideline_sources
         SET domain = CASE WHEN domain = '' THEN ? ELSE domain END,
             authority = CASE WHEN authority = '' THEN ? ELSE authority END,
             title = CASE WHEN title = '' THEN ? ELSE title END,
             url = CASE WHEN url = '' THEN ? ELSE url END,
             summary = CASE WHEN summary = '' THEN ? ELSE summary END,
             key_points_json = CASE WHEN key_points_json = '[]' THEN ? ELSE key_points_json END,
             status = COALESCE(NULLIF(status, ''), ?),
             source_type = COALESCE(NULLIF(source_type, ''), ?),
             updated_at = ?
         WHERE source_key = ?`,
        [
          source.domain || "generic",
          source.authority || "Unknown authority",
          source.title || "Untitled guideline source",
          source.url || "",
          source.summary || "",
          JSON.stringify(source.keyPoints || []),
          source.status || "Active",
          source.sourceType || "curated_guideline_source",
          now,
          source.sourceKey
        ]
      );
      return;
    }

    run(
      db,
      `INSERT INTO guideline_sources (source_key, domain, authority, title, url, summary, key_points_json, status, source_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        source.sourceKey,
        source.domain || "generic",
        source.authority || "Unknown authority",
        source.title || "Untitled guideline source",
        source.url || "",
        source.summary || "",
        JSON.stringify(source.keyPoints || []),
        source.status || "Active",
        source.sourceType || "curated_guideline_source",
        now,
        now
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

function parseGuidelineSourceRow(row) {
  return {
    id: Number(row.id),
    sourceKey: row.sourceKey || row.source_key,
    domain: row.domain || "generic",
    authority: row.authority || "",
    title: row.title || "",
    url: row.url || "",
    summary: row.summary || "",
    keyPoints: JSON.parse(row.keyPoints || row.key_points_json || "[]"),
    status: row.status || "Active",
    sourceType: row.sourceType || row.source_type || "curated_guideline_source",
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

function resolveUniqueSourceKey(db, baseKey, currentId) {
  let candidate = baseKey;
  let suffix = 2;

  while (true) {
    const existing = currentId
      ? readOne(db, "SELECT id FROM guideline_sources WHERE source_key = ? AND id != ?", [candidate, currentId])
      : readOne(db, "SELECT id FROM guideline_sources WHERE source_key = ?", [candidate]);

    if (!existing) {
      return candidate;
    }

    candidate = `${baseKey}-${suffix}`;
    suffix += 1;
  }
}

function splitKeyPoints(value) {
  return String(value || "")
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = {
  createRulesDb
};
