/**
 * Applies db/schema.sql to the branch in DATABASE_URL.
 *
 *   bun run db:push
 *
 * The schema is written to be re-runnable, so this is safe to run against a
 * branch that already has it — which is the point: there is no migration
 * history to keep in step, and a Neon branch is cheap enough that the answer
 * to "what if this goes wrong" is a new branch rather than a down migration.
 *
 * Statements are split here rather than sent as one string because a failure
 * in the middle of an eighty-statement blob tells you nothing about which
 * statement failed. Splitting has to respect `$$ … $$`, since the enum guards
 * and the trigger function both contain semicolons inside a dollar-quoted
 * body.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  process.exit(1);
}

const sql = neon(url);
const source = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

/**
 * Split on top-level semicolons.
 *
 * "Top-level" has to mean outside three things, and leaving any of them out
 * produces a splitter that works until it doesn't:
 *
 * - `$$ … $$` — the enum guards and the trigger function have semicolons in
 *   their bodies.
 * - `'…'` — a string literal may contain one.
 * - `-- …` — and so may a comment. This is the one that actually bit: a
 *   semicolon in an explanatory sentence cut a comment in half and fed the
 *   back half to Postgres as SQL.
 */
export function statements(text: string): string[] {
  const out: string[] = [];
  let buf = "";
  let inDollar = false;
  let inString = false;
  let inComment = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inComment) {
      buf += ch;
      if (ch === "\n") inComment = false;
      continue;
    }

    if (inString) {
      buf += ch;
      /* '' is an escaped quote inside a string, not the end of one. */
      if (ch === "'" && text[i + 1] === "'") {
        buf += "'";
        i++;
      } else if (ch === "'") {
        inString = false;
      }
      continue;
    }

    if (!inDollar && text.startsWith("--", i)) {
      inComment = true;
      buf += "--";
      i++;
      continue;
    }

    if (text.startsWith("$$", i)) {
      inDollar = !inDollar;
      buf += "$$";
      i++;
      continue;
    }

    if (!inDollar && ch === "'") {
      inString = true;
      buf += ch;
      continue;
    }

    if (ch === ";" && !inDollar) {
      if (hasCode(buf)) out.push(buf.trim() + ";");
      buf = "";
      continue;
    }

    buf += ch;
  }

  if (hasCode(buf)) out.push(buf.trim());
  return out;
}

/** A chunk that is only comments and blank lines is not a statement. */
const hasCode = (chunk: string) =>
  chunk
    .split("\n")
    .some((line) => line.trim() !== "" && !line.trim().startsWith("--"));

/** The first non-comment line, for the progress log. */
const describe = (statement: string) =>
  statement
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l !== "" && !l.startsWith("--"))
    ?.slice(0, 72) ?? "?";

const all = statements(source);
console.log(`${all.length} statements → ${new URL(url).host}`);

let done = 0;
for (const statement of all) {
  try {
    await sql.query(statement);
    done++;
  } catch (error) {
    console.error(`\nFAILED: ${describe(statement)}\n`);
    console.error(statement);
    console.error(`\n${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

console.log(`ok — ${done} statements applied`);
