import { it, expect } from "vitest";
import { evaluateTrial, metrics, toCsv, type TriggerLog } from "./experiment";
import type { WordBox } from "./selection";
it("scores token IDs, neighboring words, same lines, top-three and misses correctly", () => {
  const target = {
    id: 10,
    word: "word",
    left: 100,
    right: 160,
    top: 50,
    bottom: 80,
    line: 2,
  } as WordBox;
  const selected = { id: 11, word: "word", distance: 12, score: 0.7, line: 2 };
  const trial = evaluateTrial(
    target,
    selected,
    [selected, { ...selected, id: 10 }],
    null,
  );
  expect(trial.exactCorrect).toBe(false);
  expect(trial.adjacentCorrect).toBe(true);
  expect(trial.top3Correct).toBe(true);
  expect(trial.lineCorrect).toBe(true);
  expect(trial.pixelError).toBeNull();
  const missing = evaluateTrial(target, undefined, [], null);
  const result = metrics([{ trial }, { trial: missing }] as TriggerLog[]);
  expect(result.trials).toBe(2);
  expect(result.adjacent).toBe(0.5);
  expect(result.noPrediction).toBe(1);
  expect(result.medianError).toBeNull();
});
it("escapes CSV cells including multiline text and spreadsheet formulas", () => {
  const csv = toCsv([
    { sentence: '=bad,"quoted"\nnext', trial: null },
  ] as TriggerLog[]);
  expect(csv).toContain('"\'=bad,""quoted""\nnext"');
});
