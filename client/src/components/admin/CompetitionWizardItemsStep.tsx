/**
 * Phase 16: Step 3 — Items source and optional sets to create after tournament creation.
 * Source: universal (DB) or legacy. Manage sets inline (created after tournament is created).
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

export type ItemSource = "universal" | "legacy";

export interface ItemSetToCreate {
  id: string;
  title: string;
  itemType: string;
  sourceType: ItemSource;
}

export interface ItemsStepState {
  source: ItemSource;
  sets: ItemSetToCreate[];
}

const DEFAULT_SET: Omit<ItemSetToCreate, "id"> = {
  title: "",
  itemType: "match",
  sourceType: "universal",
};

interface CompetitionWizardItemsStepProps {
  value: ItemsStepState;
  onChange: (v: ItemsStepState) => void;
  /** Legacy type from step 2 for hint */
  legacyType?: string | null;
}

export function CompetitionWizardItemsStep({ value, onChange, legacyType }: CompetitionWizardItemsStepProps) {
  const addSet = () => {
    onChange({
      ...value,
      sets: [...value.sets, { ...DEFAULT_SET, id: crypto.randomUUID?.() ?? String(Date.now()) }],
    });
  };
  const removeSet = (id: string) => {
    onChange({ ...value, sets: value.sets.filter((s) => s.id !== id) });
  };
  const updateSet = (id: string, patch: Partial<ItemSetToCreate>) => {
    onChange({
      ...value,
      sets: value.sets.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-sm">
        בחר מקור פריטים: אוניברסלי (מערכת) או לגסי. ניתן להוסיף סטים שייווצרו אוטומטית לאחר יצירת התחרות.
      </p>
      <div className="space-y-2">
        <Label className="text-slate-300">מקור פריטים</Label>
        <select
          className="w-full rounded-lg px-3 py-2 bg-slate-800 text-white border border-slate-600"
          value={value.source}
          onChange={(e) => onChange({ ...value, source: e.target.value as ItemSource })}
        >
          <option value="universal">אוניברסלי (מסד נתונים)</option>
          <option value="legacy">לגסי (התנהגות קיימת)</option>
        </select>
      </div>
      {legacyType && (
        <p className="text-slate-500 text-sm">סוג תחרות נבחר: {legacyType}. פריטים יכולים להיות מוזנים בהמשך בעמוד ניהול התחרות.</p>
      )}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-slate-300">סטים ליצירה לאחר פתיחת התחרות (אופציונלי)</Label>
          <Button type="button" variant="outline" size="sm" onClick={addSet} className="text-slate-400 border-slate-600">
            <Plus className="w-4 h-4 ml-1" />
            הוסף סט
          </Button>
        </div>
        {value.sets.length === 0 ? (
          <p className="text-slate-500 text-sm">אין סטים. התחרות תיווצר בלי סטים; ניתן להוסיף אחר כך.</p>
        ) : (
          <ul className="space-y-3">
            {value.sets.map((set) => (
              <li key={set.id} className="flex flex-wrap gap-2 items-end p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                <div className="flex-1 min-w-[120px] space-y-1">
                  <Label className="text-slate-500 text-xs">כותרת</Label>
                  <Input
                    className="bg-slate-800 text-white border-slate-600"
                    placeholder="למשל: משחקי שלב הבתים"
                    value={set.title}
                    onChange={(e) => updateSet(set.id, { title: e.target.value })}
                  />
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-slate-500 text-xs">סוג</Label>
                  <Input
                    className="bg-slate-800 text-white border-slate-600"
                    placeholder="match / lotto / custom"
                    value={set.itemType}
                    onChange={(e) => updateSet(set.id, { itemType: e.target.value })}
                  />
                </div>
                <div className="w-24 space-y-1">
                  <Label className="text-slate-500 text-xs">מקור</Label>
                  <select
                    className="w-full rounded-lg px-2 py-2 bg-slate-800 text-white border border-slate-600 text-sm"
                    value={set.sourceType}
                    onChange={(e) => updateSet(set.id, { sourceType: e.target.value as ItemSource })}
                  >
                    <option value="universal">אוניברסלי</option>
                    <option value="legacy">לגסי</option>
                  </select>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeSet(set.id)} className="text-red-400 hover:text-red-300">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export const DEFAULT_ITEMS_STEP: ItemsStepState = {
  source: "legacy",
  sets: [],
};
