#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env" });

const args = process.argv.slice(2);
const throughArg = args.find((arg) => arg.startsWith("--through="));
const dryRun = args.includes("--dry-run");

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage:
  node scripts/repair-drizzle-migrations.mjs --through=<migration_tag> [--dry-run]

Examples:
  node scripts/repair-drizzle-migrations.mjs --through=0014_wealthy_kree
  node scripts/repair-drizzle-migrations.mjs --through=0017_add_evidence_requirements --dry-run
`);
  process.exit(0);
}

if (!throughArg) {
  console.error("Missing required flag: --through=<migration_tag>");
  process.exit(1);
}

const throughTag = throughArg.split("=")[1];
if (!throughTag) {
  console.error("Invalid --through value.");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set in .env");
  process.exit(1);
}

const drizzleDir = path.resolve(process.cwd(), "drizzle");
const journalPath = path.join(drizzleDir, "meta", "_journal.json");
if (!fs.existsSync(journalPath)) {
  console.error(`Could not find journal file: ${journalPath}`);
  process.exit(1);
}

const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
const entries = Array.isArray(journal.entries) ? journal.entries : [];
const throughIndex = entries.findIndex((entry) => entry.tag === throughTag);

if (throughIndex === -1) {
  console.error(`Tag "${throughTag}" not found in drizzle/meta/_journal.json`);
  process.exit(1);
}

const targetEntries = entries.slice(0, throughIndex + 1);
const sql = neon(databaseUrl);

await sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`;
await sql`
  CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
    "id" SERIAL PRIMARY KEY,
    "hash" text NOT NULL,
    "created_at" bigint
  )
`;

const existingRows = await sql`SELECT "hash" FROM "drizzle"."__drizzle_migrations"`;
const existingHashes = new Set(existingRows.map((row) => row.hash));

let inserted = 0;
for (const entry of targetEntries) {
  const migrationPath = path.join(drizzleDir, `${entry.tag}.sql`);
  if (!fs.existsSync(migrationPath)) {
    console.error(`Missing migration file: ${migrationPath}`);
    process.exit(1);
  }

  const file = fs.readFileSync(migrationPath, "utf8");
  const hash = crypto.createHash("sha256").update(file).digest("hex");

  if (existingHashes.has(hash)) {
    continue;
  }

  if (!dryRun) {
    await sql`
      INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
      VALUES (${hash}, ${entry.when})
    `;
  }
  inserted += 1;
}

console.log(
  `${dryRun ? "[dry-run] " : ""}Migration repair complete. Through: ${throughTag}. Inserted rows: ${inserted}.`
);
