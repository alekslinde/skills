#!/usr/bin/env node
//
// SPDX-FileCopyrightText: 2026 Aleksandr Linde
// SPDX-License-Identifier: Apache-2.0
//
// The mechanical half of the agent directory audit.
//
//   node inspect.mjs [--dir <agent-dir>] [--json]
//
// Measures what an agent directory holds, splits it into what the agent
// already clears on its own and what it never will, and resolves which
// per-project state belongs to a project that no longer exists.
//
// It reports evidence, never conclusions, and it deletes nothing. Deciding
// what is worth removing needs to know which sessions the owner still wants
// to resume, and that is a question for them — see references/audit.md.
//
// Deliberately dependency-free and read-only. A tool that frees disk space by
// deleting things it misidentified is worse than the disk it saved.

import { readFileSync, existsSync, readdirSync, statSync, lstatSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";

const args = process.argv.slice(2);
const wantJson = args.includes("--json");

const dirFlag = args.indexOf("--dir");
const agentDir =
  dirFlag !== -1 && args[dirFlag + 1]
    ? resolve(args[dirFlag + 1])
    : join(homedir(), ".claude");

if (!existsSync(agentDir)) {
  console.error(`no such directory: ${agentDir}`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

// Counts physical blocks rather than apparent size, and counts each inode once,
// so a hard-linked file is not billed twice. This is what the disk actually
// gets back, which is the number the owner is deciding against.
const seenInodes = new Set();

function measure(path) {
  let bytes = 0;
  let files = 0;
  let newest = 0;
  let oldest = Infinity;

  const walk = (p) => {
    let st;
    try {
      st = lstatSync(p);
    } catch {
      return; // vanished mid-walk, or unreadable
    }

    if (st.isSymbolicLink()) return; // never follow: a link out of the tree is not this tree's cost

    if (st.isDirectory()) {
      let entries;
      try {
        entries = readdirSync(p);
      } catch {
        return;
      }
      for (const e of entries) walk(join(p, e));
      return;
    }

    if (st.nlink > 1) {
      const key = `${st.dev}:${st.ino}`;
      if (seenInodes.has(key)) return;
      seenInodes.add(key);
    }

    bytes += st.blocks * 512;
    files += 1;
    if (st.mtimeMs > newest) newest = st.mtimeMs;
    if (st.mtimeMs < oldest) oldest = st.mtimeMs;
  };

  walk(path);
  return { bytes, files, newest, oldest: oldest === Infinity ? 0 : oldest };
}

const DAY = 86400000;
const now = Date.now();
const ageDays = (ms) => (ms ? Math.floor((now - ms) / DAY) : null);

function fmt(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)}G`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)}M`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}K`;
  return `${bytes}B`;
}

// ---------------------------------------------------------------------------
// Project path decoding
// ---------------------------------------------------------------------------

// Claude Code names each project's state directory after its absolute path
// with every "/" replaced by "-". That encoding is lossy: a directory whose
// own name contains a hyphen is indistinguishable from a path separator, so
// "-Users-me-src-my-app" could be /Users/me/src/my-app or /Users/me/src/my/app.
//
// Decoding by naive string replacement therefore reports live projects as
// deleted. Here that would mean offering to purge the state of a repository
// sitting on disk — so instead every possible split is tested against the
// filesystem, and a directory is only called missing when no split resolves.
function decodeProjectDir(name) {
  const parts = name.replace(/^-/, "").split("-");

  const rec = (prefix, rest) => {
    if (rest.length === 0) {
      return existsSync(prefix) ? prefix : null;
    }
    for (let i = 1; i <= rest.length; i++) {
      const candidate = `${prefix}/${rest.slice(0, i).join("-")}`;
      let ok = false;
      try {
        ok = statSync(candidate).isDirectory();
      } catch {
        ok = false;
      }
      if (ok) {
        const found = rec(candidate, rest.slice(i));
        if (found) return found;
      }
    }
    return null;
  };

  return rec("", parts);
}

// ---------------------------------------------------------------------------
// Retention settings
// ---------------------------------------------------------------------------

// The agent clears its own transcripts on a timer. Whether that is running,
// and at what window, decides whether most of the directory is a steady state
// or a genuine leak — so it is read before anything is called reclaimable.
const CLEANUP_DEFAULT_DAYS = 30;

function readSettings() {
  const out = { files: [], cleanupPeriodDays: null, source: null, unparseable: [] };
  for (const f of ["settings.json", "settings.local.json"]) {
    const p = join(agentDir, f);
    if (!existsSync(p)) continue;
    out.files.push(f);
    try {
      const json = JSON.parse(readFileSync(p, "utf8"));
      if (typeof json.cleanupPeriodDays === "number") {
        out.cleanupPeriodDays = json.cleanupPeriodDays;
        out.source = f;
      }
    } catch (err) {
      out.unparseable.push(`${f} — does not parse (${err.message})`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

// "cleared" = the agent removes this on its own once it ages past the window.
// Space here is a rolling working set, not a leak, and deleting it early buys
// a one-off saving that refills.
//
// "kept" = nothing ever removes this. Growth here is permanent.
//
// "essential" = removing it destroys state the owner cannot regenerate.
const AREAS = [
  ["projects", "cleared", "Session transcripts, subagent and tool output, per-project memory"],
  ["file-history", "cleared", "Edit snapshots behind rewind and checkpoint restore"],
  ["plugins", "kept", "Installed plugins, marketplace clones and their caches"],
  ["cache", "kept", "General agent cache"],
  ["shell-snapshots", "kept", "Captured shell environments"],
  ["backups", "kept", "Configuration backups"],
  ["sessions", "kept", "Session bookkeeping"],
  ["plans", "kept", "Saved plans"],
  ["state", "kept", "Application state"],
  ["ide", "kept", "IDE integration state"],
  ["todos", "kept", "Task lists"],
  ["statsig", "kept", "Feature flag cache"],
  ["debug", "kept", "Diagnostic logs"],
];

const report = {
  agentDir,
  total: null,
  settings: readSettings(),
  areas: [],
  projects: [],
  memory: [],
  largestTranscripts: [],
  notes: [],
};

const total = measure(agentDir);
report.total = { bytes: total.bytes, files: total.files };

// Measure known areas. Each inode is counted once globally, so areas never
// double-bill and the parts sum to no more than the whole.
const accounted = new Set();
for (const [name, klass, what] of AREAS) {
  const p = join(agentDir, name);
  if (!existsSync(p)) continue;
  accounted.add(name);
  const m = measure(p);
  if (m.files === 0 && m.bytes === 0) continue;
  report.areas.push({
    name,
    class: klass,
    what,
    bytes: m.bytes,
    files: m.files,
    oldestDays: ageDays(m.oldest),
    newestDays: ageDays(m.newest),
  });
}

// Anything present but unknown to this script is reported rather than ignored:
// an agent directory gains new subdirectories between releases, and silently
// dropping them would understate the total.
let otherBytes = 0;
let otherFiles = 0;
const otherNames = [];
for (const e of readdirSync(agentDir)) {
  if (accounted.has(e)) continue;
  const m = measure(join(agentDir, e));
  if (m.bytes === 0 && m.files === 0) continue;
  otherBytes += m.bytes;
  otherFiles += m.files;
  otherNames.push(e);
}
if (otherFiles > 0) {
  report.areas.push({
    name: "(other top-level entries)",
    class: "unclassified",
    what: otherNames.sort().join(", "),
    bytes: otherBytes,
    files: otherFiles,
    oldestDays: null,
    newestDays: null,
  });
}

report.areas.sort((a, b) => b.bytes - a.bytes);

// Per-project breakdown, with the existence of the real directory resolved.
const projectsRoot = join(agentDir, "projects");
if (existsSync(projectsRoot)) {
  for (const name of readdirSync(projectsRoot)) {
    const p = join(projectsRoot, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;

    const m = measure(p);
    const resolved = decodeProjectDir(name);
    const memDir = join(p, "memory");
    const hasMemory = existsSync(memDir);

    report.projects.push({
      name,
      resolved,
      exists: Boolean(resolved),
      bytes: m.bytes,
      files: m.files,
      lastUsedDays: ageDays(m.newest),
      hasMemory,
      memoryBytes: hasMemory ? measure(memDir).bytes : 0,
    });

    if (hasMemory) {
      report.memory.push({
        project: name,
        exists: Boolean(resolved),
        path: memDir,
      });
    }
  }
  report.projects.sort((a, b) => b.bytes - a.bytes);

  // Largest individual transcripts: a single oversized session is worth
  // seeing, because it usually points at one runaway task rather than
  // ordinary accumulated use.
  const transcripts = [];
  const collect = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) collect(full);
      else if (e.name.endsWith(".jsonl")) {
        try {
          const s = statSync(full);
          transcripts.push({
            path: full.slice(agentDir.length + 1),
            bytes: s.blocks * 512,
            ageDays: ageDays(s.mtimeMs),
          });
        } catch {
          /* vanished */
        }
      }
    }
  };
  collect(projectsRoot);
  transcripts.sort((a, b) => b.bytes - a.bytes);
  report.largestTranscripts = transcripts.slice(0, 10);

  // The age of the oldest transcript against the retention window is the
  // single most informative number here: if nothing survives past the window,
  // cleanup is demonstrably running and the bulk is a steady state.
  const oldest = transcripts.reduce((a, t) => Math.max(a, t.ageDays ?? 0), 0);
  const window = report.settings.cleanupPeriodDays ?? CLEANUP_DEFAULT_DAYS;
  report.retention = {
    window,
    configured: report.settings.cleanupPeriodDays !== null,
    source: report.settings.source,
    oldestTranscriptDays: transcripts.length ? oldest : null,
    consistentWithWindow: transcripts.length ? oldest <= window : null,
    transcriptCount: transcripts.length,
  };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

if (wantJson) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const out = [];
const section = (t) => out.push(`\n## ${t}`);

out.push(`# Agent directory audit`);
out.push(``);
out.push(`Directory: ${report.agentDir}`);
out.push(`Total: ${fmt(report.total.bytes)} across ${report.total.files} files`);

section("Retention");
if (report.retention) {
  const r = report.retention;
  out.push(
    r.configured
      ? `cleanupPeriodDays: ${r.window} (set in ${r.source})`
      : `cleanupPeriodDays: not set — the agent's default of ${CLEANUP_DEFAULT_DAYS} days applies`
  );
  if (r.transcriptCount === 0) {
    out.push(`No transcripts found.`);
  } else {
    out.push(`Transcripts: ${r.transcriptCount}, oldest ${r.oldestTranscriptDays} days.`);
    out.push(
      r.consistentWithWindow
        ? `Nothing survives past the ${r.window}-day window, which is what automatic cleanup running looks like. Space under a "cleared" heading below is a rolling working set, not a leak.`
        : `Transcripts older than the ${r.window}-day window are present. Cleanup may not be running — worth investigating before anything is deleted by hand.`
    );
  }
} else {
  out.push(`No projects directory; retention not assessed.`);
}
for (const u of report.settings.unparseable) out.push(`! ${u}`);

section("Where the space is");
out.push(`${"SIZE".padStart(7)}  ${"CLASS".padEnd(12)} AREA`);
for (const a of report.areas) {
  out.push(`${fmt(a.bytes).padStart(7)}  ${a.class.padEnd(12)} ${a.name} — ${a.what}`);
}
out.push(``);
out.push(`cleared = the agent removes this on its own past the retention window`);
out.push(`kept    = nothing removes this; growth here is permanent`);

section("Per-project state");
if (report.projects.length === 0) {
  out.push(`None.`);
} else {
  out.push(`${"SIZE".padStart(7)}  ${"PROJECT DIR".padEnd(8)} ${"LAST USED".padStart(9)}  NAME`);
  for (const p of report.projects) {
    const flag = p.exists ? "exists" : "GONE";
    const used = p.lastUsedDays === null ? "?" : `${p.lastUsedDays}d`;
    const mem = p.hasMemory ? "  [has memory/]" : "";
    out.push(`${fmt(p.bytes).padStart(7)}  ${flag.padEnd(8)} ${used.padStart(9)}  ${p.name}${mem}`);
  }
  const gone = report.projects.filter((p) => !p.exists);
  const goneBytes = gone.reduce((a, p) => a + p.bytes, 0);
  out.push(``);
  out.push(
    `${gone.length} project${gone.length === 1 ? "" : "s"} no longer on disk, holding ${fmt(goneBytes)}.`
  );
  const goneWithMemory = gone.filter((p) => p.hasMemory);
  if (goneWithMemory.length) {
    out.push(
      `${goneWithMemory.length} of those still hold a memory/ directory — written notes, not regenerable. Read before discarding.`
    );
  }
}

if (report.largestTranscripts.length) {
  section("Largest transcripts");
  for (const t of report.largestTranscripts) {
    out.push(`${fmt(t.bytes).padStart(7)}  ${String(t.ageDays).padStart(3)}d  ${t.path}`);
  }
}

section("Still yours to judge");
out.push(`- Which recent sessions the owner still wants to resume. Deleting a`);
out.push(`  transcript ends --resume and --continue for that session.`);
out.push(`- Whether a project directory that is GONE was deleted deliberately or`);
out.push(`  is merely moved, renamed, unmounted or on another machine.`);
out.push(`- Whether any memory/ directory holds notes worth keeping before the`);
out.push(`  project state around it is purged.`);
out.push(`- Whether installed plugins under plugins/ are still in use. Size alone`);
out.push(`  does not say that, and this script does not guess.`);

console.log(out.join("\n"));
