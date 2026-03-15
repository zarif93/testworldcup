/**
 * Phase 16: Step 6 — Settlement: prize mode, distribution %, tie handling, minimum participants.
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type PrizeModeOption = "first" | "top3" | "custom";

export interface SettlementStepState {
  prizeMode: PrizeModeOption;
  prize1: string;
  prize2: string;
  prize3: string;
  minParticipants: string;
  tieHandling: "split" | "first_wins";
}

interface CompetitionWizardSettlementStepProps {
  value: SettlementStepState;
  onChange: (v: SettlementStepState) => void;
  errors?: Partial<Record<keyof SettlementStepState, string>>;
}

export function CompetitionWizardSettlementStep({ value, onChange, errors }: CompetitionWizardSettlementStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-sm">
        הגדר חלוקת פרסים, מינימום משתתפים לטובת חלוקה, ואופן טיפול בתיקו.
      </p>
      <div className="space-y-2">
        <Label className="text-slate-300">מצב פרסים</Label>
        <select
          className="w-full rounded-lg px-3 py-2 bg-slate-800 text-white border border-slate-600"
          value={value.prizeMode}
          onChange={(e) => onChange({ ...value, prizeMode: e.target.value as PrizeModeOption })}
        >
          <option value="first">מנצח יחיד (100%)</option>
          <option value="top3">טופ 3 (התאמה ידנית)</option>
          <option value="custom">התאמה מותאמת (JSON בהמשך)</option>
        </select>
      </div>
      {value.prizeMode === "top3" && (
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-slate-300">מקום 1 (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              className="bg-slate-800 text-white border-slate-600"
              value={value.prize1}
              onChange={(e) => onChange({ ...value, prize1: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">מקום 2 (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              className="bg-slate-800 text-white border-slate-600"
              value={value.prize2}
              onChange={(e) => onChange({ ...value, prize2: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300">מקום 3 (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              className="bg-slate-800 text-white border-slate-600"
              value={value.prize3}
              onChange={(e) => onChange({ ...value, prize3: e.target.value })}
            />
          </div>
        </div>
      )}
      <div className="space-y-2">
        <Label className="text-slate-300">מינימום משתתפים לחלוקת פרסים</Label>
        <Input
          type="number"
          min={1}
          className="bg-slate-800 text-white border-slate-600 w-24"
          value={value.minParticipants}
          onChange={(e) => onChange({ ...value, minParticipants: e.target.value })}
        />
        {errors?.minParticipants && <p className="text-red-400 text-sm">{errors.minParticipants}</p>}
      </div>
      <div className="space-y-2">
        <Label className="text-slate-300">טיפול בתיקו</Label>
        <select
          className="w-full rounded-lg px-3 py-2 bg-slate-800 text-white border border-slate-600"
          value={value.tieHandling}
          onChange={(e) => onChange({ ...value, tieHandling: e.target.value as "split" | "first_wins" })}
        >
          <option value="split">חלוקה שווה בין המשתתפים בתיקו</option>
          <option value="first_wins">הראשון בדירוג זוכה</option>
        </select>
      </div>
    </div>
  );
}

export const DEFAULT_SETTLEMENT_STEP: SettlementStepState = {
  prizeMode: "first",
  prize1: "100",
  prize2: "30",
  prize3: "20",
  minParticipants: "1",
  tieHandling: "split",
};
