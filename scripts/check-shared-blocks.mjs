#!/usr/bin/env node
//
// SPDX-FileCopyrightText: 2026 Aleksandr Linde
// SPDX-License-Identifier: Apache-2.0
//
// Guards the wording every skill in this repository is supposed to share.
//
//   node scripts/check-shared-blocks.mjs
//
// Skills cannot import each other: each plugin installs standalone, so shared
// guidance exists as a copy per skill. That is a deliberate trade — a pointer
// to another file costs a tool call mid-task and can be skipped, while inline
// prose cannot — but copies drift, and drift here is silent. One skill had
// already lost the sentence telling an agent what to do when the ask-the-user
// tool is missing, which is a behaviour change nobody would spot by reading.
//
// So the duplication stays and this check makes it honest: every skill must
// carry each shared block, worded identically. Add a block below when a
// paragraph becomes something all skills must say the same way.
//
// Compares on normalised text — whitespace and line wrapping collapsed — so
// rewrapping a paragraph to fit a longer sentence is not a failure, while
// changing a word is.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginsDir = join(repo, "plugins");

// Each block: the canonical text, and how to find it in a file. `startsWith`
// anchors the search so a block can be located before it is compared, which
// is what lets the checker say "drifted" rather than merely "missing".
const BLOCKS = [
  {
    name: "ask-the-user tool protocol",
    startsWith: "Use the AskUserQuestion tool",
    endsWith: "plain text, numbered.",
    canonical: `Use the AskUserQuestion tool when it is available: at most four
      questions per call, two to four options each, the recommended option
      first and labelled "(Recommended)", and a description on every option
      saying what choosing it means in practice. Without it, ask in plain
      text, numbered.`,
  },
];

const norm = (s) => s.replace(/\s+/g, " ").trim();

function findSkills() {
  if (!existsSync(pluginsDir)) return [];
  const out = [];
  for (const plugin of readdirSync(pluginsDir)) {
    const skillsDir = join(pluginsDir, plugin, "skills");
    if (!existsSync(skillsDir)) continue;
    for (const skill of readdirSync(skillsDir)) {
      const f = join(skillsDir, skill, "SKILL.md");
      if (existsSync(f)) out.push(f);
    }
  }
  return out.sort();
}

// Pulls the block out of a file by its anchors rather than by line numbers,
// so it keeps working when the surrounding prose is edited.
function extract(text, block) {
  const start = text.indexOf(block.startsWith);
  if (start === -1) return null;
  const end = text.indexOf(block.endsWith, start);
  if (end === -1) return null;
  return text.slice(start, end + block.endsWith.length);
}

const skills = findSkills();
if (skills.length === 0) {
  console.error("no skills found under plugins/*/skills/*/SKILL.md");
  process.exit(2);
}

const failures = [];

for (const block of BLOCKS) {
  const want = norm(block.canonical);
  for (const file of skills) {
    const rel = relative(repo, file);
    const text = readFileSync(file, "utf8");
    const found = extract(text, block);

    if (found === null) {
      failures.push({
        file: rel,
        block: block.name,
        problem: "missing",
        detail: `no text matching "${block.startsWith}" … "${block.endsWith}"`,
      });
      continue;
    }

    if (norm(found) !== want) {
      failures.push({
        file: rel,
        block: block.name,
        problem: "drifted",
        detail: `found: ${norm(found)}`,
      });
    }
  }
}

if (failures.length === 0) {
  const n = skills.length;
  const b = BLOCKS.length;
  console.log(`✔ ${b} shared block(s) identical across ${n} skill(s)`);
  process.exit(0);
}

console.error(`✘ ${failures.length} shared-block problem(s):\n`);
for (const f of failures) {
  console.error(`  ${f.file}`);
  console.error(`    block:   ${f.block}`);
  console.error(`    problem: ${f.problem}`);
  console.error(`    ${f.detail}\n`);
}
console.error(`Canonical wording lives in scripts/check-shared-blocks.mjs.`);
console.error(`Make the copies match it, or update it there if the wording`);
console.error(`should change everywhere.`);
process.exit(1);
