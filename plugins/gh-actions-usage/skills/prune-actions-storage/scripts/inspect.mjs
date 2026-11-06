#!/usr/bin/env node
//
// SPDX-FileCopyrightText: 2026 Aleksandr Linde
// SPDX-License-Identifier: Apache-2.0
//
// Measures what a repository's GitHub Actions artifacts are costing, split by
// workflow, and which runs hold the oldest and the largest of them. Read-only
// and deletes nothing.
//
//   node inspect.mjs <owner/repo> [--keep <n>] [--json]
//
// --keep (default 5) sets how many of each workflow's most recent runs count
// as the active set for reporting purposes; everything older is reported
// separately so a reader can see what pruning to that number would reach
// without the script doing it.
//
// Requires the gh CLI, authenticated, with access to the repository.

import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const wantJson = args.includes("--json");
const keepFlag = args.indexOf("--keep");
const keep = keepFlag !== -1 ? Number(args[keepFlag + 1]) : 5;
const keepValueIndex = keepFlag !== -1 ? keepFlag + 1 : -1;
const repo = args.find((a, i) => !a.startsWith("--") && i !== keepValueIndex);

if (!repo || !/^[^/\s]+\/[^/\s]+$/.test(repo)) {
  console.error("usage: node inspect.mjs <owner/repo> [--keep <n>] [--json]");
  process.exit(2);
}
if (!Number.isInteger(keep) || keep < 0) {
  console.error("--keep must be a non-negative integer");
  process.exit(2);
}

function listAll(path, key) {
  // --slurp wraps every page's JSON body in an array instead of printing them
  // back to back, which is unsafe to split on: a string value can itself
  // contain "}\n{".
  const out = execFileSync("gh", ["api", path, "--paginate", "--slurp"], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  });
  const pages = JSON.parse(out);
  const items = [];
  for (const page of pages) items.push(...(page[key] ?? []));
  return items;
}

let runs, artifacts;
try {
  runs = listAll(`repos/${repo}/actions/runs?per_page=100`, "workflow_runs");
  artifacts = listAll(`repos/${repo}/actions/artifacts?per_page=100`, "artifacts");
} catch (error) {
  console.error(`could not read Actions data for ${repo}: ${error.message}`);
  console.error("confirm the repo exists, gh is authenticated, and you have access.");
  process.exit(1);
}

// --- group artifacts by their run, runs by their workflow ------------------

const artifactsByRun = new Map();
for (const art of artifacts) {
  const list = artifactsByRun.get(art.workflow_run?.id) ?? [];
  list.push(art);
  artifactsByRun.set(art.workflow_run?.id, list);
}

const runsByWorkflow = new Map();
for (const run of runs) {
  const list = runsByWorkflow.get(run.workflow_id) ?? [];
  list.push(run);
  runsByWorkflow.set(run.workflow_id, list);
}

const workflowNames = new Map();
for (const run of runs) workflowNames.set(run.workflow_id, run.name);

let totalBytes = 0;
let expiredBytes = 0;
const workflowReport = [];

for (const [workflowId, workflowRuns] of runsByWorkflow) {
  workflowRuns.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  let workflowBytes = 0;
  let prunableBytes = 0;
  let prunableRuns = 0;
  let staleRunIds = [];

  workflowRuns.forEach((run, i) => {
    const runArtifacts = artifactsByRun.get(run.id) ?? [];
    const runBytes = runArtifacts.reduce((sum, a) => sum + (a.size_in_bytes ?? 0), 0);
    workflowBytes += runBytes;
    totalBytes += runBytes;
    for (const a of runArtifacts) if (a.expired) expiredBytes += a.size_in_bytes ?? 0;

    if (i >= keep && runBytes > 0) {
      prunableBytes += runBytes;
      prunableRuns += 1;
    }
    if (i >= keep) staleRunIds.push(run.id);
  });

  workflowReport.push({
    workflowId,
    name: workflowNames.get(workflowId) ?? `(workflow ${workflowId})`,
    runCount: workflowRuns.length,
    bytes: workflowBytes,
    prunableRuns,
    prunableBytes,
    staleRunCount: staleRunIds.length,
    staleRunIds,
    oldestRun: workflowRuns.at(-1)?.created_at ?? null,
    newestRun: workflowRuns[0]?.created_at ?? null,
  });
}

workflowReport.sort((a, b) => b.bytes - a.bytes);

const largestArtifacts = [...artifacts]
  .sort((a, b) => (b.size_in_bytes ?? 0) - (a.size_in_bytes ?? 0))
  .slice(0, 10)
  .map((a) => ({
    name: a.name,
    bytes: a.size_in_bytes,
    expired: a.expired,
    createdAt: a.created_at,
    workflowRunId: a.workflow_run?.id ?? null,
  }));

const totalStaleRuns = workflowReport.reduce((sum, w) => sum + w.staleRunCount, 0);

const result = {
  repo,
  keep,
  totalRuns: runs.length,
  totalArtifactBytes: totalBytes,
  expiredArtifactBytes: expiredBytes,
  totalStaleRuns,
  workflows: workflowReport,
  largestArtifacts,
};

if (wantJson) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

const human = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(1)} ${units[i]}`;
};

console.log(`${repo}: ${human(totalBytes)} across ${runs.length} runs, ${artifacts.length} artifacts`);
if (expiredBytes > 0) {
  console.log(`  ${human(expiredBytes)} already past GitHub's own retention and expired`);
}
console.log("");
console.log(`By workflow (keeping the ${keep} most recent runs as the active set):`);
for (const w of workflowReport) {
  console.log(
    `  ${w.name}: ${human(w.bytes)} total, ${w.runCount} runs` +
      (w.prunableRuns > 0 ? ` — ${human(w.prunableBytes)} in ${w.prunableRuns} run(s) older than the kept ${keep}` : ""),
  );
}
if (totalStaleRuns > 0) {
  console.log("");
  console.log(
    `Run records older than the kept ${keep} per workflow: ${totalStaleRuns} — tidies the Actions tab ` +
      `if removed, but frees no storage on its own (most hold no artifacts already). ` +
      `See each workflow's staleRunIds in --json, or ask to delete run records with reclaim.mjs --delete-runs.`,
  );
}
if (largestArtifacts.length > 0) {
  console.log("");
  console.log("Largest individual artifacts:");
  for (const a of largestArtifacts) {
    console.log(`  ${human(a.bytes)}  ${a.name}  (run ${a.workflowRunId}, ${a.createdAt}${a.expired ? ", expired" : ""})`);
  }
}
