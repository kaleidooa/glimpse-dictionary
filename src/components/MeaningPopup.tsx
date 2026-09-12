import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { BrowserDefinitionProvider, type Definition } from "../lib/definitions";
import type { WordBox } from "../lib/selection";
const provider = new BrowserDefinitionProvider();
export function MeaningPopup({
  word,
  triggerId,
  onClose,
}: {
  word: WordBox;
  triggerId: string;
  onClose: () => void;
}) {
  const [definition, setDefinition] = useState<Definition | null>(null),
    [position, setPosition] = useState({
      left: word.left,
      top: word.bottom + 8,
    });
  const element = useRef<HTMLDivElement>(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    let cancelled = false;
    setDefinition(null);
    void provider.getDefinition(word.word, word.sentence).then((d) => {
      if (!cancelled) setDefinition(d);
    });
    const timeout = setTimeout(() => closeRef.current(), 12000);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [triggerId, word.word, word.sentence]);
  useLayoutEffect(() => {
    if (!element.current) return;
    const r = element.current.getBoundingClientRect();
    setPosition({
      left: Math.max(12, Math.min(word.left, innerWidth - r.width - 12)),
      top:
        word.bottom + r.height + 12 < innerHeight
          ? word.bottom + 8
          : Math.max(12, word.top - r.height - 8),
    });
  }, [definition, word]);
  useEffect(() => {
    const click = (e: PointerEvent) => {
      if (!element.current?.contains(e.target as Node)) closeRef.current();
    };
    window.addEventListener("pointerdown", click);
    return () => window.removeEventListener("pointerdown", click);
  }, []);
  return (
    <div
      ref={element}
      className="meaning-popup"
      style={position}
      role="status"
      aria-live="polite"
    >
      <div className="meaning-heading">
        <strong>{word.word}</strong>
        <span>{definition?.phonetic}</span>
        <button aria-label="뜻 닫기" onClick={onClose}>
          <X size={13} />
        </button>
      </div>
      {definition?.matchedBy === "inflection" && (
        <small>
          원형:{" "}
          {(definition.lemmas ?? [definition.lemma])
            .filter(
              (item) => item?.toLowerCase() !== definition.word.toLowerCase(),
            )
            .join(" · ")}
        </small>
      )}
      {definition?.senses?.length ? (
        definition.senses.slice(0, 3).map((sense, i) => (
          <p key={i}>
            <small>{sense.partOfSpeech} </small>
            {sense.meaning}
          </p>
        ))
      ) : (
        <p>{definition ? definition.meaning : "뜻을 찾고 있어요…"}</p>
      )}
      <div className="meaning-source">
        {definition?.partOfSpeech && <span>{definition.partOfSpeech} · </span>}
        {definition?.source ?? "DICTIONARY"}
        {definition?.sourceLinks?.map((link) => (
          <span key={link.url}>
            {" "}
            ·{" "}
            <a href={link.url} target="_blank" rel="noreferrer noopener">
              {link.label} 출처
            </a>
          </span>
        ))}
        <span className="escape-hint">ESC</span>
      </div>
    </div>
  );
}
