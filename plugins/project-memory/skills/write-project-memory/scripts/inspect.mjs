#!/usr/bin/env node
//
// SPDX-FileCopyrightText: 2026 Aleksandr Linde
// SPDX-License-Identifier: Apache-2.0
//
// The mechanical half of the project memory audit.
//
//   node inspect.mjs <repo-path>
//
// Collects what a script can read without judgement: the committed lockfile,
// the scripts that exist, the workspace layout, paths that look generated or
// vendored, the instruction files already present, and the scope vocabulary
// the commit history already uses.
//
// It reports evidence, never conclusions. Everything needing judgement — is
// this convention deliberate, is that path off limits on purpose, which way
// is the codebase migrating — is listed at the end as "still yours" and is
// covered in references/audit.md.
//
// Deliberately dependency-free and read-only: it runs in a repo it knows
// nothing about, and an audit tool that mutates what it inspects is not one
// you would run twice.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";

const [, , repoArg] = process.argv;

if (!repoArg) {
  console.error("usage: node inspect.mjs <repo-path>");
  process.exit(2);
}

const repo = repoArg;

if (!existsSync(repo)) {
  console.error(`no such directory: ${repo}`);
  process.exit(2);
}

const read = (p) => readFileSync(join(repo, p), "utf8");
const has = (p) => existsSync(join(repo, p));

// Distinguishes "absent" from "present but unparseable": a manifest that does
// not parse is a finding, not a missing file.
const unparseable = [];
const readJson = (p) => {
  if (!existsSync(join(repo, p))) return null;
  try {
    return JSON.parse(read(p));
  } catch (err) {
    unparseable.push(`${p} — does not parse (${err.message})`);
    return null;
  }
};

const git = (...args) => {
  try {
    return execFileSync("git", ["-C", repo, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
};

const out = [];
const section = (title) => out.push(`\n## ${title}`);
const line = (s) => out.push(s);
const bullet = (s) => out.push(`  - ${s}`);
const none = () => out.push("  (none found)");

// Directories never worth walking into.
const SKIP_DIRS = new Set([
  ".git", "node_modules", ".next", ".nuxt", "dist", "build", "out",
  "coverage", ".turbo", ".cache", "vendor", "target", ".venv", "venv",
  "__pycache__", ".pytest_cache", ".gradle", "Pods", ".svelte-kit",
]);

function walk(dir, depth, maxDepth, acc = []) {
  if (depth > maxDepth) return acc;
  let entries;
  try {
    entries = readdirSync(join(repo, dir || "."), { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const rel = dir ? join(dir, e.name) : e.name;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      acc.push({ path: rel, dir: true });
      walk(rel, depth + 1, maxDepth, acc);
    } else {
      acc.push({ path: rel, dir: false });
    }
  }
  return acc;
}

line(`# Project memory audit: ${repo}`);
line("");
line("Evidence only. Conclusions are yours — see references/audit.md.");

// ---------------------------------------------------------------- manifests

section("What this project is");

const pkg = readJson("package.json");
const manifests = [
  ["package.json", "Node / JavaScript"],
  ["deno.json", "Deno"],
  ["pyproject.toml", "Python"],
  ["requirements.txt", "Python"],
  ["Cargo.toml", "Rust"],
  ["go.mod", "Go"],
  ["Gemfile", "Ruby"],
  ["composer.json", "PHP"],
  ["pubspec.yaml", "Dart / Flutter"],
  ["build.gradle", "JVM (Gradle)"],
  ["build.gradle.kts", "JVM (Gradle)"],
  ["pom.xml", "JVM (Maven)"],
  ["Package.swift", "Swift"],
  ["*.csproj", ".NET"],
];

let foundManifest = false;
for (const [file, label] of manifests) {
  if (file.includes("*")) continue;
  if (has(file)) {
    bullet(`${file} — ${label}`);
    foundManifest = true;
  }
}
if (!foundManifest) none();

for (const u of unparseable) bullet(`WARNING: ${u}`);

if (pkg) {
  if (pkg.name) bullet(`name: ${pkg.name}`);
  if (pkg.type) bullet(`module type: ${pkg.type}`);
  if (pkg.engines) bullet(`engines: ${JSON.stringify(pkg.engines)}`);
  if (pkg.private) bullet("private: true (not published)");
}

// Frameworks, by dependency rather than by config file.
if (pkg) {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const names = Object.keys(deps);
  const known = [
    ["next", "Next.js"], ["astro", "Astro"], ["nuxt", "Nuxt"],
    ["expo", "Expo"], ["react-native", "React Native"],
    ["@remix-run/react", "Remix"], ["@sveltejs/kit", "SvelteKit"],
    ["vue", "Vue"], ["svelte", "Svelte"], ["solid-js", "Solid"],
    ["react", "React"], ["@angular/core", "Angular"],
    ["electron", "Electron"], ["vite", "Vite"], ["typescript", "TypeScript"],
    ["tailwindcss", "Tailwind"], ["nativewind", "NativeWind"],
    ["@tamagui/core", "Tamagui"], ["styled-components", "styled-components"],
    ["zustand", "Zustand"], ["jotai", "Jotai"], ["redux", "Redux"],
    ["@tanstack/react-query", "TanStack Query"], ["swr", "SWR"],
    ["trpc", "tRPC"], ["@trpc/server", "tRPC"], ["prisma", "Prisma"],
    ["drizzle-orm", "Drizzle"], ["vitest", "Vitest"], ["jest", "Jest"],
    ["playwright", "Playwright"], ["@playwright/test", "Playwright"],
    ["cypress", "Cypress"], ["eslint", "ESLint"], ["prettier", "Prettier"],
    ["biome", "Biome"], ["@biomejs/biome", "Biome"],
  ];
  const hits = known.filter(([d]) => names.includes(d)).map(([, l]) => l);
  if (hits.length) bullet(`dependencies suggest: ${[...new Set(hits)].join(", ")}`);
}

// ------------------------------------------------------------ package mgr

section("Package manager");

const lockfiles = [
  ["pnpm-lock.yaml", "pnpm"],
  ["package-lock.json", "npm"],
  ["yarn.lock", "yarn"],
  ["bun.lockb", "bun"],
  ["bun.lock", "bun"],
];

const foundLocks = lockfiles.filter(([f]) => has(f));

const isGitRepo = has(".git") || git("rev-parse", "--git-dir") !== "";

if (foundLocks.length === 0) {
  if (pkg && !isGitRepo) {
    bullet(
      "no lockfile present, and this is not a git repository — the lockfile " +
        "may simply be untracked here rather than deliberately absent",
    );
  } else if (pkg) {
    bullet("no lockfile committed — ask which manager is used, and why none is tracked");
  } else {
    bullet("no JavaScript lockfile (may not be a JavaScript project)");
  }
} else if (foundLocks.length === 1) {
  bullet(`${foundLocks[0][0]} committed → ${foundLocks[0][1]}`);
} else {
  bullet(
    `CONFLICT: ${foundLocks.length} lockfiles committed — ` +
      foundLocks.map(([f, m]) => `${f} (${m})`).join(", "),
  );
  bullet("ask which is real and whether the others should be removed");
}

if (pkg?.packageManager) {
  const declared = pkg.packageManager.split("@")[0];
  const fromLock = foundLocks[0]?.[1];
  if (fromLock && declared !== fromLock) {
    bullet(
      `CONFLICT: packageManager says "${pkg.packageManager}" but the ` +
        `committed lockfile says ${fromLock} — the lockfile wins`,
    );
  } else {
    bullet(`packageManager field: ${pkg.packageManager}`);
  }
}

// ------------------------------------------------------------- workspaces

section("Workspace layout");

let isMonorepo = false;
if (pkg?.workspaces) {
  isMonorepo = true;
  const ws = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces.packages;
  bullet(`package.json workspaces: ${JSON.stringify(ws)}`);
}
if (has("pnpm-workspace.yaml")) {
  isMonorepo = true;
  const body = read("pnpm-workspace.yaml");
  const globs = body.match(/^\s*-\s*["']?([^"'\n]+)["']?/gm) || [];
  bullet(`pnpm-workspace.yaml: ${globs.map((g) => g.replace(/^\s*-\s*/, "").trim()).join(", ")}`);
}
if (has("turbo.json")) bullet("turbo.json present");
if (has("nx.json")) bullet("nx.json present");
if (has("lerna.json")) bullet("lerna.json present");
if (has("Cargo.toml")) {
  const body = read("Cargo.toml");
  if (/^\s*\[workspace\]/m.test(body)) {
    isMonorepo = true;
    bullet("Cargo.toml declares a workspace");
  }
}
if (has("go.work")) {
  isMonorepo = true;
  bullet("go.work present");
}
if (!isMonorepo) bullet("single package (no workspace config found)");

// Where packages actually live.
if (isMonorepo) {
  for (const parent of ["packages", "apps", "libs", "services", "crates"]) {
    if (!has(parent)) continue;
    try {
      const kids = readdirSync(join(repo, parent), { withFileTypes: true })
        .filter((d) => d.isDirectory() && !SKIP_DIRS.has(d.name))
        .map((d) => d.name);
      if (kids.length) bullet(`${parent}/: ${kids.join(", ")}`);
    } catch { /* unreadable */ }
  }
}

// ---------------------------------------------------------------- scripts

section("Commands");

// Commands an agent must not run on its own initiative. Matched on the name
// and on what the body actually invokes, since a harmless-looking name can
// wrap a publish.
const DESTRUCTIVE = /^(deploy|publish|release|migrate|db:(push|reset|drop|migrate)|reset|seed|prune|destroy|teardown)/i;
const DESTRUCTIVE_BODY = /\b(npm|pnpm|yarn|bun)\s+publish\b|\bnpm\s+version\b|\bgh\s+release\b|\bvercel\s+(deploy|--prod)|\bwrangler\s+(deploy|publish)\b|\beas\s+submit\b|\bgit\s+push\b|\bprisma\s+migrate\s+(deploy|reset)\b|\bdrizzle-kit\s+push\b|\brm\s+-rf\s+\//i;
const ROUTINE = /^(test|lint|typecheck|type-check|tsc|check|format|build|dev|start|e2e)/i;
// npm/pnpm run these on their own at install, build or publish time.
const LIFECYCLE = /^(pre|post)?(install|prepare|prepublish|prepublishOnly|prepack|postpack|pack)$|^(pre|post)(dev|build|test|start|publish)$/;

if (pkg?.scripts && Object.keys(pkg.scripts).length) {
  const routine = [];
  const destructive = [];
  const lifecycle = [];
  const other = [];
  for (const [name, body] of Object.entries(pkg.scripts)) {
    const entry = `${name} → ${body}`;
    if (DESTRUCTIVE.test(name) || DESTRUCTIVE_BODY.test(body)) destructive.push(entry);
    else if (LIFECYCLE.test(name)) lifecycle.push(entry);
    else if (ROUTINE.test(name)) routine.push(entry);
    else other.push(entry);
  }
  if (routine.length) {
    line("  routine (an agent may run these):");
    routine.forEach((s) => line(`    ${s}`));
  }
  if (destructive.length) {
    line("  NOT without being asked:");
    destructive.forEach((s) => line(`    ${s}`));
  }
  if (lifecycle.length) {
    line("  lifecycle (the package manager runs these on its own):");
    lifecycle.forEach((s) => line(`    ${s}`));
  }
  if (other.length) {
    line("  other:");
    other.forEach((s) => line(`    ${s}`));
  }
} else if (pkg) {
  bullet("package.json has no scripts");
}

for (const f of ["Makefile", "Justfile", "justfile", "Taskfile.yml", "Taskfile.yaml"]) {
  if (has(f)) bullet(`${f} present — read it for the real entry points`);
}

// CI, which often reveals the commands that actually gate a merge.
const ciDir = ".github/workflows";
if (has(ciDir)) {
  try {
    const flows = readdirSync(join(repo, ciDir)).filter((f) => /\.ya?ml$/.test(f));
    if (flows.length > 12) {
      bullet(`${ciDir}: ${flows.length} workflows — ${flows.slice(0, 12).join(", ")}, …`);
    } else if (flows.length) {
      bullet(`${ciDir}: ${flows.join(", ")}`);
    }
  } catch { /* unreadable */ }
}

// ------------------------------------------------------- off-limits paths

section("Paths that look off limits");

const GENERATED_HINT = /(^|\/)(generated|__generated__|gen|\.generated)(\/|$)/i;
const tree = walk("", 0, 3);
const dirs = tree.filter((e) => e.dir).map((e) => e.path);

const flagged = new Set();

for (const d of dirs) {
  if (GENERATED_HINT.test(d)) flagged.add(`${d}/ — name suggests generated output`);
}

// Committed build output: in .gitignore yet tracked anyway.
const tracked = new Set(git("ls-files").split("\n").filter(Boolean));
if (has(".gitignore")) {
  const ignored = read(".gitignore")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  for (const patt of ignored) {
    const clean = patt.replace(/^\//, "").replace(/\/$/, "");
    if (!clean || clean.includes("*")) continue;
    const hit = [...tracked].some((t) => t === clean || t.startsWith(`${clean}/`));
    if (hit) flagged.add(`${clean} — in .gitignore but tracked anyway`);
  }
}

// "Do not edit" banners, checked on tracked text files only.
const BANNER = /(do not edit|don't edit|auto-?generated|@generated|generated by)/i;
let scanned = 0;
for (const t of tracked) {
  if (scanned > 400) break;
  if (!/\.(ts|tsx|js|jsx|mjs|cjs|go|rs|py|rb|java|kt|swift|graphql|sql|json|yaml|yml)$/.test(t)) continue;
  try {
    const full = join(repo, t);
    if (statSync(full).size > 200_000) continue;
    const head = readFileSync(full, "utf8").slice(0, 400);
    scanned += 1;
    if (BANNER.test(head)) flagged.add(`${t} — "do not edit" style banner`);
  } catch { /* unreadable */ }
}

// Codegen scripts tell you what regenerates the above.
if (pkg?.scripts) {
  for (const [name, body] of Object.entries(pkg.scripts)) {
    if (/codegen|generate|gen:/i.test(name)) {
      flagged.add(`regenerate with: ${name} → ${body}`);
    }
  }
}

if (flagged.size) [...flagged].forEach((f) => bullet(f));
else none();

// ------------------------------------------------- existing instructions

section("Instruction files already present");

const INSTRUCTION_FILES = [
  "CLAUDE.md", ".claude/CLAUDE.md", "CLAUDE.local.md", "AGENTS.md",
  ".claude/AGENTS.md", ".cursorrules", ".github/copilot-instructions.md",
  ".windsurfrules", ".clinerules", "GEMINI.md", "CONTRIBUTING.md",
  ".editorconfig",
];

const present = INSTRUCTION_FILES.filter(has);
for (const f of present) {
  const lines = read(f).split("\n").length;
  bullet(`${f} (${lines} lines)`);
}
for (const d of [".claude/rules", ".cursor/rules", ".windsurf/rules", ".devin/rules"]) {
  if (has(d)) {
    try {
      const files = readdirSync(join(repo, d)).filter((f) => /\.mdc?$/.test(f));
      bullet(`${d}/: ${files.join(", ") || "(empty)"}`);
    } catch { /* unreadable */ }
  }
}
if (!present.length) none();

// The AGENTS.md / CLAUDE.md interaction catches people out.
const claudeish = ["CLAUDE.md", ".claude/CLAUDE.md", "CLAUDE.local.md"].filter(has);
if (has("AGENTS.md") && claudeish.length) {
  bullet(
    `NOTE: AGENTS.md is present alongside ${claudeish.join(", ")} — by default ` +
      "Claude Code reads the CLAUDE.md files and ignores AGENTS.md",
  );
}

// ---------------------------------------------------------------- history

section("Commit and branch conventions");

// --no-merges matters: merge commits never match a commit convention, and
// counting them makes a disciplined history look undisciplined.
const subjects = git("log", "--no-merges", "--format=%s", "-n", "200")
  .split("\n")
  .filter(Boolean);

if (subjects.length) {
  const conventional = subjects.filter((s) => /^[a-z]+(\([^)]+\))?!?:/.test(s));
  const pct = Math.round((conventional.length / subjects.length) * 100);
  bullet(`${subjects.length} recent non-merge commits, ${pct}% match <type>(<scope>): <desc>`);

  const scopes = new Map();
  const types = new Map();
  for (const s of conventional) {
    const m = s.match(/^([a-z]+)(?:\(([^)]+)\))?!?:/);
    if (!m) continue;
    types.set(m[1], (types.get(m[1]) || 0) + 1);
    if (m[2]) scopes.set(m[2], (scopes.get(m[2]) || 0) + 1);
  }
  const fmt = (m) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} (${v})`).join(", ");
  if (types.size) bullet(`types in use: ${fmt(types)}`);
  if (scopes.size) bullet(`scopes in use: ${fmt(scopes)}`);
  else if (conventional.length) bullet("no scopes in use");
} else {
  bullet("no commit history readable (not a git repo, or empty)");
}

const branches = git("branch", "-a", "--format=%(refname:short)").split("\n").filter(Boolean);
if (branches.length) {
  const prefixes = new Map();
  for (const b of branches) {
    const m = b.replace(/^origin\//, "").match(/^([a-z]+)\//);
    if (m) prefixes.set(m[1], (prefixes.get(m[1]) || 0) + 1);
  }
  if (prefixes.size) {
    bullet(
      `branch prefixes: ${[...prefixes.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}/ (${v})`).join(", ")}`,
    );
  }
}

// Where new files actually land, which often contradicts the README.
const added = git("log", "--diff-filter=A", "--name-only", "--format=", "-n", "150")
  .split("\n")
  .filter(Boolean);
if (added.length) {
  const byDir = new Map();
  for (const f of added) {
    const parts = f.split("/");
    if (parts.length < 2) continue;
    const d = parts.slice(0, Math.min(2, parts.length - 1)).join("/");
    byDir.set(d, (byDir.get(d) || 0) + 1);
  }
  const top = [...byDir.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (top.length) {
    line("  where recently added files landed:");
    top.forEach(([d, n]) => line(`    ${d}/ (${n})`));
  }
}

// ------------------------------------------------------------ still yours

section("Still yours");

const remaining = [
  "Whether an inconsistency in the codebase is deliberate, or a migration in progress.",
  "Which of the flagged paths are genuinely off limits, and why.",
  "Which commands are destructive in this project beyond the names matched above.",
  "What an agent has already got wrong here — the highest-value lines come from asking.",
  "Whether the owner's global memory file already covers a rule, so this file can drop it.",
  "Whether a monorepo's packages differ enough to deserve their own files.",
  "Everything in references/safety.md: nothing above has been checked for disclosure.",
];
remaining.forEach((r) => bullet(r));

line("");
console.log(out.join("\n"));
