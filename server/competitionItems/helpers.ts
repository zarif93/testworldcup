/**
 * Phase 7: Typed helpers for renderer, result, and option models.
 */

import type {
  CompetitionItemResolved,
  CompetitionItemRendererModel,
  CompetitionItemResultModel,
  CompetitionItemOptionModel,
} from "./types";

export function getCompetitionItemRendererModel(
  item: CompetitionItemResolved
): CompetitionItemRendererModel {
  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle ?? null,
    itemKind: item.itemKind,
    sourceType: item.sourceType,
    legacyMatchId: item.legacyMatchId ?? null,
    optionSchema: item.optionSchema ?? null,
    metadata: item.metadata ?? null,
  };
}

export function getCompetitionItemResultModel(
  item: CompetitionItemResolved
): CompetitionItemResultModel {
  return {
    id: item.id,
    externalKey: item.externalKey ?? null,
    title: item.title,
    itemKind: item.itemKind,
    resultSchema: item.resultSchema ?? null,
    legacyMatchId: item.legacyMatchId ?? null,
    metadata: item.metadata ?? null,
  };
}

export function getCompetitionItemOptionModel(
  item: CompetitionItemResolved
): CompetitionItemOptionModel {
  return {
    itemId: item.id,
    itemKind: item.itemKind,
    options: item.optionSchema ?? {},
    optionSchema: item.optionSchema ?? null,
  };
}
