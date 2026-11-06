#!/usr/bin/env node
//
// SPDX-FileCopyrightText: 2026 Aleksandr Linde
// SPDX-License-Identifier: Apache-2.0
//
// Deletes artifacts, and optionally the runs that held them, for a run-id
// list the owner has already approved. Never decides which runs qualify —
// that is inspect.mjs's job, read by a person first.
//
//   node reclaim.mjs <owner/repo> --run-ids 123,456,789 [--delete-runs] [--apply]
//
// Without --apply this only prints what it would delete. --apply is required
// to actually call the delete endpoints, so a run without it is always a dry
// run even if the owner forgets the flag.

import { execFileSync } from "node:child_process";

// GitHub enforces a secondary (burst) rate limit well below the primary
// 5,000/hour budget when a client fires many requests back to back. A
// small fixed delay between calls, plus a backoff-and-retry on 403/429,
// keeps a few-thousand-id run inside that budget instead of erroring out
// partway through — which otherwise produces a dry run too incomplete to
// trust before a real delete.
const REQUEST_DELAY_MS = 300;
const MAX_RETRIES = 5;

function sleep(ms) {
  execFileSync("sleep", [String(ms / 1000)]);
}

function isRateLimitError(error) {
  const msg = String(error.message ?? "");
  return msg.includes("API rate limit exceeded") || msg.includes("HTTP 403") || msg.includes("HTTP 429");
}

function withRetry(fn) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return fn();
    } catch (error) {
      if (attempt === MAX_RETRIES || !isRateLimitError(error)) throw error;
      const backoffMs = 2000 * 2 ** attempt;
      console.error(`  rate limited — waiting ${backoffMs / 1000}s before retry ${attempt + 1}/${MAX_RETRIES}`);
      sleep(backoffMs);
    } finally {
      sleep(REQUEST_DELAY_MS);
    }
  }
}

const args = process.argv.slice(2);
const repo = args[0];
const idsFlag = args.indexOf("--run-ids");
const deleteRuns = args.includes("--delete-runs");
const apply = args.includes("--apply");

if (!repo || !/^[^/\s]+\/[^/\s]+$/.test(repo) || idsFlag === -1 || !args[idsFlag + 1]) {
  console.error("usage: node reclaim.mjs <owner/repo> --run-ids <id,id,...> [--delete-runs] [--apply]");
  process.exit(2);
}

const runIds = args[idsFlag + 1]
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (runIds.some((id) => !/^\d+$/.test(id))) {
  console.error("--run-ids must be a comma-separated list of numeric run ids");
  process.exit(2);
}

console.log(`${apply ? "APPLYING" : "DRY RUN (pass --apply to actually delete)"}`);
console.log(`repo: ${repo}`);
console.log(`runs: ${runIds.join(", ")}`);
console.log(`also deleting the run records: ${deleteRuns ? "yes" : "no, artifacts only"}`);
console.log("");

function ghJson(path) {
  return withRetry(() => {
    const out = execFileSync("gh", ["api", path], { encoding: "utf8" });
    return JSON.parse(out);
  });
}

function ghDelete(path) {
  withRetry(() => {
    execFileSync("gh", ["api", "-X", "DELETE", path], { encoding: "utf8" });
  });
}

let deletedArtifactBytes = 0;
let deletedArtifactCount = 0;
let deletedRunCount = 0;
let errorCount = 0;

for (const runId of runIds) {
  let artifacts;
  try {
    artifacts = ghJson(`repos/${repo}/actions/runs/${runId}/artifacts?per_page=100`).artifacts ?? [];
  } catch (error) {
    console.error(`run ${runId}: could not list artifacts (${error.message})`);
    errorCount += 1;
    continue;
  }

  for (const art of artifacts) {
    console.log(`  artifact ${art.id} "${art.name}" (${art.size_in_bytes} bytes) — run ${runId}`);
    if (apply) {
      try {
        ghDelete(`repos/${repo}/actions/artifacts/${art.id}`);
        deletedArtifactBytes += art.size_in_bytes ?? 0;
        deletedArtifactCount += 1;
      } catch (error) {
        console.error(`    failed to delete artifact ${art.id}: ${error.message}`);
        errorCount += 1;
      }
    }
  }

  if (deleteRuns) {
    console.log(`  run ${runId}`);
    if (apply) {
      try {
        ghDelete(`repos/${repo}/actions/runs/${runId}`);
        deletedRunCount += 1;
      } catch (error) {
        console.error(`    failed to delete run ${runId}: ${error.message}`);
        errorCount += 1;
      }
    }
  }
}

console.log("");
if (apply) {
  console.log(`Deleted ${deletedArtifactCount} artifact(s)${deleteRuns ? ` and ${deletedRunCount} run(s)` : ""}.`);
  console.log(`Re-run inspect.mjs to see the measured total — this count is not it.`);
} else {
  console.log("Nothing deleted. Re-run with --apply once this list is approved.");
}
if (errorCount > 0) {
  console.error(`${errorCount} operation(s) failed — see above.`);
  process.exit(1);
}
