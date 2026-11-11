import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FakeOrcaCompanionHost } from "./helpers/orca-companion-host.ts";
import { FakeOrcaCompanionCli, type OrcaCompanionFixtureCliResponse } from "./fakes/orca-companion-cli.ts";

// #5 U4 (D1): the remembered selection and the palette commands that act on it. Fixtures only: an in-memory store stands in for the plugin's own storage.
// @ts-ignore TS7016: untyped plain JavaScript by design
const worker: any = await import("../src/worker.mjs");
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

class StoreHost {
  readonly calls: string[] = []; readonly terminals: unknown[] = []; readonly store = new Map<string, unknown>(); storage = true; slowNextList = 0;
  constructor(readonly fake: FakeOrcaCompanionHost) {}
  has(method: string) { return method.startsWith("storage.") ? this.storage : method === "terminal.create" || this.fake.has(method); }
  async call(method: string, params?: any) {
    this.calls.push(method);
    if (method === "storage.get") return { value: this.store.has(params.key) ? structuredClone(this.store.get(params.key)) : null };
    if (method === "storage.set") { this.store.set(params.key, structuredClone(params.value)); return { ok: true }; }
    if (method === "storage.delete") { this.store.delete(params.key); return { ok: true }; }
    if (method === "workspace.list" && this.slowNextList) { const ms = this.slowNextList; this.slowNextList = 0; await Bun.sleep(ms); }
    if (method === "terminal.create") { this.terminals.push(structuredClone(params)); return { terminalId: "t-1" }; }
    return this.fake.call(method, params);
  }
}
function setup(options: { ahub?: OrcaCompanionFixtureCliResponse[]; settings?: Record<string, unknown>; hostId?: string } = {}) {
  const hostId = options.hostId ?? "local";
  const base = realpathSync(mkdtempSync(join(tmpdir(), "ahub-orca-selection-"))); dirs.push(base);
  const a = join(base, "a"), b = join(base, "b"); mkdirSync(a); mkdirSync(b);
  const fake = new FakeOrcaCompanionHost({ offeredMethods: ["workspace.list", "workspace.open"], surface: "worker", capabilities: ["workspace:read", "workspace:write"],
    workspaces: [{ id: "ws-a", kind: "worktree", name: "a", path: a, branch: "main", hostId }, { id: "ws-b", kind: "folder", name: "b", path: b, branch: null, hostId }] });
  const host = new StoreHost(fake), cli = new FakeOrcaCompanionCli({ hostId: "local", scripted: options.ahub ?? [] });
  let settings = options.settings ?? { localHostIds: "local" };
  const instance = worker.createCompanion({ host, readSettings: async () => settings, spawnCli: cli.run, log: () => {} });
  return { a, b, fake, host, cli, instance, snapshot: { id: "ws-a", hostId, root: a, kind: "worktree" }, setSettings: (value: Record<string, unknown>) => { settings = value; } };
}

test("remember writes only the four binding fields, and only after they verify against a fresh inventory", async () => {
  const s = setup();
  expect(await s.instance.remember({ snapshot: s.snapshot })).toEqual({ ok: true });
  expect([...s.host.store.entries()]).toEqual([["selection", s.snapshot]]);
  const t = setup();
  expect(await t.instance.remember({ snapshot: { ...t.snapshot, root: t.b } })).toMatchObject({ ok: false, refusal: "changed" });
  expect(await t.instance.remember({ snapshot: { ...t.snapshot, name: "extra" } })).toMatchObject({ ok: false, refusal: "bad_request" });
  expect(await t.instance.remember({ snapshot: { ...t.snapshot, id: "ws-gone" } })).toMatchObject({ ok: false, refusal: "missing" });
  expect(t.host.store.size).toBe(0);
  t.host.storage = false;
  expect(await t.instance.remember({ snapshot: t.snapshot })).toMatchObject({ ok: false, refusal: "not_offered" });
});

test("the last of two overlapping remembers is the one kept, even when the first one's inventory read is slower", async () => {
  const s = setup(), b = { id: "ws-b", hostId: "local", root: s.b, kind: "folder" };
  s.host.slowNextList = 60;
  const first = s.instance.remember({ snapshot: s.snapshot }), second = s.instance.remember({ snapshot: b });
  expect(await first).toEqual({ ok: true }); expect(await second).toEqual({ ok: true });
  expect(s.host.store.get("selection")).toEqual(b);
});

test("recall returns the remembered selection only while it verifies, and drops one that names a different workspace", async () => {
  const s = setup();
  expect(await s.instance.recall(undefined)).toEqual({ ok: true, selection: null });
  await s.instance.remember({ snapshot: s.snapshot });
  expect(await s.instance.recall(undefined)).toEqual({ ok: true, selection: s.snapshot });
  s.fake.setRoster([{ id: "ws-a", kind: "worktree", name: "a", path: s.b, branch: "main", hostId: "local" }]); // the same id now points at another folder
  const changed = await s.instance.recall(undefined);
  expect(changed).toMatchObject({ ok: true, selection: null }); expect(changed.dropped).toContain("changed"); expect(s.host.store.size).toBe(0);
  s.host.store.set("selection", { id: "ws-a", extra: true });
  expect(await s.instance.recall(undefined)).toEqual({ ok: true, selection: null }); expect(s.host.store.size).toBe(0);
  expect(await s.instance.recall({})).toMatchObject({ ok: false, refusal: "bad_request" });
  s.host.storage = false;
  expect(await s.instance.recall(undefined)).toMatchObject({ ok: false, refusal: "not_offered" });
});

test("a command with nothing remembered runs nothing and says where to select", async () => {
  const s = setup();
  for (const id of Object.keys(worker.COMMANDS)) expect(await s.instance.runCommand(id)).toBe("Select a workspace in the agent-hub panel first. Nothing was run.");
  expect(s.cli.calls).toEqual([]); expect(s.host.terminals).toEqual([]); expect(s.host.calls).not.toContain("workspace.open");
  expect(await s.instance.runCommand("nope")).toBe("Unknown agent-hub command.");
});

test("Open console acts on the remembered workspace after re-verifying it", async () => {
  const s = setup(); await s.instance.remember({ snapshot: s.snapshot });
  expect(await s.instance.runCommand("open-console")).toContain("A terminal was created");
  expect(s.host.terminals).toEqual([expect.objectContaining({ workspaceId: "ws-a", command: "'ahub' 'console'" })]);
});

test("a remembered workspace that changed, vanished or became remote runs nothing; the first two are forgotten", async () => {
  const s = setup(); await s.instance.remember({ snapshot: s.snapshot });
  s.fake.setRoster([{ id: "ws-b", kind: "folder", name: "b", path: s.b, branch: null, hostId: "local" }]);
  expect(await s.instance.runCommand("open-console")).toBe("That workspace is no longer in Orca's list. Select again.");
  expect(s.host.store.size).toBe(0); expect(s.host.terminals).toEqual([]);
  const r = setup({ hostId: "ssh-1", settings: { localHostIds: "ssh-1" } }); await r.instance.remember({ snapshot: r.snapshot });
  r.setSettings({ localHostIds: "" }); // the SSH host is no longer declared to be this Mac
  expect(await r.instance.runCommand("open-dashboard")).toBe("This workspace is on another host. Run `ahub console` there; nothing was run on this Mac. Command: 'ahub' 'console'");
  expect(r.cli.calls).toEqual([]);
});

test("Open dashboard never returns the one-time link, and Show status answers in closed words", async () => {
  const link = "http://127.0.0.1:43111/auth?ticket=ONE-TIME-TICKET-9";
  const s = setup({ ahub: [{ stdout: `Open this one-time link within 60 seconds:\n${link}\n`, exitCode: 0 },
    { stdout: JSON.stringify({ version: "0.36.0", tasks: { in_progress: 2 }, peers: { codex: { state: "busy", queued: 1, attached: true, doing: "secret task" } } }), exitCode: 0 }] });
  await s.instance.remember({ snapshot: s.snapshot });
  const opened = await s.instance.runCommand("open-dashboard");
  expect(opened).toBe("ahub printed a one-time link, which a command cannot open. Open the dashboard from the agent-hub panel.");
  expect(opened).not.toContain("TICKET"); expect(JSON.stringify([...s.host.store.values()])).not.toContain("TICKET");
  const status = await s.instance.runCommand("show-status");
  expect(status).toBe("agent-hub 0.36.0: running. Tasks: 2 in_progress. Peers: codex busy (1 queued).");
  expect(status).not.toContain("secret");
});

test("activate registers every handler and every palette command", async () => {
  const handled: string[] = [], registered: string[] = [];
  const orca = { host: { call: async () => ({}), has: () => false }, log: () => {},
    panels: { handle: (name: string) => { handled.push(name); return { dispose() {} }; } },
    commands: { register: (id: string) => { registered.push(id); return { dispose() {} }; } } };
  const activated = await worker.default(orca);
  expect(handled).toContain("selection.remember"); expect(handled).toContain("selection.recall"); expect(handled).toContain("projects.read");
  expect(registered).toEqual(Object.keys(worker.COMMANDS));
  activated.dispose();
});
