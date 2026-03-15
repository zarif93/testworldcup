/**
 * Phase 2C: Build a renderer-ready model from a form schema (preparation for future dynamic form).
 * Does NOT change PredictionForm; output is for a future schema-driven renderer.
 */

import type { CompetitionFormSchema, FormSchemaField } from "./competitionFormSchema";

export type RendererFieldType = "select_1x2" | "number" | "number_set" | "select_single" | "text";

export interface RendererFieldDef {
  key: string;
  rendererType: RendererFieldType;
  label?: string;
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
  /** For repeat groups (e.g. per match). */
  repeatKey?: string;
}

export interface RendererModel {
  kind: string;
  fields: RendererFieldDef[];
  /** For match-based: item source. */
  itemSource?: "world_cup" | "custom" | "draw_items";
  /** For lotto/chance: structured bounds. */
  lotto?: { regularCount: number; regularMin: number; regularMax: number; strongMin: number; strongMax: number };
  chance?: { suits: string[]; cardValues: string[] };
}

export function getFieldRendererType(field: FormSchemaField): RendererFieldType {
  if (field.type === "select" && field.outcomeType === "1X2") return "select_1x2";
  if (field.type === "select" && field.options && field.options.length > 0) return "select_single";
  if (field.type === "number") return "number";
  return "text";
}

/**
 * Build a renderer model from a resolved form schema. Used by a future dynamic form component.
 */
export function buildRendererModelFromFormSchema(schema: CompetitionFormSchema): RendererModel {
  if (schema.kind === "football_match_predictions") {
    const fields: RendererFieldDef[] = schema.fieldsPerMatch.map((f) => ({
      key: f.key,
      rendererType: getFieldRendererType(f),
      label: f.label,
      required: f.required ?? true,
      options: f.options,
      repeatKey: "matchId",
    }));
    return {
      kind: "football_match_predictions",
      fields,
      itemSource: schema.matchSource,
    };
  }

  if (schema.kind === "lotto") {
    return {
      kind: "lotto",
      fields: [
        { key: "numbers", rendererType: "number_set", required: true, repeatKey: "numbers" },
        { key: "strongNumber", rendererType: "number", required: true, min: schema.strongMin, max: schema.strongMax },
      ],
      lotto: {
        regularCount: schema.regularCount,
        regularMin: schema.regularMin,
        regularMax: schema.regularMax,
        strongMin: schema.strongMin,
        strongMax: schema.strongMax,
      },
    };
  }

  if (schema.kind === "chance") {
    const fields: RendererFieldDef[] = schema.suits.map((suit) => ({
      key: suit,
      rendererType: "select_single",
      required: true,
      options: [...schema.cardValues],
    }));
    return {
      kind: "chance",
      fields,
      chance: { suits: schema.suits, cardValues: schema.cardValues },
    };
  }

  return {
    kind: "custom",
    fields: (schema.kind === "custom" && schema.fields) ? schema.fields.map((f) => ({
      key: f.key,
      rendererType: getFieldRendererType(f),
      label: f.label,
      required: f.required ?? false,
      options: f.options,
      min: f.min,
      max: f.max,
    })) : [],
  };
}
