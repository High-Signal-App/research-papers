#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = join(projectRoot, "web");
const productionPaths = ["src", "scripts", "web/src", "web/functions", "web/public/app.js"];
const debtIssue = "https://github.com/High-Signal-App/research-papers/issues/29";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? projectRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error(`${command} exited with status ${result.status}`);
  }
  return result;
}

function failRegressions(label, observed, baseline) {
  const regressions = Object.entries(baseline).filter(([key, maximum]) => observed[key] > maximum);
  if (regressions.length > 0) {
    throw new Error(
      regressions
        .map(([key, maximum]) => `${label} ${key} regressed: ${observed[key]} > ${maximum}`)
        .join("\n")
    );
  }
  if (Object.entries(baseline).some(([key, maximum]) => observed[key] < maximum)) {
    console.log(`${label} improved; lower the checked-in baseline intentionally (${debtIssue}).`);
  }
}

function biomeReport(command) {
  const result = run(
    "pnpm",
    ["exec", "biome", command, ".", "--reporter=json", "--max-diagnostics=none"],
    { cwd: webRoot, allowFailure: true }
  );
  return JSON.parse(result.stdout);
}

function checkFormat() {
  const python = run("uv", ["run", "ruff", "format", "--check", "src", "tests", "scripts"], {
    allowFailure: true,
  });
  const pythonOutput = `${python.stdout ?? ""}\n${python.stderr ?? ""}`;
  const pythonMatch = pythonOutput.match(/(\d+) files? would be reformatted/u);
  const web = biomeReport("format");
  const observed = {
    pythonFiles: pythonMatch ? Number(pythonMatch[1]) : 0,
    webFiles: web.summary.errors,
  };
  console.log(
    `Format: ${observed.pythonFiles} Python files and ${observed.webFiles} web files outside formatter baselines.`
  );
  failRegressions("Format", observed, { pythonFiles: 0, webFiles: 41 });
}

function checkLint() {
  const python = JSON.parse(
    run("uv", ["run", "ruff", "check", "src", "tests", "scripts", "--output-format", "json"], {
      allowFailure: true,
    }).stdout
  );
  const web = biomeReport("lint");
  const observed = {
    pythonFindings: python.length,
    pythonUndefined: python.filter((finding) => finding.code === "F821").length,
    webErrors: web.summary.errors,
    webWarnings: web.summary.warnings,
  };
  console.log(
    `Lint: ${observed.pythonFindings} Python findings (${observed.pythonUndefined} undefined-name), ` +
      `${observed.webErrors} web errors and ${observed.webWarnings} web warnings.`
  );
  failRegressions("Lint", observed, {
    pythonFindings: 60,
    pythonUndefined: 0,
    webErrors: 22,
    webWarnings: 93,
  });
}

function checkTypes() {
  run("pnpm", ["exec", "astro", "check"], { cwd: webRoot });
  const report = JSON.parse(
    run("uv", ["run", "ty", "check", "src", "--output-format", "gitlab", "--exit-zero"]).stdout
  );
  const observed = {
    pythonDiagnostics: report.length,
    pythonMajor: report.filter((diagnostic) => diagnostic.severity === "major").length,
  };
  console.log(
    `Types: Astro has 0 errors; Python has ${observed.pythonDiagnostics} diagnostics ` +
      `(${observed.pythonMajor} major).`
  );
  failRegressions("Types", observed, { pythonDiagnostics: 88, pythonMajor: 84 });
}

function checkTests() {
  run("uv", ["run", "pytest", "-q", "-m", "not golden"]);
  run("node", ["--test", "tests/web_health.test.mjs"]);
}

function checkCoverage() {
  const outputDirectory = mkdtempSync(join(tmpdir(), "research-papers-coverage-"));
  const coverageFile = join(outputDirectory, "coverage.json");
  run("uv", [
    "run",
    "pytest",
    "-q",
    "-m",
    "not golden",
    "--cov=src/researchpapers",
    "--cov-report=term",
    `--cov-report=json:${coverageFile}`,
    "--cov-fail-under=14.5",
  ]);
  run("node", ["--test", "tests/web_health.test.mjs"]);
  const report = JSON.parse(readFileSync(coverageFile, "utf8"));
  console.log(
    `Coverage: ${report.totals.covered_lines}/${report.totals.num_statements} Python lines ` +
      `(${report.totals.percent_covered.toFixed(4)}%); 3 Pages health tests pass.`
  );
}

function countKnipIssues(report) {
  return report.issues.reduce(
    (counts, issue) => {
      for (const key of Object.keys(counts)) counts[key] += issue[key]?.length ?? 0;
      return counts;
    },
    { files: 0, dependencies: 0, devDependencies: 0, unlisted: 0, unresolved: 0, exports: 0, types: 0 }
  );
}

function checkUnused() {
  run("uv", ["run", "vulture", "src", "scripts", "--min-confidence", "90"]);
  const report = JSON.parse(
    run("pnpm", ["exec", "knip", "--reporter", "json", "--no-exit-code", "--no-config-hints"], {
      cwd: webRoot,
    }).stdout
  );
  const observed = countKnipIssues(report);
  console.log(
    `Unused: 0 high-confidence Python findings; ${observed.files} web files, ` +
      `${observed.dependencies} dependencies, ${observed.devDependencies} dev dependencies, ` +
      `${observed.exports} exports, ${observed.types} types.`
  );
  failRegressions("Unused", observed, {
    files: 13,
    dependencies: 2,
    devDependencies: 0,
    unlisted: 0,
    unresolved: 0,
    exports: 10,
    types: 3,
  });
}

function checkComplexity() {
  const result = run("uv", [
    "run",
    "lizard",
    ...productionPaths,
    "-x",
    "**/*.test.*",
    "-x",
    "scripts/check-code-health.mjs",
    "--csv",
  ]);
  const rows = result.stdout
    .trim()
    .split("\n")
    .map((line) => line.match(/^(\d+),(\d+),(\d+),(\d+),(\d+),/u))
    .filter(Boolean)
    .map((match) => match.slice(1).map(Number));
  const observed = {
    functions: rows.length,
    nloc: rows.reduce((sum, row) => sum + row[0], 0),
    violations: rows.filter((row) => row[1] > 20 || row[4] > 100 || row[3] > 7).length,
    maxCcn: Math.max(0, ...rows.map((row) => row[1])),
    maxLength: Math.max(0, ...rows.map((row) => row[4])),
    maxParams: Math.max(0, ...rows.map((row) => row[3])),
  };
  console.log(
    `Complexity: ${observed.functions} functions, ${observed.nloc} NLOC, ` +
      `${observed.violations} violations; max CCN ${observed.maxCcn}, ` +
      `max length ${observed.maxLength}, max params ${observed.maxParams}.`
  );
  failRegressions("Complexity", observed, {
    violations: 27,
    maxCcn: 77,
    maxLength: 353,
    maxParams: 11,
  });
}

function checkDuplication() {
  const outputDirectory = mkdtempSync(join(tmpdir(), "research-papers-jscpd-"));
  run("pnpm", [
    "exec",
    "jscpd",
    ...productionPaths.map((path) => resolve(projectRoot, path)),
    "--format",
    "javascript,typescript,python",
    "--min-lines",
    "8",
    "--min-tokens",
    "60",
    "--mode",
    "strict",
    "--ignore",
    "**/*.test.*,**/node_modules/**,**/coverage/**,**/dist/**,**/check-code-health.mjs",
    "--reporters",
    "json",
    "--output",
    outputDirectory,
    "--silent",
    "--no-tips",
  ], { cwd: webRoot });
  const observed = JSON.parse(readFileSync(join(outputDirectory, "jscpd-report.json"), "utf8"))
    .statistics.total;
  console.log(
    `Duplication: ${observed.duplicatedLines}/${observed.lines} lines ` +
      `(${observed.percentage.toFixed(4)}%), ${observed.clones} groups across ${observed.sources} files.`
  );
  failRegressions("Duplication", observed, {
    clones: 11,
    duplicatedLines: 113,
    percentage: 0.8031843059208189,
  });
}

function checkCycles() {
  run("uv", ["run", "python", "scripts/check_python_cycles.py"]);
  run("pnpm", ["exec", "knip", "--cycles", "--no-config-hints"], { cwd: webRoot });
  console.log("Dependency cycles: 0 Python, 0 web.");
}

function checkDependencies() {
  const outputDirectory = mkdtempSync(join(tmpdir(), "research-papers-audit-"));
  const requirements = join(outputDirectory, "requirements.txt");
  const exported = run("uv", ["export", "--frozen", "--no-dev", "--no-emit-project", "--no-hashes"]);
  writeFileSync(requirements, exported.stdout);
  const python = JSON.parse(
    run("uv", ["run", "pip-audit", "--requirement", requirements, "--format", "json"], {
      allowFailure: true,
    }).stdout
  );
  const acceptedPython = new Set([
    "CVE-2026-9856",
    "GHSA-537c-gmf6-5ccf",
    "PYSEC-2025-194",
    "PYSEC-2026-139",
    "PYSEC-2026-2253",
    "PYSEC-2026-2254",
    "PYSEC-2026-2255",
    "PYSEC-2026-2256",
    "PYSEC-2026-2257",
    "PYSEC-2026-248",
    "PYSEC-2026-249",
    "PYSEC-2026-3447",
    "PYSEC-2026-3451",
    "PYSEC-2026-3452",
    "PYSEC-2026-3453",
    "PYSEC-2026-3454",
    "PYSEC-2026-3493",
    "PYSEC-2026-3494",
    "PYSEC-2026-3495",
    "PYSEC-2026-3496",
    "PYSEC-2026-3552",
    "PYSEC-2026-3553",
    "PYSEC-2026-3554",
  ]);
  const pythonIds = new Set(
    python.dependencies.flatMap((dependency) => (dependency.vulns ?? []).map((vulnerability) => vulnerability.id))
  );
  const unexpectedPython = [...pythonIds].filter((id) => !acceptedPython.has(id));

  const web = JSON.parse(run("pnpm", ["audit", "--json"], { cwd: webRoot, allowFailure: true }).stdout);
  const acceptedWebHigh = new Set([
    "CVE-2026-9856",
    "GHSA-28wg-ghj8-5hjv",
    "GHSA-2p49-hgcm-8545",
    "GHSA-2pvr-wf23-7pc7",
    "GHSA-2v37-7h3g-55p8",
    "GHSA-52cp-r559-cp3m",
    "GHSA-5p4m-2wfm-xmqj",
    "GHSA-5jgf-p345-68v8",
    "GHSA-73wf-gq98-2v4g",
    "GHSA-8hv8-536x-4wqp",
    "GHSA-c83g-rgw3-j3cx",
    "GHSA-f65p-4m7j-42xc",
    "GHSA-f88m-g3jw-g9cj",
    "GHSA-fph4-wmhf-6fwf",
    "GHSA-fx2h-pf6j-xcff",
    "GHSA-jqff-g426-hqxp",
    "GHSA-r28c-9q8g-f849",
  ]);
  const webAdvisories = Object.values(web.advisories ?? {});
  const webCriticalHigh = webAdvisories.filter((advisory) =>
    ["critical", "high"].includes(advisory.severity)
  );
  const unexpectedWeb = webCriticalHigh.filter(
    (advisory) => !acceptedWebHigh.has(advisory.github_advisory_id)
  );
  console.log(
    `Dependencies: ${pythonIds.size} accepted Python advisories; ` +
      `${web.metadata.vulnerabilities.critical} critical, ${web.metadata.vulnerabilities.high} high, ` +
      `${web.metadata.vulnerabilities.moderate} moderate web advisories.`
  );
  if (unexpectedPython.length || unexpectedWeb.length) {
    throw new Error(
      `Unexpected advisories: ${[
        ...unexpectedPython,
        ...unexpectedWeb.map((advisory) => advisory.github_advisory_id),
      ].join(", ")}`
    );
  }
  failRegressions(
    "Dependencies",
    {
      pythonAdvisories: pythonIds.size,
      webCritical: web.metadata.vulnerabilities.critical,
      webHigh: web.metadata.vulnerabilities.high,
    },
    { pythonAdvisories: 23, webCritical: 0, webHigh: 16 }
  );
}

function checkSuppressions() {
  const result = run(
    "git",
    [
      "grep",
      "-n",
      "-E",
      "(biome-ignore|eslint-disable|@ts-ignore|@ts-expect-error|istanbul ignore|c8 ignore|# (noqa|type: ignore|pragma: no cover))",
      "--",
      ...productionPaths,
      ":(exclude)scripts/check-code-health.mjs",
    ],
    { allowFailure: true }
  );
  const observed = result.stdout.trim() ? result.stdout.trim().split("\n").length : 0;
  console.log(`Suppressions: ${observed} inline directives.`);
  failRegressions("Suppressions", { count: observed }, { count: 31 });
}

function checkHygiene() {
  const conflicts = run("git", ["grep", "-n", "-E", "^(<<<<<<<|=======|>>>>>>>)", "--", "."], {
    allowFailure: true,
  }).stdout.trim();
  if (conflicts) throw new Error(`Conflict markers:\n${conflicts}`);
  const todos = run(
    "git",
    ["grep", "-n", "-E", "TODO|FIXME", "--", ...productionPaths, ":(exclude)scripts/check-code-health.mjs"],
    { allowFailure: true }
  ).stdout.trim();
  if (todos) throw new Error(`Durable TODO/FIXME markers:\n${todos}`);
  run("git", ["diff", "--check", "HEAD", "--", "."]);
  console.log("Repository hygiene: clean.");
}

function checkDocs() {
  run("bash", ["scripts/check-docs.sh"]);
}

function checkBuild() {
  run("pnpm", ["build"], { cwd: webRoot });
}

const checks = {
  build: checkBuild,
  complexity: checkComplexity,
  coverage: checkCoverage,
  cycles: checkCycles,
  dependencies: checkDependencies,
  docs: checkDocs,
  duplication: checkDuplication,
  format: checkFormat,
  hygiene: checkHygiene,
  lint: checkLint,
  suppressions: checkSuppressions,
  tests: checkTests,
  types: checkTypes,
  unused: checkUnused,
};

const selected = process.argv[2];
const allChecks = [
  "format",
  "lint",
  "types",
  "coverage",
  "unused",
  "complexity",
  "duplication",
  "cycles",
  "dependencies",
  "suppressions",
  "hygiene",
  "docs",
  "build",
];

try {
  if (selected === "all") {
    for (const name of allChecks) checks[name]();
  } else if (Object.hasOwn(checks, selected)) {
    checks[selected]();
  } else {
    throw new Error(`Usage: check-code-health.mjs <all|${Object.keys(checks).join("|")}>`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
