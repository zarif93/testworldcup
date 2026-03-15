/**
 * Phase 16: Step 5 — Scoring rules preview + optional overrides (points per correct, bonus, tie-break).
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ScoringStepState {
  /** Optional override: points per correct (e.g. 3 for 1X2) */
  pointsPerCorrect: string;
  /** Optional JSON override for full config */
  scoringJsonOverride: string;
}

interface CompetitionWizardScoringStepProps {
  value: ScoringStepState;
  onChange: (v: ScoringStepState) => void;
  /** Preview from type */
  previewSummary?: string | null;
  legacyType?: string | null;
}

export function CompetitionWizardScoringStep({ value, onChange, previewSummary, legacyType }: CompetitionWizardScoringStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-sm">
        חוקי ניקוד נקבעים לפי סוג התחרות. ניתן להתאים נקודות לדריסה ולכללי tie-break.
      </p>
      {previewSummary && (
        <p className="text-slate-300 text-sm rounded-lg bg-slate-800/50 p-3">{previewSummary}</p>
      )}
      <div className="space-y-2">
        <Label className="text-slate-300">נקודות לתשובה נכונה (אופציונלי, ריק = מהסוג)</Label>
        <Input
          type="number"
          min={0}
          className="bg-slate-800 text-white border-slate-600 w-24"
          placeholder="למשל 3"
          value={value.pointsPerCorrect}
          onChange={(e) => onChange({ ...value, pointsPerCorrect: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-slate-300">דריסת תצורת ניקוד (JSON, אופציונלי)</Label>
        <textarea
          className="w-full rounded-lg px-3 py-2 bg-slate-800 text-white border border-slate-600 font-mono text-sm min-h-[80px]"
          placeholder='{}'
          value={value.scoringJsonOverride}
          onChange={(e) => onChange({ ...value, scoringJsonOverride: e.target.value })}
        />
      </div>
      {legacyType && !previewSummary && (
        <p className="text-slate-500 text-sm">סוג: {legacyType}. ברירת מחדל תוחל.</p>
      )}
    </div>
  );
}

export const DEFAULT_SCORING_STEP: ScoringStepState = {
  pointsPerCorrect: "",
  scoringJsonOverride: "",
};
