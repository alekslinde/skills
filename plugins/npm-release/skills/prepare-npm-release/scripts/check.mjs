#!/usr/bin/env node
//
// SPDX-FileCopyrightText: 2026 Aleksandr Linde
// SPDX-License-Identifier: Apache-2.0
//
// The mechanical half of the pre-publish audit.
//
//   node check.mjs <repo-path> [package-dir ...]
//
// Checks what a script can decide without judgement: whether a claim in one
// file contradicts a fact in another. Everything requiring a human — is this
// name final, is the Node floor still alive, does the smoke suite assert
// anything worth asserting — is listed at the end as "still yours" and is
// covered in references/audit.md.
//
// Package directories are discovered under packages/ when none are named.
// For any other layout, name them: node check.mjs . libs/a libs/b
//
// Exits non-zero if any check fails, so it can gate a release.
//
// Deliberately dependency-free and read-only: it runs in a repo it knows
// nothing about, and a prep tool that mutates the thing it is inspecting is
// not one you would run twice.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const [, , repoArg, ...pkgArgs] = process.argv;

if (!repoArg) {
  console.error("usage: node check.mjs <repo-path> [package-dir ...]");
  process.exit(2);
}

const repo = repoArg;
const results = [];
const record = (ok, rule, message) => results.push({ ok, rule, message });

const read = (p) => readFileSync(join(repo, p), "utf8");
const readJson = (p) => JSON.parse(read(p));
const exists = (p) => existsSync(join(repo, p));

/** Packages to check: named on the command line, or every publishable one. */
function findPackages() {
  if (pkgArgs.length) return pkgArgs;
  if (!exists("packages")) {
    // Single-package repo: the root manifest, if it is publishable at all.
    if (exists("package.json") && readJson("package.json").private !== true) return ["."];
    return [];
  }
  return readdirSync(join(repo, "packages"), { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(repo, "packages", e.name, "package.json")))
    .map((e) => `packages/${e.name}`)
    .filter((dir) => readJson(`${dir}/package.json`).private !== true);
}

/** Every workflow file, as [name, source]. */
function workflows() {
  const dir = ".github/workflows";
  if (!exists(dir)) return [];
  return readdirSync(join(repo, dir))
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .map((f) => [f, read(`${dir}/${f}`)]);
}

/** Lines with comments stripped — a rule is about what runs, not what is said. */
const active = (src) =>
  src
    .split("\n")
    .filter((l) => !l.trim().startsWith("#"))
    .join("\n");

const packages = findPackages();

if (!packages.length) {
  console.error(
    `no publishable packages found in ${repo} — name the package directories explicitly:\n` +
      `  node check.mjs ${repo} <package-dir> [package-dir ...]`,
  );
  process.exit(2);
}

// ── Per package ──────────────────────────────────────────────────────────────

for (const dir of packages) {
  const pkg = readJson(`${dir}/package.json`);
  const id = pkg.name ?? dir;

  // R8 — metadata a registry page and provenance both need.
  for (const field of ["repository", "homepage", "bugs", "license"]) {
    record(Boolean(pkg[field]), "R8", `${id}: ${field} ${pkg[field] ? "set" : "MISSING"}`);
  }
  if (pkg.name?.startsWith("@")) {
    record(
      pkg.publishConfig?.access === "public",
      "R8",
      `${id}: scoped package needs publishConfig.access "public"`,
    );
  }

  // R8 — repository.directory must point at this package.
  const subdir = pkg.repository?.directory;
  if (subdir !== undefined) {
    record(
      exists(`${subdir}/package.json`),
      "R8",
      `${id}: repository.directory "${subdir}" ${exists(`${subdir}/package.json`) ? "resolves" : "points at no package"}`,
    );
  }

  // R8 — a file listed but absent is simply missing from the tarball.
  for (const entry of pkg.files ?? []) {
    if (entry.includes("*")) continue; // globs need a real matcher; not worth one here
    record(exists(`${dir}/${entry}`), "R8", `${id}: files entry "${entry}" ${exists(`${dir}/${entry}`) ? "exists" : "DOES NOT EXIST"}`);
  }
  for (const doc of ["README.md", "LICENSE"]) {
    record((pkg.files ?? []).includes(doc), "R8", `${id}: ${doc} listed in files`);
  }

  // R2 — the protocol npm ships verbatim.
  const deps = { ...pkg.dependencies, ...pkg.peerDependencies };
  for (const [dep, range] of Object.entries(deps)) {
    record(!String(range).startsWith("workspace:"), "R2", `${id}: ${dep}@${range}`);
    record(String(range) !== "*", "R2", `${id}: ${dep}@${range} — "*" publishes an unresolvable range`);
  }

  // R3 — provenance in the manifest; the call site is checked below.
  record(pkg.publishConfig?.provenance === true, "R3", `${id}: publishConfig.provenance`);

  // R11 — the support claim, against the CI matrix.
  const floor = /^>=\s*(\d+)/.exec(pkg.engines?.node ?? "")?.[1];
  if (!floor) {
    record(false, "R11", `${id}: engines.node is "${pkg.engines?.node ?? "unset"}" — expected ">=N"`);
  } else {
    const ci = exists(".github/workflows/ci.yml") ? read(".github/workflows/ci.yml") : "";
    const tested = [...ci.matchAll(/node-version:\s*\[?["']?(\d+)/g)].map((m) => Number(m[1]));
    const matrix = [...ci.matchAll(/node:\s*\[([^\]]+)\]/g)].flatMap((m) =>
      m[1].split(",").map((v) => Number(v.replace(/["'\s]/g, ""))),
    );
    const all = [...new Set([...tested, ...matrix])].filter(Number.isFinite);
    record(
      all.includes(Number(floor)),
      "R11",
      `${id}: engines.node >=${floor}; CI tests ${all.join(", ") || "nothing detectable"}`,
    );

    // R11a — EOL dates, which rot. Update these when you update the table.
    const EOL = { 18: "2025-04", 20: "2026-04", 22: "2027-04", 24: "2028-04" };
    const now = new Date().toISOString().slice(0, 7);
    const dead = EOL[floor] && EOL[floor] < now;
    record(!dead, "R11a", `${id}: Node ${floor} ${dead ? `reached EOL ${EOL[floor]}` : "is current"}`);
  }
}

// ── Workflows ────────────────────────────────────────────────────────────────

const releaseFiles = workflows().filter(
  ([name, src]) => /publish|release/i.test(name) || /npm (stage )?publish|pnpm publish/.test(src),
);

record(releaseFiles.length > 0, "R5", `found ${releaseFiles.length} release workflow(s)`);

for (const [name, src] of releaseFiles) {
  const body = active(src);

  // R1 — a token anywhere means OIDC is not what authenticates this.
  const tokenFree = !/NODE_AUTH_TOKEN|NPM_TOKEN/.test(body);
  record(tokenFree, "R1", `${name}: ${tokenFree ? "no long-lived token" : "carries a token"}`);
  record(/id-token:\s*write/.test(body), "R1", `${name}: id-token: write`);

  // R1 — OIDC needs npm >= 11.5.1, which means Node 24+.
  const node = /node-version:\s*["']?(\d+)/.exec(body)?.[1];
  if (node) {
    record(
      Number(node) >= 24,
      "R1",
      `${name}: runs on Node ${node}${Number(node) >= 24 ? "" : " — OIDC needs 24+"}`,
    );
  }

  // R5 — staged, not published.
  const stages = /npm stage publish|pnpm stage publish/.test(body);
  const publishes = /run:\s*(npm|pnpm) publish/.test(body);
  record(stages || !publishes, "R5", `${name}: ${stages ? "stages" : "publishes outright"}`);

  // R3 — provenance at the call site, not only in the manifest.
  record(/--provenance/.test(body), "R3", `${name}: --provenance passed explicitly`);
}

// R7 — a release run cancelled mid-publish is how a set half-releases.
for (const [name, src] of releaseFiles) {
  if (!/concurrency:/.test(src)) continue;
  const group = src.slice(src.indexOf("concurrency:"), src.indexOf("concurrency:") + 200);
  record(!/cancel-in-progress:\s*true/.test(group), "R7", `${name}: does not cancel in progress`);
}

// ── Report ───────────────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.ok);

for (const r of results) {
  console.log(`${r.ok ? "  ok " : "FAIL "} [${r.rule}] ${r.message}`);
}

console.log(`\n${results.length - failed.length}/${results.length} passed`);

if (failed.length) {
  console.log("\nFailed:");
  for (const r of failed) console.log(`  [${r.rule}] ${r.message}`);
}

console.log(`
Still yours to judge (see references/audit.md):
  1  the package name is final, and the scope exists on npm
  2  the packed tarball really is clean  (npm pack, then read it)
  6  inter-package ranges resolve against what is published
  7  the smoke suite asserts something worth asserting
  12 packing leaves the tree clean, if prepack rewrites the manifest
  -  settings outside the repo: trusted publisher, 2FA, first manual publish`);

process.exit(failed.length ? 1 : 0);
