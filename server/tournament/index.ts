/**
 * Phase 13: Tournament lifecycle and competition engine.
 */

export {
  TOURNAMENT_LIFECYCLE_STATES,
  getLifecycleState,
  canTransition,
  getTournamentLifecycleState,
  transitionTournamentTo,
  isFinalState,
} from "./lifecycle";
export type { TournamentLifecycleState } from "./lifecycle";
