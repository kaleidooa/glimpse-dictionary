import { useState, type FormEvent } from "react";
import type { Definition } from "../lib/definition-types";
import { vocabularyClient } from "../lib/vocabulary-client";

export function DictionaryCheck({
  lookup,
}: {
  lookup: (word: string) => Promise<Definition>;
}) {
  const [word, setWord] = useState("serendipity");
  const [result, setResult] = useState<Definition | null>(null);
  const [busy, setBusy] = useState(false),
    [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false),
    [saving, setSaving] = useState(false);
  async function search(event?: FormEvent, sample?: string) {
    event?.preventDefault();
    const query = (sample ?? word).trim();
    if (busy || saving) return;
    if (!/^[A-Za-z]+(?:['’\-][A-Za-z]+)*$/.test(query) || query.length > 80) {
      setError("영어 단어 하나를 입력해 주세요.");
      return;
    }
    if (sample) setWord(sample);
    setBusy(true);
    setError("");
    setResult(null);
    setSaved(false);
    const started = performance.now();
    try {
      setResult(await lookup(query));
      setElapsed(Math.round(performance.now() - started));
    } catch {
      setError("사전을 읽지 못했습니다. 페이지를 새로고침해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="product-panel dictionary-check"
      aria-label="사전 직접 확인"
    >
      <span className="eyebrow">51,109 HEADWORDS · OFFLINE</span>
      <h3>궁금한 단어로 확인하기.</h3>
      <p>영한 사전은 처음부터 켜져 있어요. 품사와 여러 뜻을 함께 확인하세요.</p>
      <form onSubmit={search}>
        <input
          aria-label="확인할 영어 단어"
          value={word}
          maxLength={80}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setWord(e.target.value)}
        />
        <button disabled={busy || saving} type="submit">
          {busy ? "조회 중" : "조회"}
        </button>
      </form>
      <div className="dictionary-examples">
        {["serendipity", "resilient", "went", "children", "ambiguous"].map(
          (sample) => (
            <button
              disabled={busy || saving}
              key={sample}
              onClick={() => void search(undefined, sample)}
            >
              {sample}
            </button>
          ),
        )}
      </div>
      <div className="dictionary-answer" role="status" aria-live="polite">
        {error && <p>{error}</p>}
        {result && (
          <>
            <strong>{result.word}</strong>
            {result.matchedBy === "inflection" && (
              <small>
                원형:{" "}
                {(result.lemmas ?? [result.lemma])
                  .filter(
                    (item) => item?.toLowerCase() !== result.word.toLowerCase(),
                  )
                  .join(" · ")}
              </small>
            )}
            {result.senses?.length ? (
              <ol>
                {result.senses.map((sense, i) => (
                  <li key={i}>
                    {sense.partOfSpeech && <small>{sense.partOfSpeech} </small>}
                    {sense.meaning}
                  </li>
                ))}
              </ol>
            ) : (
              <p>{result.meaning}</p>
            )}
            <small>
              {result.source} · {elapsed}ms · {result.license}
            </small>
            {(
              result.sourceLinks ??
              (result.sourceUrl
                ? [{ label: "사전 출처", url: result.sourceUrl }]
                : [])
            ).map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                {link.label} 출처 ↗
              </a>
            ))}
            {result.status === "found" && (
              <>
                <button
                  className="save-word"
                  disabled={saved || saving}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await vocabularyClient.save(result);
                      setSaved(true);
                    } catch (error) {
                      setError(
                        error instanceof Error
                          ? error.message
                          : "저장하지 못했습니다.",
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saved
                    ? "단어장에 저장됨 ✓"
                    : saving
                      ? "저장 중…"
                      : "단어장에 저장"}
                </button>
                {saved && (
                  <a href="./dashboard.html#words">내 단어장 열기 ↗</a>
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
