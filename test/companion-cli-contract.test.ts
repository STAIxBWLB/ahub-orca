import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The contract copy (contract/companion-cli-v1.json, source in contract/SOURCE.md) is all this companion may assume about ahub's CLI (agent-hub#1387).
// These tests hold the companion's own code to it: its shellQuote against the vectors, and every command, stderr prefix and status field its reader touches against the listed ones.
// @ts-ignore TS7016: untyped plain JavaScript by design
const companion: any = await import("../src/companion.mjs");
const ROOT = join(import.meta.dir, "..");
const contract = JSON.parse(readFileSync(join(ROOT, "contract/companion-cli-v1.json"), "utf8"));
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");

test("the contract copy is the version this companion was written against", () => {
  expect(contract.contract).toBe("companion-cli");
  expect(contract.version).toBe(1);
  expect(readFileSync(join(ROOT, "contract/SOURCE.md"), "utf8")).toMatch(/ahub version: \d+\.\d+\.\d+/);
});

test("shellQuote gives every golden vector of the contract", () => {
  expect(contract.shellQuote.length).toBeGreaterThanOrEqual(11);
  for (const vector of contract.shellQuote) expect(companion.shellQuote(vector.in), JSON.stringify(vector.in)).toBe(vector.out);
});

test("every ahub command the companion runs or types is a listed argv form", () => {
  const listed = (bin: string, argv: string[]) => contract.commands.some((c: { bin?: string; argv: string[] }) => (c.bin ?? "ahub") === bin && JSON.stringify(c.argv) === JSON.stringify(argv));
  // the status read and the projects read (#5 U3): fixed argvs run by the worker
  const worker = code(read("src/worker.mjs"));
  const run = [...worker.matchAll(/argv:\s*(\[[^\]]*\])/g)].map(m => JSON.parse(m[1]!.replace(/'/g, '"')) as string[]);
  expect(run).toEqual([["status", "--json"], ["projects", "--json"]]);
  for (const argv of run) expect(listed("ahub", argv), argv.join(" ")).toBe(true);
  // the entry points: the dashboard (CLI), the console and the family console (typed into a terminal)
  const source = code(read("src/companion.mjs"));
  expect(source).toContain('argv: ["ui"]');
  expect(source).toContain('argv: ["ahub", "console"]');
  expect(source).toContain('argv: ["acon", "ui"]');
  expect(listed("ahub", ["ui"])).toBe(true);
  expect(listed("ahub", ["console"])).toBe(true);
  expect(listed("acon", ["ui"])).toBe(true);
  // the companion never adds a flag or subcommand the contract does not list
  expect(source).not.toMatch(/--project|"projects"/);
});

test("the no-hub stderr prefix the worker tests for is the contract's, and exit code 1 is the one it relies on", () => {
  const prefix = /const NO_HUB_PREFIX = "([^"]+)"/.exec(read("src/worker.mjs"))?.[1];
  expect(prefix).toBe(contract.noHub.stderrPrefix);
  expect(contract.noHub.exitCode).toBe(1);
  expect(read("src/status.mjs")).toMatch(/exit 1/);
});

test("every status field the reader touches is a listed path, with a type that admits what the reader accepts", () => {
  const status = code(read("src/status.mjs"));
  const touched = new Set<string>();
  for (const m of status.matchAll(/\braw\.(\w+)/g)) touched.add(m[1]!);
  for (const m of status.matchAll(/\brow\.(\w+)/g)) touched.add(`peers.<id>.${m[1]}`);
  // a guard against the scan finding nothing: these are the paths the reader is known to use today
  expect([...touched].sort()).toEqual(["peers", "peers.<id>.attached", "peers.<id>.queued", "peers.<id>.state", "tasks", "version"]);
  for (const path of touched) expect(contract.status[path], `${path} is not a listed status path`).toBeDefined();
  // the closed sets the reader recognises are exactly the contract's (it adds only `unknown` for a value outside them)
  // @ts-ignore TS7016: untyped plain JavaScript by design
  return import("../src/status.mjs").then((reader: any) => {
    expect(reader.PEER_STATES.filter((s: string) => s !== "unknown")).toEqual(contract.status["peers.<id>.state"].values);
    // `attached` is read as "false when the peer has no adapter, otherwise attached", which is how the contract states it
    expect(contract.status["peers.<id>.attached"].type).toBe("false");
    // the task states are read as any lowercase word, so a state the contract lists is always accepted
    for (const state of contract.status.tasks.values) expect(state).toMatch(/^[a-z_]{1,32}$/);
  });
});

test("every projects field the reader touches is a listed path, and its closed set is the contract's (#5 U3)", () => {
  const status = code(read("src/status.mjs"));
  const touched = new Set([...status.matchAll(/\bproject\.(\w+)/g)].map(m => `[].${m[1]}`));
  expect([...touched].sort()).toEqual(["[].root", "[].state"]);
  for (const path of touched) expect(contract.projects[path], `${path} is not a listed projects path`).toBeDefined();
  expect(contract.projects["[].state"].presence).toMatch(/running and stopped/);
  // @ts-ignore TS7016: untyped plain JavaScript by design
  return import("../src/status.mjs").then((reader: any) => expect(reader.HUB_STATES).toEqual(["running", "stopped"]));
});

test("the reader does not touch needs or any other path the contract lists but this companion does not use", () => {
  // only the readers in status.mjs see ahub's output (`.cwd` elsewhere is the spawn option), so a path used by a later change must be added to the lists above and to this scan's expectation
  expect(code(read("src/status.mjs"))).not.toMatch(/\.needs\b|\.projectId\b|\.cwd\b|\.needsReview\b|\.pullOnly\b|\.paused\b|\.stateDir\b|\.basePort\b|\.pid\b|\.instanceId\b/);
  // the worker hands parsed output to a reader and touches none of it itself
  expect(code(read("src/worker.mjs")) + code(read("src/companion.mjs"))).not.toMatch(/\bparsed\.|\blist\.[a-z]/);
});
