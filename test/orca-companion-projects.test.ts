import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FakeOrcaCompanionHost, type OrcaCompanionFixtureWorkspace } from "./helpers/orca-companion-host.ts";
import { FakeOrcaCompanionCli, type OrcaCompanionFixtureCliResponse } from "./fakes/orca-companion-cli.ts";

// #5 U3: `projects.read` labels the listed workspaces that are agent-hub projects with their hub state, and doubles as the setup check for a missing ahub. Fixtures only.
// @ts-ignore TS7016: untyped plain JavaScript by design
const worker: any = await import("../src/worker.mjs");
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function setup(options: { rows?: (a: string, b: string) => OrcaCompanionFixtureWorkspace[]; ahub?: OrcaCompanionFixtureCliResponse[]; spawn?: (call: any) => Promise<any>; platform?: string } = {}) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "ahub-orca-projects-"))); dirs.push(base);
  const a = join(base, "a b"), b = join(base, "b"); mkdirSync(a); mkdirSync(b);
  const rows = (options.rows ?? ((a_, b_) => [
    { id: "ws-a", kind: "worktree", name: "a", path: a_, branch: "main", hostId: "local" },
    { id: "ws-b", kind: "folder", name: "b", path: b_, branch: null, hostId: "local" },
  ]))(a, b);
  const fake = new FakeOrcaCompanionHost({ offeredMethods: ["workspace.list"], surface: "worker", capabilities: ["workspace:read"], workspaces: rows });
  const cli = new FakeOrcaCompanionCli({ hostId: "local", scripted: options.ahub ?? [] });
  const instance = worker.createCompanion({ host: { has: (m: string) => fake.has(m), call: (m: string, p?: unknown) => fake.call(m, p) }, readSettings: async () => ({ localHostIds: "local" }),
    spawnCli: options.spawn ?? cli.run, platform: options.platform, log: () => {} });
  return { base, a, b, cli, instance };
}
const out = (list: unknown) => [{ stdout: JSON.stringify(list), exitCode: 0 }];

test("matching projects get their hub state by workspace id; nothing but that map leaves", async () => {
  const probe = setup(); const link = join(probe.base, "link-to-a"); symlinkSync(probe.a, link);
  const list = [
    { id: "p1", root: link, state: "running", stateDir: "/secret/state", status: { doing: "secret task title" } }, // a symlinked root still matches its real folder
    { id: "p2", root: probe.b, state: "rebooting" },                                                         // a state outside the closed set reads as unknown
    { id: "p3", root: join(probe.base, "gone"), state: "running" },                                         // a folder that is gone matches nothing
    { id: "p4", root: "/elsewhere/other", state: "stopped" },
  ];
  const s = setup({ rows: () => [
    { id: "ws-a", kind: "worktree", name: "a", path: probe.a, branch: "main", hostId: "local" },
    { id: "ws-b", kind: "folder", name: "b", path: probe.b, branch: null, hostId: "local" },
  ], ahub: out(list) });
  const result = await s.instance.projects(undefined);
  expect(result).toEqual({ ok: true, hubs: { "ws-a": "running", "ws-b": "unknown" } });
  expect(s.cli.calls).toHaveLength(1);
  expect(s.cli.calls[0]).toMatchObject({ argv: ["projects", "--json"], cwd: probe.a, hostId: "local" });
  expect(s.cli.calls[0]!.maxOutputBytes).toBeGreaterThanOrEqual(1024 * 1024);
  expect(JSON.stringify(result)).not.toMatch(/secret|\/|p1|p2/);
});

test("a stopped hub is reported as stopped, and a workspace that is not a project gets no entry", async () => {
  const probe = setup();
  const s = setup({ rows: () => [{ id: "ws-a", kind: "worktree", name: "a", path: probe.a, branch: "main", hostId: "local" }, { id: "ws-b", kind: "folder", name: "b", path: probe.b, branch: null, hostId: "local" }],
    ahub: out([{ id: "p", root: probe.b, state: "stopped" }]) });
  expect(await s.instance.projects(undefined)).toEqual({ ok: true, hubs: { "ws-b": "stopped" } });
});

test("a list with no workspace bound on this Mac runs nothing", async () => {
  const remote = setup({ rows: (a, b) => [{ id: "r", kind: "worktree", name: "r", path: a, branch: null, hostId: "ssh-box" }, { id: "n", kind: "folder", name: "n", path: b, branch: null, hostId: null }] });
  expect(await remote.instance.projects(undefined)).toEqual({ ok: true, hubs: {} }); expect(remote.cli.calls).toHaveLength(0);
  const win = setup({ platform: "win32" });
  expect(await win.instance.projects(undefined)).toEqual({ ok: true, hubs: {} }); expect(win.cli.calls).toHaveLength(0);
});

test("a missing ahub is cli_missing (the setup check); every other failure is a refusal with no partial map", async () => {
  const missing = setup({ spawn: async () => { throw Object.assign(new Error("spawn ahub ENOENT"), { code: "ENOENT" }); } });
  expect(await missing.instance.projects(undefined)).toMatchObject({ ok: false, refusal: "cli_missing" });
  const cases: [OrcaCompanionFixtureCliResponse, string][] = [
    [{ stdout: "", stderr: "boom /secret", exitCode: 2 }, "cli_failed"],
    [{ stdout: "not json", exitCode: 0 }, "unrecognized_output"],
    [{ stdout: JSON.stringify({ projects: [] }), exitCode: 0 }, "unrecognized_output"],
    [{ stdout: JSON.stringify([{ root: "relative/path", state: "running" }]), exitCode: 0 }, "unrecognized_output"],
    [{ stdout: "[]", exitCode: 0, durationMs: 60_000 }, "cli_timeout"],
  ];
  for (const [response, refusal] of cases) {
    const s = setup({ ahub: [response] });
    const result = await s.instance.projects(undefined);
    expect(result, refusal).toMatchObject({ ok: false, refusal }); expect(JSON.stringify(result)).not.toContain("secret");
  }
});

test("projects.read takes no input and is a registered handler", async () => {
  const s = setup();
  expect(await s.instance.projects({ extra: 1 })).toMatchObject({ ok: false, refusal: "bad_request" });
  expect(s.cli.calls).toHaveLength(0);
  expect(Object.keys(s.instance.handlers)).toContain("projects.read");
});
