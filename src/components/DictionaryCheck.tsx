import { definitionLabel } from "../lib/definition-labels";
import { t as tr } from "../lib/i18n";
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
      setError(
        tr("Enter one English word.", "영어 단어 하나를 입력해 주세요."),
      );
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
      setError(
        tr(
          "Could not read the dictionary. Refresh the page.",
          "사전을 읽지 못했습니다. 페이지를 새로고침해 주세요.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="product-panel dictionary-check"
      aria-label={tr("Dictionary lookup", "사전 직접 확인")}
    >
      <span className="eyebrow">51,109 HEADWORDS · OFFLINE</span>
      <h3>{tr("Try a word.", "궁금한 단어로 확인하기.")}</h3>
      <p>
        {tr(
          "The offline English-to-Korean dictionary is ready. Results include parts of speech and multiple senses.",
          "영한 사전은 처음부터 켜져 있어요. 품사와 여러 뜻을 함께 확인하세요.",
        )}
      </p>
      <form onSubmit={search}>
        <input
          aria-label={tr("English word to look up", "확인할 영어 단어")}
          value={word}
          maxLength={80}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => setWord(e.target.value)}
        />
        <button disabled={busy || saving} type="submit">
          {busy ? tr("Looking up…", "조회 중") : tr("Look up", "조회")}
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
                {tr("Base form:", "원형:")}{" "}
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
                    {definitionLabel(sense.partOfSpeech) && (
                      <small>{definitionLabel(sense.partOfSpeech)} </small>
                    )}
                    {sense.meaning}
                  </li>
                ))}
              </ol>
            ) : (
              <p>{result.meaning}</p>
            )}
            <small>
              {definitionLabel(result.source)} · {elapsed}ms · {result.license}
            </small>
            {(
              result.sourceLinks ??
              (result.sourceUrl
                ? [
                    {
                      label: tr("Dictionary source", "사전 출처"),
                      url: result.sourceUrl,
                    },
                  ]
                : [])
            ).map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                {link.label} {tr("source ↗", "출처 ↗")}{" "}
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
                          : tr(
                              "Could not save the word.",
                              "저장하지 못했습니다.",
                            ),
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saved
                    ? tr("Word saved ✓", "단어장에 저장됨 ✓")
                    : saving
                      ? tr("Saving…", "저장 중…")
                      : tr("Save word", "단어장에 저장")}
                </button>
                {saved && (
                  <a href="./dashboard.html#words">
                    {tr("Open my words ↗", "내 단어장 열기 ↗")}
                  </a>
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
