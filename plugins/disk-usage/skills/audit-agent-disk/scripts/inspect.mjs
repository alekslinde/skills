#!/usr/bin/env node
//
// SPDX-FileCopyrightText: 2026 Aleksandr Linde
// SPDX-License-Identifier: Apache-2.0
//
// The mechanical half of the agent directory audit.
//
//   node inspect.mjs [--dir <agent-dir>] [--project <repo-path>] [--json]
//
// Measures what an agent directory holds, splits it into what the agent
// already clears on its own and what it never will, and resolves which
// per-project state belongs to a project that no longer exists.
//
// With --project it narrows to the state held for one repository, reporting
// that project's composition, how its size is spread across the retention
// window, and whether any single session is outsized. The whole-directory
// questions — is cleanup running, which projects are orphaned — do not apply
// to one project, so that view answers different questions rather than
// filtering the same ones.
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

const projFlag = args.indexOf("--project");
const projectArg = projFlag !== -1 ? args[projFlag + 1] : null;

if (projFlag !== -1 && !projectArg) {
  console.error("usage: node inspect.mjs --project <repo-path>");
  process.exit(2);
}

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

// Encoding a real path forward to its state-directory name is lossless: every
// "/" becomes "-" and nothing has to be guessed back. That is why --project
// takes the repository path rather than the encoded name — the ambiguity that
// makes decodeProjectDir necessary only exists in the other direction.
function encodeProjectDir(absPath) {
  return absPath.replace(/\//g, "-");
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

// ---------------------------------------------------------------------------
// Single-project audit
// ---------------------------------------------------------------------------

if (projectArg) {
  const repoPath = resolve(projectArg);
  const encoded = encodeProjectDir(repoPath);
  const stateDir = join(agentDir, "projects", encoded);

  if (!existsSync(stateDir)) {
    // Distinguish "no agent has ever worked here" from "that path is wrong",
    // because the fix differs and the second is the common mistake.
    const hint = existsSync(repoPath)
      ? "That directory exists, but the agent holds no state for it — no sessions have run there, or they ran from a different path (a symlink, or another spelling of the same directory)."
      : "That directory does not exist either; check the path.";
    console.error(`no agent state for: ${repoPath}`);
    console.error(`  looked for: ${stateDir}`);
    console.error(`  ${hint}`);
    process.exit(1);
  }

  const settings = readSettings();
  const windowDays = settings.cleanupPeriodDays ?? CLEANUP_DEFAULT_DAYS;

  const whole = measure(agentDir);
  // Reset inode tracking: the project is measured as its own total here, not
  // as a remainder of the directory-wide walk that just ran.
  seenInodes.clear();
  const proj = measure(stateDir);

  // Composition. Each part is measured against a fresh inode set so the parts
  // are comparable to each other rather than order-dependent.
  const part = (p) => {
    seenInodes.clear();
    return existsSync(p) ? measure(p) : { bytes: 0, files: 0, newest: 0, oldest: 0 };
  };

  let topBytes = 0;
  let topFiles = 0;
  const sessions = [];
  for (const e of readdirSync(stateDir, { withFileTypes: true })) {
    if (!e.isFile() || !e.name.endsWith(".jsonl")) continue;
    const s = statSync(join(stateDir, e.name));
    topBytes += s.blocks * 512;
    topFiles += 1;
    sessions.push({ name: e.name, bytes: s.blocks * 512, ageDays: ageDays(s.mtimeMs) });
  }
  sessions.sort((a, b) => b.bytes - a.bytes);

  const subBytes = { bytes: 0, files: 0 };
  const toolBytes = { bytes: 0, files: 0 };
  const sweep = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "subagents" || e.name === "tool-results") {
          seenInodes.clear();
          const m = measure(full);
          const t = e.name === "subagents" ? subBytes : toolBytes;
          t.bytes += m.bytes;
          t.files += m.files;
        } else if (e.name !== "memory") {
          sweep(full);
        }
      }
    }
  };
  sweep(stateDir);

  const memDir = join(stateDir, "memory");
  const mem = part(memDir);
  const memFiles = existsSync(memDir)
    ? readdirSync(memDir, { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => {
          const s = statSync(join(memDir, e.name));
          return { name: e.name, bytes: s.size, ageDays: ageDays(s.mtimeMs) };
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  // Size against the retention window, in quarters of it, so the buckets stay
  // meaningful whatever window is configured.
  const q = Math.max(1, Math.ceil(windowDays / 4));
  const buckets = [];
  for (let i = 0; i < 4; i++) {
    const lo = i * q;
    const hi = i === 3 ? Infinity : (i + 1) * q - 1;
    buckets.push({
      label: i === 3 ? `${lo}d+` : `${lo}-${hi}d`,
      bytes: 0,
      files: 0,
    });
  }
  for (const s of sessions) {
    const i = Math.min(3, Math.floor((s.ageDays ?? 0) / q));
    buckets[i].bytes += s.bytes;
    buckets[i].files += 1;
  }

  // An outsized session is one that dwarfs the project's *other* sessions,
  // not one crossing a fixed share of the total: a project with three
  // sessions gives each a third of it, while a project with eighty makes 10%
  // extraordinary. Comparing against the median catches the runaway task at
  // either scale, and needs enough sessions for a median to mean anything.
  const biggest = sessions[0] ?? null;
  const outsizedShare = biggest && proj.bytes ? biggest.bytes / proj.bytes : 0;
  const median = sessions.length
    ? sessions[Math.floor(sessions.length / 2)].bytes
    : 0;
  const ratio = biggest && median ? biggest.bytes / median : 0;
  const isOutsized =
    biggest && sessions.length >= 5 && ratio >= 8 && outsizedShare >= 0.05;

  const pReport = {
    mode: "project",
    agentDir,
    repoPath,
    repoExists: existsSync(repoPath),
    stateDir,
    total: { bytes: proj.bytes, files: proj.files },
    shareOfAgentDir: whole.bytes ? proj.bytes / whole.bytes : 0,
    agentDirBytes: whole.bytes,
    lastUsedDays: ageDays(proj.newest),
    oldestDays: ageDays(proj.oldest),
    window: windowDays,
    windowConfigured: settings.cleanupPeriodDays !== null,
    composition: {
      transcripts: { bytes: topBytes, files: topFiles },
      subagents: subBytes,
      toolResults: toolBytes,
      memory: { bytes: mem.bytes, files: mem.files },
    },
    buckets,
    largestSessions: sessions.slice(0, 5),
    outsized: isOutsized
      ? { ...biggest, share: outsizedShare, timesMedian: ratio }
      : null,
    memoryFiles: memFiles,
  };

  if (wantJson) {
    console.log(JSON.stringify(pReport, null, 2));
    process.exit(0);
  }

  const o = [];
  o.push(`# Project state audit`);
  o.push(``);
  o.push(`Project:   ${repoPath}${pReport.repoExists ? "" : "   [NO LONGER ON DISK]"}`);
  o.push(`State dir: ${stateDir}`);
  o.push(
    `Total:     ${fmt(proj.bytes)} across ${proj.files} files — ${(pReport.shareOfAgentDir * 100).toFixed(0)}% of the ${fmt(whole.bytes)} agent directory`
  );
  o.push(`Last used: ${pReport.lastUsedDays}d ago`);

  o.push(`\n## Composition`);
  const comp = [
    ["transcripts", pReport.composition.transcripts, "cleared"],
    ["subagents", pReport.composition.subagents, "cleared"],
    ["tool-results", pReport.composition.toolResults, "cleared"],
    ["memory", pReport.composition.memory, "ESSENTIAL"],
  ];
  for (const [name, m, klass] of comp) {
    o.push(
      `${fmt(m.bytes).padStart(8)}  ${String(m.files).padStart(4)} files  ${name.padEnd(13)} ${klass}`
    );
  }

  o.push(`\n## Spread across the ${windowDays}-day window`);
  if (pReport.windowConfigured) {
    o.push(`(cleanupPeriodDays set to ${windowDays})`);
  } else {
    o.push(`(cleanupPeriodDays not set — the agent's default of ${windowDays} days applies)`);
  }
  for (const b of buckets) {
    o.push(`${b.label.padEnd(8)} ${fmt(b.bytes).padStart(8)}  ${b.files} files`);
  }
  const ageing = buckets[3];
  if (ageing.files > 0) {
    o.push(``);
    o.push(`${fmt(ageing.bytes)} in ${ageing.files} file(s) is at the far end of the window and clears soon.`);
  }

  if (pReport.largestSessions.length) {
    o.push(`\n## Largest sessions`);
    for (const s of pReport.largestSessions) {
      o.push(`${fmt(s.bytes).padStart(8)}  ${String(s.ageDays).padStart(3)}d  ${s.name}`);
    }
  }

  if (pReport.outsized) {
    const x = pReport.outsized;
    o.push(``);
    o.push(
      `! One session holds ${fmt(x.bytes)} — ${(x.share * 100).toFixed(0)}% of this project's state, and ${x.timesMedian.toFixed(0)}x the median session.`
    );
    o.push(
      `  That usually means one runaway task rather than ordinary use. It clears`);
    o.push(
      `  with the window, so it is a cause worth knowing, not a cleanup target.`);
  }

  if (memFiles.length) {
    o.push(`\n## memory/ — essential, never a cleanup candidate`);
    for (const f of memFiles) {
      o.push(`${String(f.bytes).padStart(8)}B  ${String(f.ageDays).padStart(3)}d  ${f.name}`);
    }
  }

  o.push(`\n## Still yours to judge`);
  if (!pReport.repoExists) {
    o.push(`- The repository is not at this path. Deleted, or moved, renamed, on an`);
    o.push(`  unmounted volume, or another machine? Only the first makes this dead.`);
  }
  o.push(`- Which of these sessions you may still want to resume.`);
  o.push(`- Whether the memory/ notes above should be read out before anything else.`);

  console.log(o.join("\n"));
  process.exit(0);
}

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
