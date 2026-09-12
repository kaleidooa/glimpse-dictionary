import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.mock("../src/lib/local-lexicon", () => ({
  localLexicon: { lookup: vi.fn(async () => null) },
}));
type Callback = (...args: any[]) => any;
function event() {
  const listeners: Callback[] = [];
  return {
    addListener: (fn: Callback) => listeners.push(fn),
    fire: (...args: any[]) => listeners.forEach((fn) => fn(...args)),
    listeners,
  };
}
let api: any, settings: Record<string, any>, permissions: Set<string>;
beforeEach(async () => {
  vi.resetModules();
  settings = {};
  permissions = new Set();
  api = {
    runtime: {
      id: "test-id",
      getURL: (path: string) => "chrome-extension://test-id/" + path,
      onMessage: event(),
      onInstalled: event(),
      onStartup: event(),
    },
    commands: { onCommand: event() },
    storage: {
      local: {
        get: vi.fn(async () => settings),
        set: vi.fn(async (value: Record<string, unknown>) =>
          Object.assign(settings, value),
        ),
      },
      onChanged: event(),
    },
    permissions: {
      contains: vi.fn(async ({ origins }: { origins: string[] }) =>
        origins.every((o) => permissions.has(o)),
      ),
      onAdded: event(),
      onRemoved: event(),
    },
    scripting: {
      getRegisteredContentScripts: vi.fn(async () => []),
      registerContentScripts: vi.fn(async () => {}),
      updateContentScripts: vi.fn(async () => {}),
      unregisterContentScripts: vi.fn(async () => {}),
      executeScript: vi.fn(async () => []),
    },
    tabs: {
      query: vi.fn(async () => [{ id: 7 }]),
      sendMessage: vi.fn(async () => ({ ready: true })),
      create: vi.fn(async () => {}),
    },
    action: {
      setBadgeText: vi.fn(async () => {}),
      setTitle: vi.fn(async () => {}),
    },
  };
  vi.stubGlobal("chrome", api);
  vi.stubGlobal("fetch", vi.fn());
  await import("./background");
});
afterEach(() => vi.unstubAllGlobals());
const sender = {
  id: "test-id",
  tab: { id: 7 },
  url: "https://example.com/private",
};
function message(payload: unknown, from: unknown = sender) {
  return new Promise<any>((resolve) => {
    const accepted = api.runtime.onMessage.listeners[0](payload, from, resolve);
    if (!accepted) resolve(undefined);
  });
}
it("rejects other senders and malformed word messages before making requests", async () => {
  expect(
    await message(
      { type: "GLIMPSE_DEFINE", word: "curiosity" },
      { id: "other-id", tab: { id: 7 } },
    ),
  ).toBeUndefined();
  expect(
    await message({ type: "GLIMPSE_DEFINE", word: "private?token=123" }),
  ).toBeUndefined();
  expect(fetch).not.toHaveBeenCalled();
});
it("shares only the interface language with content scripts and broadcasts language changes", async () => {
  expect(await message({ type: "GLIMPSE_GET_LOCALE" })).toBe("en");
  settings["glimpse.language"] = "ko";
  api.storage.onChanged.fire(
    { "glimpse.language": { newValue: "ko" } },
    "local",
  );
  await Promise.resolve();
  expect(api.tabs.sendMessage).toHaveBeenCalledWith(7, {
    type: "GLIMPSE_LOCALE",
    locale: "ko",
  });
  expect(await message({ type: "GLIMPSE_GET_LOCALE" })).toBe("ko");
  expect(await message({ type: "GLIMPSE_WORDS_LIST" })).toBeUndefined();
  expect(
    (await message({ type: "GLIMPSE_DEFINE", word: "missingword" })).meaning,
  ).toContain("기기 사전");
  expect(fetch).not.toHaveBeenCalled();
});
it("requires both the online setting and host permission for external dictionary traffic", async () => {
  settings.online = true;
  expect(
    (await message({ type: "GLIMPSE_DEFINE", word: "serendipity" })).source,
  ).toBe("Online lookup off");
  permissions.add("https://api.dictionaryapi.dev/*");
  settings.online = false;
  expect(
    (await message({ type: "GLIMPSE_DEFINE", word: "serendipity" })).source,
  ).toBe("Online lookup off");
  expect(fetch).not.toHaveBeenCalled();
});
it("does not grant page messages the ability to activate other tabs or stop readers", async () => {
  expect(
    await message({ type: "GLIMPSE_ACTIVATE", tabId: 123 }),
  ).toBeUndefined();
  expect(await message({ type: "GLIMPSE_STOP" })).toBeUndefined();
  expect(await message({ type: "GLIMPSE_CHECK_ONLINE" })).toBeUndefined();
  expect(await message({ type: "GLIMPSE_WORDS_LIST" })).toBeUndefined();
  expect(
    await message({ type: "GLIMPSE_WORD_REMOVE", word: "test" }),
  ).toBeUndefined();
  expect(
    await message({ type: "GLIMPSE_WORDS_IMPORT", text: "{}" }),
  ).toBeUndefined();
  expect(api.scripting.executeScript).not.toHaveBeenCalled();
});
it("allows the wordbook only in trusted extension pages, including an options tab", async () => {
  const result = await message(
    { type: "GLIMPSE_WORDS_LIST" },
    {
      id: "test-id",
      tab: { id: 8 },
      url: "chrome-extension://test-id/lab/dashboard.html#words",
    },
  );
  expect(result).toEqual({ ok: true, value: [] });
});
it("opens first-use help only on install and does not register scripts when a word is saved", async () => {
  api.runtime.onInstalled.fire({ reason: "update" });
  expect(api.tabs.create).not.toHaveBeenCalled();
  api.runtime.onInstalled.fire({ reason: "install" });
  expect(api.tabs.create).toHaveBeenCalledWith({
    url: "chrome-extension://test-id/lab/dashboard.html#start",
  });
  api.scripting.getRegisteredContentScripts.mockClear();
  api.storage.onChanged.fire({ "glimpse.vocabulary.v1": {} }, "local");
  expect(api.scripting.getRegisteredContentScripts).not.toHaveBeenCalled();
});
it("allows the explicit connection diagnostic only with consent and permission", async () => {
  const popup = { id: "test-id", url: "chrome-extension://test-id/popup.html" };
  expect((await message({ type: "GLIMPSE_CHECK_ONLINE" }, popup)).status).toBe(
    "online-disabled",
  );
  expect(fetch).not.toHaveBeenCalled();
  settings.online = true;
  permissions.add("https://api.dictionaryapi.dev/*");
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      JSON.stringify([
        {
          meanings: [
            { definitions: [{ definition: "An unexpected discovery." }] },
          ],
        },
      ]),
    ),
  );
  expect((await message({ type: "GLIMPSE_CHECK_ONLINE" }, popup)).status).toBe(
    "found",
  );
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("falls back to the authorized top frame when a cross-origin frame rejects injection", async () => {
  api.scripting.executeScript.mockRejectedValueOnce(
    new Error("Cannot access frame"),
  );
  const result = await message(
    { type: "GLIMPSE_ACTIVATE", tabId: 7 },
    { id: "test-id", url: "chrome-extension://test-id/popup.html" },
  );
  expect(result.ok).toBe(true);
  expect(api.scripting.executeScript).toHaveBeenLastCalledWith({
    target: { tabId: 7, frameIds: [0] },
    files: ["content.js"],
  });
});
it("registers only explicitly chosen and actually granted site patterns", async () => {
  settings.siteOrigins = [
    "https://allowed.example/*",
    "https://denied.example/*",
  ];
  permissions.add("https://allowed.example/*");
  permissions.add("https://api.dictionaryapi.dev/*");
  await message(
    { type: "GLIMPSE_ACTIVATE", tabId: 7 },
    { id: "test-id", url: "chrome-extension://test-id/popup.html" },
  );
  expect(api.scripting.registerContentScripts).toHaveBeenCalledWith([
    expect.objectContaining({
      matches: ["https://allowed.example/*"],
      allFrames: true,
      persistAcrossSessions: true,
    }),
  ]);
});
it("registers nothing on a clean install or when only online dictionary access is granted", async () => {
  settings.online = true;
  permissions.add("https://api.dictionaryapi.dev/*");
  await message(
    { type: "GLIMPSE_ACTIVATE", tabId: 7 },
    { id: "test-id", url: "chrome-extension://test-id/popup.html" },
  );
  expect(api.scripting.registerContentScripts).not.toHaveBeenCalled();
});
