/**
 * ניקוד: כל תוצאה נכונה (ניצחון או תיקו) = 3 נקודות. טעות = 0.
 * 1 = ניצחון בית, X = תיקו, 2 = ניצחון חוץ
 */
export function calcPoints(
  prediction: "1" | "X" | "2",
  homeScore: number,
  awayScore: number
): number {
  const actual = homeScore > awayScore ? "1" : homeScore < awayScore ? "2" : "X";
  return prediction === actual ? 3 : 0;
}

export function calcSubmissionPoints(
  predictions: Array<{ matchId: number; prediction: "1" | "X" | "2" }>,
  matchResults: Map<number, { homeScore: number; awayScore: number }>
): number {
  let total = 0;
  for (const p of predictions) {
    const res = matchResults.get(p.matchId);
    if (res) total += calcPoints(p.prediction, res.homeScore, res.awayScore);
  }
  return total;
}
