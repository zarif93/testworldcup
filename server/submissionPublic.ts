/**
 * Safe shapes for public / user-facing submission reads (leaderboard lists, prediction viewers).
 * Excludes internal fields: agentId, paymentStatus, approvedBy, editedCount, lastEditedAt, userId (where not needed).
 */

export type PublicSubmissionLeaderboardRow = {
  id: number;
  username: string;
  tournamentId: number;
  predictions: unknown;
  points: number;
  status: "pending" | "approved" | "rejected";
  submissionNumber: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  tournamentRemoved: boolean;
};

export type PublicSubmissionView = PublicSubmissionLeaderboardRow & {
  /** Lotto UI helper – already derivable from predictions; optional on row */
  strongHit: boolean | null;
};

type SubmissionRow = {
  id: number;
  userId: number;
  username: string;
  tournamentId: number;
  predictions: unknown;
  points: number;
  status: "pending" | "approved" | "rejected";
  submissionNumber?: number | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  agentId?: number | null;
  paymentStatus?: string;
  editedCount?: number;
  lastEditedAt?: Date | null;
  approvedAt?: Date | null;
  approvedBy?: number | null;
  strongHit?: boolean | null;
};

export function mapSubmissionToPublicLeaderboardRow(
  s: SubmissionRow,
  tournamentRemoved: boolean
): PublicSubmissionLeaderboardRow {
  return {
    id: s.id,
    username: s.username,
    tournamentId: s.tournamentId,
    predictions: s.predictions,
    points: s.points,
    status: s.status,
    submissionNumber: s.submissionNumber ?? null,
    createdAt: s.createdAt ?? null,
    updatedAt: s.updatedAt ?? null,
    tournamentRemoved,
  };
}

export function mapSubmissionToPublicView(
  s: SubmissionRow,
  tournamentRemoved: boolean
): PublicSubmissionView {
  return {
    ...mapSubmissionToPublicLeaderboardRow(s, tournamentRemoved),
    strongHit: s.strongHit ?? null,
  };
}
