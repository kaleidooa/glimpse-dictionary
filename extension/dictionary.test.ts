import { expect, it, vi } from "vitest";
import { defineWord, onlineDefinition, validWord } from "./dictionary";
const missing = async () => null;
it("uses local Korean results before any optional external lookup", async () => {
  const request = vi.fn();
  expect((await defineWord("curiosity", false, request)).language).toBe("ko");
  expect((await defineWord("resilient", true, request)).meaning).toContain(
    "회복",
  );
  expect(
    (await defineWord("zzqxnotaword", false, request, missing)).status,
  ).toBe("online-disabled");
  expect(request).not.toHaveBeenCalled();
});
it("sends only a missing encoded word without cookies, referrer, cache or redirects", async () => {
  const request = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify([
        {
          phonetic: "/test/",
          meanings: [
            {
              partOfSpeech: "noun",
              definitions: [{ definition: "A fortunate discovery." }],
            },
          ],
        },
      ]),
    ),
  );
  const result = await defineWord("Serendipity", true, request, missing);
  expect(result.meaning).toBe("A fortunate discovery.");
  expect(request).toHaveBeenCalledTimes(1);
  const [url, options] = request.mock.calls[0];
  expect(url).toBe(
    "https://api.dictionaryapi.dev/api/v2/entries/en/serendipity",
  );
  expect(options).toMatchObject({
    credentials: "omit",
    referrerPolicy: "no-referrer",
    cache: "no-store",
    redirect: "error",
  });
  expect(options.body).toBeUndefined();
});
it("rejects URL fragments, markup and nonword payloads before fetching", async () => {
  const request = vi.fn();
  for (const word of [
    "https://private.example",
    "<img>",
    "two words",
    "../secret",
    "a".repeat(81),
    "",
    "abc?token=secret",
    "한글",
  ]) {
    expect(validWord(word)).toBe(false);
    await expect(defineWord(word, true, request)).rejects.toThrow();
  }
  expect(request).not.toHaveBeenCalled();
});
it.each([
  [404, "not-found"],
  [429, "rate-limited"],
  [500, "service-error"],
])("distinguishes HTTP %s from vocabulary gaps", async (code, status) => {
  expect(
    (
      await onlineDefinition(
        "test",
        vi.fn().mockResolvedValue(new Response("", { status: Number(code) })),
      )
    ).status,
  ).toBe(status);
});
it("distinguishes timeouts and unreachable networks", async () => {
  expect(
    await onlineDefinition(
      "test",
      vi.fn().mockRejectedValue(new DOMException("slow", "TimeoutError")),
    ),
  ).toMatchObject({ status: "timeout" });
  expect(
    await onlineDefinition(
      "test",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    ),
  ).toMatchObject({ status: "network-error" });
});
it("handles malformed and empty API responses without inventing a definition", async () => {
  for (const data of [
    {},
    [],
    [{ meanings: [] }],
    [{ meanings: [{ definitions: [] }] }],
  ]) {
    expect(
      (
        await onlineDefinition(
          "test",
          vi.fn().mockResolvedValue(new Response(JSON.stringify(data))),
        )
      ).status,
    ).not.toBe("found");
  }
});
it("reports broken local files without disguising them as a vocabulary gap or sending words out", async () => {
  const request = vi.fn();
  const result = await defineWord("test", true, request, async () => {
    throw new Error("missing shard");
  });
  expect(result.status).toBe("data-error");
  expect(request).not.toHaveBeenCalled();
});
