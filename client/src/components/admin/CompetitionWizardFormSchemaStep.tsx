/**
 * Phase 16: Step 4 — Form schema preview (from competition type) + optional JSON override.
 */

import { Label } from "@/components/ui/label";

export interface FormSchemaStepState {
  /** Optional override JSON string; empty = use type default */
  formSchemaJsonOverride: string;
}

interface CompetitionWizardFormSchemaStepProps {
  value: FormSchemaStepState;
  onChange: (v: FormSchemaStepState) => void;
  /** Resolved form schema preview from type (display only) */
  previewJson?: string | null;
  legacyType?: string | null;
}

export function CompetitionWizardFormSchemaStep({ value, onChange, previewJson, legacyType }: CompetitionWizardFormSchemaStepProps) {
  return (
    <div className="space-y-4">
      <p className="text-slate-400 text-sm">
        סכמת הטופס נקבעת לפי סוג התחרות. ניתן לדרוס (מתקדם) באמצעות JSON.
      </p>
      {previewJson && (
        <div className="space-y-2">
          <Label className="text-slate-300">תצוגת סכמה (מסוג התחרות)</Label>
          <pre className="p-3 rounded-lg bg-slate-800/80 text-slate-300 text-xs overflow-auto max-h-32">
            {previewJson}
          </pre>
        </div>
      )}
      {legacyType && !previewJson && (
        <p className="text-slate-500 text-sm">סוג תחרות: {legacyType}. סכמת ברירת מחדל תוחל.</p>
      )}
      <div className="space-y-2">
        <Label className="text-slate-300">דריסת סכמה (JSON, אופציונלי)</Label>
        <textarea
          className="w-full rounded-lg px-3 py-2 bg-slate-800 text-white border border-slate-600 font-mono text-sm min-h-[100px]"
          placeholder='{}'
          value={value.formSchemaJsonOverride}
          onChange={(e) => onChange({ ...value, formSchemaJsonOverride: e.target.value })}
        />
      </div>
    </div>
  );
}

export const DEFAULT_FORM_SCHEMA_STEP: FormSchemaStepState = {
  formSchemaJsonOverride: "",
};
