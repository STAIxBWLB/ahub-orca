import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createContext, runInContext } from "node:vm";

// Run the actual panel script with only DOM/host ports replaced. No Orca, CLI, browser, storage or real timers.
class Element {
  children: Element[] = [];
  textContent = "";
  className = "";
  type = "";
  disabled = false;
  hidden = false;
  value = "";
  tabIndex = 0;
  focused = false;
  removed = false;
  [key: string]: any;
  attributes = new Map<string, string>();
  listeners = new Map<string, (event?: any) => unknown>();
  append(...nodes: Element[]) { this.children.push(...nodes); }
  replaceChildren(...nodes: Element[]) { this.children = nodes; }
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  addEventListener(event: string, listener: (event?: any) => unknown) { this.listeners.set(event, listener); }
  click() { return Promise.resolve(this.listeners.get("click")?.()); }
  focus() { this.focused = true; }
  select() {}
  remove() { this.removed = true; }
  key(key: string, target: Element) { let prevented = false; this.listeners.get("keydown")?.({ key, target, preventDefault: () => { prevented = true; } }); return prevented; }
  input(value: string) { this.value = value; this.listeners.get("input")?.(); }
}
function deferred() {
  let resolve!: (value: unknown) => void, reject!: (error: Error) => void;
  const promise = new Promise<unknown>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const workspaces = ["a", "b"].map(id => ({ id, name: id, branch: "main", root: `/fixture/${id}`, hostId: "local", kind: "worktree", selectable: true }));
function fixture() {
  const elements = new Map(["rows", "status", "link", "refresh", "dashboard", "console", "family", "statusbtn", "statusbox", "statusline", "statuspeers", "statusnote",
    "filter", "offrows", "unavailable", "offcount", "cmdbox", "cmd", "copy", "statebadge"].map(id => [id, new Element()]));
  for (const id of ["dashboard", "console", "family", "statusbtn"]) elements.get(id)!.disabled = true;
  elements.get("link")!.hidden = true;
  elements.get("statusbox")!.hidden = true;
  const requests: { name: string; input: any; reply: ReturnType<typeof deferred> }[] = [];
  const external: { url: string; reply: ReturnType<typeof deferred> }[] = [];
  const timers = new Map<number, () => void>(); let nextTimer = 0;
  const documentEvents = new Map<string, () => void>(), windowEvents = new Map<string, () => void>();
  let now = 100000;
  const copies: string[] = []; let copyWorks = true; const selections: Element[] = []; const body = new Element();
  const context = createContext({
    document: { hidden: false, body, getElementById: (id: string) => elements.get(id), createElement: () => new Element(), addEventListener: (name: string, handler: () => void) => documentEvents.set(name, handler),
      execCommand: (command: string) => { if (command !== "copy" || !copyWorks) return false; copies.push(body.children.filter(child => !child.removed).at(-1)?.value ?? body.children.at(-1)!.value); return true; } },
    window: { addEventListener: (name: string, handler: () => void) => windowEvents.set(name, handler), getSelection: () => ({ selectAllChildren: (node: Element) => selections.push(node) }) },
    Date: { now: () => now },
    orca: { host: { has: (method: string) => method === "shell.openExternal" },
      plugin: { request(name: string, input: unknown) { const reply = deferred(); requests.push({ name, input, reply }); return reply.promise; } },
      shell: { openExternal(url: string) { const reply = deferred(); external.push({ url, reply }); return reply.promise; } } },
    setTimeout(callback: () => void) { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearTimeout(id: number) { timers.delete(id); },
  });
  const html = readFileSync(join(import.meta.dir, "../panel/index.html"), "utf8");
  const script = /<script type="module">([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!script || !/\nrefresh\(\);\s*$/.test(script)) throw Error("actual panel entry point missing");
  // Expose only the initial call's completion, without changing any panel decision or asynchronous branch.
  runInContext(script.replace(/\nrefresh\(\);\s*$/, "\nglobalThis.initialRefresh = refresh();"), context);
  const get = (id: string) => elements.get(id)!;
  const choose = (index: number) => get("rows").children[index]!.click();
  const state = () => runInContext("({selected, pendingLink, generation, reading})", context) as { selected: { id: string } | null; pendingLink: string | null; generation: number; reading: unknown };
  const initial = async () => { requests[0]!.reply.resolve({ ok: true, rows: workspaces }); await context.initialRefresh; };
  return { requests, external, timers, get, choose, state, initial, copies, selections, breakCopy: () => { copyWorks = false; }, listWith: async (rows: unknown[]) => { requests[0]!.reply.resolve({ ok: true, rows }); await context.initialRefresh; }, setNow: (value: number) => { now = value; }, focus: () => windowEvents.get("focus")?.(), visible: () => documentEvents.get("visibilitychange")?.() };
}
const linkReply = { ok: true, status: "link", url: "http://127.0.0.1:43111/auth?ticket=fixture-only" };
function noLink(f: ReturnType<typeof fixture>) {
  expect(f.state().pendingLink).toBeNull(); expect(f.get("link").hidden).toBe(true); expect(f.timers.size).toBe(0);
}

for (const result of ["link", "terminal", "refusal", "error"] as const) test(`actual Orca panel discards delayed A ${result} after B selection, including finally`, async () => {
  const f = fixture(); await f.initial(); await f.choose(0);
  const first = f.get("dashboard").click(), a = f.requests.at(-1)!;
  expect(a.name).toBe("entry.open"); expect(a.input.snapshot.id).toBe("a"); expect(Object.isFrozen(a.input.snapshot)).toBe(true);
  await f.choose(1);
  const second = f.get("console").click(), b = f.requests.at(-1)!;
  expect(b.input.snapshot.id).toBe("b"); expect(a.input.snapshot.id).toBe("a");
  if (result === "error") a.reply.reject(Error("fixture failure"));
  else a.reply.resolve(result === "link" ? linkReply : result === "terminal" ? { ok: true, status: "terminal_created" } : { ok: false, guidance: "OLD A FAILURE", command: "old command" });
  await first;
  expect(f.state().selected?.id).toBe("b"); expect(f.get("status").textContent).toBe("Opening...");
  for (const id of ["dashboard", "console", "family"]) expect(f.get(id).disabled).toBe(true);
  noLink(f); expect(f.external).toEqual([]);
  b.reply.resolve({ ok: true, status: "terminal_created" }); await second;
  expect(f.get("status").textContent).toContain("A terminal was created"); expect(f.get("console").disabled).toBe(false);
});

test("actual panel refresh invalidates selection immediately and rejects a late dashboard ticket", async () => {
  const f = fixture(); await f.initial(); await f.choose(0);
  const opening = f.get("dashboard").click(), old = f.requests.at(-1)!;
  const refresh = f.get("refresh").click(), listing = f.requests.at(-1)!;
  expect(f.state().selected).toBeNull(); expect(f.get("console").disabled).toBe(true);
  old.reply.resolve(linkReply); await opening;
  expect(f.get("status").textContent).toBe("Reading Orca's workspaces..."); noLink(f);
  listing.reply.resolve({ ok: true, rows: workspaces }); await refresh; await f.choose(1);
  expect(f.state().selected?.id).toBe("b"); expect(f.get("status").textContent).toBe("Selected. Choose a screen to open, or show its status.");
});

test("a new open invalidates the previous request even for the same selection", async () => {
  const f = fixture(); await f.initial(); await f.choose(0);
  const first = f.get("dashboard").click(), old = f.requests.at(-1)!;
  const second = f.get("family").click(), current = f.requests.at(-1)!;
  old.reply.resolve(linkReply); await first;
  expect(f.get("status").textContent).toBe("Opening..."); expect(f.get("family").disabled).toBe(true); noLink(f);
  current.reply.resolve({ ok: true, status: "terminal_created" }); await second;
  expect(f.get("status").textContent).toContain("A terminal was created");
});

test("an expired old link callback and delayed external-open reply cannot alter the new selection", async () => {
  const f = fixture(); await f.initial(); await f.choose(0);
  const opening = f.get("dashboard").click(); f.requests.at(-1)!.reply.resolve(linkReply); await opening;
  expect(f.get("link").hidden).toBe(false); const oldTimer = [...f.timers.values()][0]!;
  const navigation = f.get("link").click(); expect(f.external.map(value => value.url)).toEqual([linkReply.url]);
  await f.choose(1); const current = f.get("console").click();
  oldTimer(); f.external[0]!.reply.resolve({ opened: true }); await navigation;
  expect(f.get("status").textContent).toBe("Opening..."); expect(f.get("console").disabled).toBe(true); noLink(f);
  f.requests.at(-1)!.reply.resolve({ ok: true, status: "terminal_created" }); await current;
  expect(f.get("status").textContent).toContain("A terminal was created");
});

test("a delayed failed refresh cannot erase a newer refresh and its selection", async () => {
  const f = fixture(); await f.initial();
  const oldRefresh = f.get("refresh").click(), old = f.requests.at(-1)!;
  const freshRefresh = f.get("refresh").click(); f.requests.at(-1)!.reply.resolve({ ok: true, rows: workspaces }); await freshRefresh;
  await f.choose(1); old.reply.reject(Error("fixture failure")); await oldRefresh;
  expect(f.get("rows").children).toHaveLength(2); expect(f.state().selected?.id).toBe("b");
  expect(f.get("status").textContent).toBe("Selected. Choose a screen to open, or show its status."); expect(f.get("console").disabled).toBe(false); noLink(f);
});

const statusReply = (tasks: number) => ({ ok: true, state: "running", version: "0.35.0", tasks: { pending: tasks }, peers: [{ id: "codex", state: "idle", attached: true, queued: 0 }], missing: [], fetchedAt: 100000 });
function settleStatus(request: ReturnType<typeof fixture>["requests"][number], outcome: "success" | "refusal" | "error") {
  if (outcome === "error") request.reply.reject(Error("old status fixture failure"));
  else request.reply.resolve(outcome === "success" ? statusReply(41) : { ok: false, guidance: "OLD STATUS REFUSAL" });
}
for (const boundary of ["selection", "refresh", "new-status"] as const) {
  for (const outcome of ["success", "refusal", "error"] as const) test(`actual panel discards delayed status ${outcome} after ${boundary}`, async () => {
    const f = fixture(); await f.initial(); await f.choose(0);
    const first = f.get("statusbtn").click(), old = f.requests.at(-1)!;
    expect(old.name).toBe("status.read"); expect(old.input.snapshot.id).toBe("a"); expect(Object.isFrozen(old.input.snapshot)).toBe(true);
    if (boundary === "refresh") {
      const refreshing = f.get("refresh").click(), listing = f.requests.at(-1)!;
      settleStatus(old, outcome); await first;
      expect(f.state().selected).toBeNull(); expect(f.state().reading).toBeNull(); expect(f.get("statusbox").hidden).toBe(true);
      expect(f.get("status").textContent).toBe("Reading Orca's workspaces..."); expect(f.get("statusbtn").disabled).toBe(true); noLink(f);
      listing.reply.resolve({ ok: true, rows: workspaces }); await refreshing;
      return;
    }
    if (boundary === "selection") await f.choose(1);
    const current = f.get("statusbtn").click(), fresh = f.requests.at(-1)!;
    expect(fresh.input.snapshot.id).toBe(boundary === "selection" ? "b" : "a"); expect(old.input.snapshot.id).toBe("a");
    fresh.reply.resolve(statusReply(7)); await current;
    const line = f.get("statusline").textContent;
    expect(line).toContain("7 pending"); expect(f.get("statusbox").hidden).toBe(false);
    settleStatus(old, outcome); await first;
    expect<unknown>(f.state().reading).toEqual(statusReply(7)); expect(f.get("statusline").textContent).toBe(line);
    expect(f.get("statusbox").hidden).toBe(false); expect(f.get("statuspeers").children).toHaveLength(1);
    expect(f.get("status").textContent).toBe("Status read."); expect(f.get("status").className).toBe("");
    expect(f.get("statusbtn").disabled).toBe(false); noLink(f);
  });
}
for (const outcome of ["success", "refusal", "error"] as const) test(`old status ${outcome} cannot enable controls while B status is pending`, async () => {
  const f = fixture(); await f.initial(); await f.choose(0);
  const first = f.get("statusbtn").click(), old = f.requests.at(-1)!;
  await f.choose(1); const current = f.get("statusbtn").click(), fresh = f.requests.at(-1)!;
  settleStatus(old, outcome); await first;
  expect(f.get("status").textContent).toBe("Reading status..."); expect(f.state().reading).toBeNull(); expect(f.get("statusbox").hidden).toBe(true);
  for (const id of ["dashboard", "console", "family", "statusbtn"]) expect(f.get(id).disabled).toBe(true);
  fresh.reply.resolve(statusReply(7)); await current; expect(f.get("statusbtn").disabled).toBe(false);
});

test("starting status drops the previous generation's ticket; its cleared timer cannot affect status", async () => {
  const f = fixture(); await f.initial(); await f.choose(0);
  const opening = f.get("dashboard").click(); f.requests.at(-1)!.reply.resolve(linkReply); await opening;
  const expired = [...f.timers.values()][0]!;
  const reading = f.get("statusbtn").click(); noLink(f); expired();
  expect(f.get("status").textContent).toBe("Reading status..."); expect(f.external).toEqual([]);
  f.requests.at(-1)!.reply.resolve(statusReply(7)); await reading; expect(f.get("status").textContent).toBe("Status read.");
});

test("status aging is context driven and refresh clears the old reading immediately without polling", async () => {
  const f = fixture(); await f.initial(); await f.choose(0);
  const reading = f.get("statusbtn").click(); f.requests.at(-1)!.reply.resolve(statusReply(7)); await reading;
  const requests = f.requests.length; f.setNow(161001); f.focus(); f.visible();
  expect(f.get("statusline").textContent).toContain("stale"); expect(f.get("statusnote").textContent).toContain("Click Show status");
  expect(f.requests).toHaveLength(requests); expect(f.timers.size).toBe(0);
  const refreshing = f.get("refresh").click(); expect(f.state().reading).toBeNull(); expect(f.get("statusbox").hidden).toBe(true);
  f.requests.at(-1)!.reply.resolve({ ok: true, rows: workspaces }); await refreshing;
});

// #5 U2: keyboard selection, filter, copy command, the unavailable fold and the version label.
const many = Array.from({ length: 10 }, (_, i) => ({ id: "w" + i, name: i === 7 ? "billing api" : "w" + i, branch: "main", root: `/fixture/w${i}`, hostId: "local", kind: "worktree", selectable: true }));
const remoteRow = { id: "r", name: "remote one", branch: null, root: "/srv/r", hostId: "ssh-box", kind: "worktree", selectable: false, refusal: "remote", guidance: "This workspace is on another host.", command: "'ahub' 'console'" };

test("U2: arrow keys move focus between rows and Enter selects exactly as a click does", async () => {
  const f = fixture(); await f.initial();
  const rows = f.get("rows"), [a, b] = rows.children as any[];
  expect(a.tabIndex).toBe(0); expect(b.tabIndex).toBe(-1); expect(a.attributes.get("role")).toBe("option");
  expect(rows.key("ArrowDown", a)).toBe(true); expect(b.focused).toBe(true); expect(b.tabIndex).toBe(0); expect(a.tabIndex).toBe(-1);
  expect(rows.key("ArrowDown", b)).toBe(true); expect(b.tabIndex).toBe(0); // stays on the last row
  expect(f.state().selected).toBeNull();
  rows.key("Enter", b);
  expect(f.state().selected?.id).toBe("b"); expect(b.attributes.get("aria-selected")).toBe("true"); expect(a.attributes.get("aria-selected")).toBe("false");
  expect(f.get("console").disabled).toBe(false); expect(f.requests).toHaveLength(1); // selecting asks the worker nothing
  rows.key(" ", a); expect(f.state().selected?.id).toBe("a");
  expect(rows.key("x", a)).toBe(false);
});

test("U2: the filter appears only for more than 8 rows and hides rows that do not match every word", async () => {
  const small = fixture(); await small.initial(); expect(small.get("filter").hidden).toBe(true);
  const f = fixture(); await f.listWith(many);
  const filter = f.get("filter"), rows = f.get("rows").children;
  expect(filter.hidden).toBe(false);
  filter.input("BILLING api"); expect(rows.filter(li => !li.hidden).map(li => li.searchText)).toEqual([expect.stringContaining("billing api")]);
  filter.input("w3 /fixture"); expect(rows.filter(li => !li.hidden)).toHaveLength(1);
  filter.input(""); expect(rows.filter(li => !li.hidden)).toHaveLength(10);
  // a filtered-out row is skipped by the arrow keys
  filter.input("w1"); const visible = rows.filter(li => !li.hidden); expect(visible).toHaveLength(1);
  f.get("rows").key("ArrowDown", visible[0]!); expect(visible[0]!.focused).toBe(true);
});

test("U2: rows that cannot be opened fold away with their reason and a copy of the worker's command", async () => {
  const f = fixture(); await f.listWith([workspaces[0], remoteRow]);
  expect(f.get("rows").children).toHaveLength(1); expect(f.get("unavailable").hidden).toBe(false);
  expect(f.get("offcount").textContent).toBe("1 not available on this Mac");
  const off = f.get("offrows").children[0]!, copy = off.children.at(-1)!;
  expect(off.children.map(c => c.textContent)).toContain("This workspace is on another host.");
  await copy.click(); expect(f.copies).toEqual(["'ahub' 'console'"]); expect(copy.textContent).toBe("Copied");
  expect(f.requests).toHaveLength(1); // copying asks the worker nothing and runs nothing
  const none = fixture(); await none.listWith([remoteRow]);
  expect(none.get("status").textContent).toContain("No workspace can be opened on this Mac");
});

test("U2: a refusal that carries a command shows it with Copy command; a failed copy leaves it selected", async () => {
  const f = fixture(); await f.initial(); await f.choose(0);
  const opening = f.get("console").click(); f.requests.at(-1)!.reply.resolve({ ok: false, refusal: "remote", guidance: "This workspace is on another host.", command: "'ahub' 'console'" }); await opening;
  expect(f.get("status").className).toBe("bad"); expect(f.get("cmdbox").hidden).toBe(false); expect(f.get("cmd").textContent).toBe("'ahub' 'console'");
  await f.get("copy").click(); expect(f.copies).toEqual(["'ahub' 'console'"]); expect(f.get("copy").textContent).toBe("Copied");
  f.breakCopy(); await f.get("copy").click();
  expect(f.copies).toHaveLength(1); expect(f.selections).toEqual([f.get("cmd")]); expect(f.get("copy").textContent).toBe("Press Cmd+C to copy");
  // the next message drops the command
  await f.choose(1); expect(f.get("cmdbox").hidden).toBe(true); expect(f.get("cmd").textContent).toBe("");
});

test("U2: the status state is a badge, and the header shows the manifest version", async () => {
  const f = fixture(); await f.initial(); await f.choose(0);
  const reading = f.get("statusbtn").click(); f.requests.at(-1)!.reply.resolve(statusReply(3)); await reading;
  expect(f.get("statebadge").textContent).toBe("running"); expect(f.get("statebadge").className).toBe("badge good");
  expect(f.get("statuspeers").children[0]!.children.map(c => c.textContent)).toEqual(["codex ", "idle", "0 queued"]);
  f.setNow(161001); f.focus(); expect(f.get("statebadge").textContent).toBe("stale"); expect(f.get("statebadge").className).toBe("badge");
  const html = readFileSync(join(import.meta.dir, "../panel/index.html"), "utf8");
  const version = JSON.parse(readFileSync(join(import.meta.dir, "../orca-plugin.json"), "utf8")).version;
  expect(/<span class="ver">([^<]+)<\/span>/.exec(html)?.[1]).toBe(version);
});
