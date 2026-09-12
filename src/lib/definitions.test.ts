import { afterEach, it, expect, vi } from "vitest";
import { BrowserDefinitionProvider } from "./definitions";
afterEach(() => vi.unstubAllGlobals());
it("uses the same local dictionary in the eye lab without an API request", async () => {
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  const result = await new BrowserDefinitionProvider().getDefinition(
    "tenuous",
    "A tenuous claim.",
  );
  expect(result.language).toBe("ko");
  expect(result.meaning).toContain("근거가 약한");
  expect(request).not.toHaveBeenCalled();
});
it("does not silently send missing vocabulary to an external provider", async () => {
  const request = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ enabled: false })));
  vi.stubGlobal("fetch", request);
  expect(
    (
      await new BrowserDefinitionProvider(async () => null).getDefinition(
        "unknown",
        "A private sentence.",
      )
    ).status,
  ).toBe("online-disabled");
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][0]).toBe("/api/definition/status");
});
it("retains the explicitly configured localhost LLM fallback and memory cache", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ enabled: true })))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ meaning: "실험용 문맥 뜻" })),
    );
  vi.stubGlobal("fetch", request);
  const provider = new BrowserDefinitionProvider(async () => null);
  const first = await provider.getDefinition("test", "A test sentence.");
  expect(first.meaning).toBe("실험용 문맥 뜻");
  expect(await provider.getDefinition("test", "A test sentence.")).toEqual(
    first,
  );
  expect(request).toHaveBeenCalledTimes(2);
});
