# Forensic diagnosis: why removed/closed competitions still appear

## 1. Environment and DB

- **Active DB:** `./data/worldcup.db` (when `DATABASE_URL` is not set).
- **worldcup.backup.db** is a separate file; no automatic restore from backup in code. Competitions “coming back” are **not** from a backup restore; they are from **application logic** using data that was never removed or was only soft-deleted.

---

## 2. Delete / close / lock / cancel flows

### 2.1 Admin delete (`deleteTournament`)

**File:** `server/db.ts` (export `deleteTournament`), called from `server/routers.ts` → `admin.deleteTournament`, and from `client/src/pages/AdminPanel.tsx` (Trash button → `handleDeleteTournament` → `deleteTournamentMut.mutateAsync({ id })`).

**Behavior:**

- **Finished tournaments** (status is `PRIZES_DISTRIBUTED` / `RESULTS_UPDATED` / `ARCHIVED`, or there is an income financial record for that competition):
  - **Soft-delete only:** `UPDATE tournaments SET deletedAt = NOW() WHERE id = ?`
  - **No** refund, **no** deletion of submissions, agent commissions, custom football matches, or tournament row.
  - Tournament row and all related data stay in the DB; it only gets `deletedAt` set.

- **Non-finished tournaments:**
  - Refund participants, insert refund financial record, then:
  - **Hard delete:** delete rows in `agent_commissions`, `submissions`, `custom_football_matches`, then `DELETE FROM tournaments WHERE id = ?`.
  - Tournament and its submissions are actually removed.

So: **finished** = soft-delete (row + submissions remain); **non-finished** = hard-delete.

### 2.2 Close / lock / cancel (no delete)

- **Lock (admin):** `setTournamentLocked(tournamentId, true)` → sets `status = 'LOCKED'`, `lockedAt`. No `deletedAt`, no hide.
- **Automation (time-based):** `runAutoCloseTournaments` / `runLockedTournamentsRemoval` → update `status` (e.g. LOCKED → CLOSED), `visibility = 'HIDDEN'`, etc. No `deletedAt`.
- **Hide from homepage (admin):** `hideTournamentFromHomepage` → sets `hiddenFromHomepage = true`, `hiddenAt`, `hiddenByAdminId`. No status change, no `deletedAt`.
- **Archive (cleanup):** `setTournamentArchived` / archive path → `status = 'ARCHIVED'`, `visibility = 'HIDDEN'`, `archivedAt`. No `deletedAt`.

So “close/lock/cancel” and “hide” **do not** set `deletedAt` and do not remove the tournament row.

---

## 3. Tournament list vs by-ID queries

### 3.1 List queries (filter out soft-deleted)

| Query | File | Filter | Effect |
|-------|------|--------|--------|
| `getTournaments()` | `server/db.ts` | `isNull(tournaments.deletedAt)` | Soft-deleted tournaments **excluded** from list. |
| `getActiveTournaments()` | `server/db.ts` | `isNull(tournaments.deletedAt)` + `visibility = 'VISIBLE'` + `hiddenFromHomepage = 0` + `status IN ('OPEN','LOCKED')` | Same for deleted; also excludes hidden and non-OPEN/LOCKED. |

Used by:

- **Admin:** `trpc.tournaments.getAll` → `getTournaments()` (all non-deleted).
- **Public:** same procedure when not admin → `getActiveTournaments()` (non-deleted, visible, OPEN/LOCKED only).

So in **list** UIs, soft-deleted tournaments do **not** appear.

### 3.2 By-ID query (does NOT filter deleted)

| Query | File | Filter | Effect |
|-------|------|--------|--------|
| `getTournamentById(id)` | `server/db.ts` | `eq(tournaments.id, id)` **only** | **No** `deletedAt` check. Returns the row even if `deletedAt` is set. |

Used by:

- `trpc.tournaments.getById` (e.g. prediction form).
- Many other procedures that need tournament by id (submission detail, distribute prizes, lock, etc.).

So any **by-ID** access (URL, link, submission → tournament) still loads the tournament even when it is soft-deleted.

### 3.3 Other reads that ignore `deletedAt`

These also do **not** filter by `deletedAt`:

- `getTournamentByDrawCode`, `getTournamentByDrawDateAndTime` (chance/lotto by draw).
- `getTournamentsWithStatusSettling()` (SETTLING only).
- `getTournamentsToAutoClose()`, `getTournamentsClosingSoon()`, `getTournamentsToSettleNow()` (automation).
- `runLockedTournamentsRemoval()` (selects LOCKED by `removalScheduledAt`).

So automation and by-code/by-draw lookups can still see and update soft-deleted tournaments; they don’t make the list show them, but by-ID still does.

---

## 4. Submissions and “users still attached”

- **getSubmissionsByUserId(userId)** and **getAllSubmissions()** read only from `submissions`. They **do not** join to `tournaments` and **do not** filter by `tournaments.deletedAt`.
- When a tournament is **soft-deleted**, its **submissions are not deleted**; they still have `tournamentId` pointing to that tournament.
- So:
  - “My submissions” / admin “all submissions” still list those submissions.
  - Each submission has a `tournamentId`; the UI can show a name from `getTournamentPublicStats()` (which uses `getActiveTournaments()` / `getTournaments()`), so for a soft-deleted tournament the name may fall back to e.g. `טורניר ${id}`.
  - Links like “Edit” / “Duplicate” / “View” go to `/predict/${s.tournamentId}`.

So **users remain “attached”** because submissions are never deleted for finished tournaments, and submission lists don’t filter by tournament `deletedAt`.

---

## 5. What “came back” means in code terms

1. Admin deletes a **finished** competition → only **soft-delete** (`deletedAt` set); tournament row and submissions stay.
2. **List** queries (`getTournaments` / `getActiveTournaments`) exclude it → it **disappears** from admin/public list and from `getTournamentPublicStats()`.
3. User (or admin) still has **submissions** for that tournament → they remain in `getSubmissionsByUserId` / `getAllSubmissions`.
4. UI shows those submissions (e.g. “My submissions”) with a fallback name like “טורניר 123”.
5. User clicks a link to the competition (e.g. Edit/Duplicate/View) → navigates to **`/predict/123`**.
6. **PredictionForm** (or any by-id page) calls **`trpc.tournaments.getById.useQuery({ id: 123 })`** → **`getTournamentById(123)`**.
7. **`getTournamentById`** returns the row **without** checking `deletedAt` → the competition **appears again** (full detail/prediction page).

So “came back” = **same DB row, still present and loaded by by-ID API and UI**, while **list APIs** correctly hide it. No restore from backup and no re-create.

---

## 6. Files involved (concise)

| Concern | File(s) |
|--------|---------|
| Delete behavior (soft vs hard) | `server/db.ts` (`deleteTournament`) |
| Admin delete API + audit | `server/routers.ts` (`admin.deleteTournament`) |
| Admin delete button | `client/src/pages/AdminPanel.tsx` (`handleDeleteTournament`, `deleteTournamentMut`) |
| List (excludes deleted) | `server/db.ts` (`getTournaments`, `getActiveTournaments`) |
| By-ID (does not exclude deleted) | `server/db.ts` (`getTournamentById`) |
| List API | `server/routers.ts` (`tournaments.getAll` → getTournaments / getActiveTournaments) |
| By-ID API | `server/routers.ts` (`tournaments.getById` → getTournamentById) |
| Submissions (no tournament deleted filter) | `server/db.ts` (`getSubmissionsByUserId`, `getAllSubmissions`), `server/routers.ts` (`submissions.getMine`, `submissions.getAll`) |
| Public stats (uses list) | `server/db.ts` (`getTournamentPublicStats`), `server/routers.ts` (`tournaments.getPublicStats`) |
| Prediction page (by-id) | `client/src/pages/PredictionForm.tsx` (route `/predict/:id`, `tournaments.getById`) |
| Submissions page (links to predict) | `client/src/pages/Submissions.tsx` (links to `/predict/${s.tournamentId}`) |
| Lock / hide / archive (no delete) | `server/db.ts` (`setTournamentLocked`, `hideTournamentFromHomepage`, `runLockedTournamentsRemoval`, archive path) |

---

## 7. Summary table: how tournaments are “removed” and why they can reappear

| Scenario | DB change | In list? | By-ID (/predict/:id)? | Submissions? |
|----------|-----------|----------|------------------------|--------------|
| Admin delete **finished** | Soft-delete (`deletedAt` set) | No | **Yes (reappears)** | Kept, still listed |
| Admin delete **non-finished** | Hard delete (row + subs deleted) | No | No (404) | Gone |
| Lock / close / hide / archive | Status/visibility/hidden only | Depends on list (e.g. active = OPEN/LOCKED only) | Yes | Kept |

So: **only non-finished delete** actually removes the row and submissions. **Finished delete** and **all close/lock/hide/archive** leave the row (and submissions) in place; visibility is only reduced in **list** and **public stats**, not in **by-ID** or submission-based links.

---

## 8. Why the UI made them visible again

- **Path:** User (or admin) opens **Submissions** (or any view that lists submissions). Submissions for the soft-deleted tournament are still returned. Clicking an action (Edit/Duplicate/View) goes to **`/predict/{tournamentId}`**. The prediction page loads **`tournaments.getById`** → **`getTournamentById`** → returns the soft-deleted tournament → competition “comes back” on screen.
- **No query cache needed** for this: the same DB row is returned every time by `getTournamentById`. Stale UI state can make it more likely someone re-opens an old link, but the root cause is **by-ID not respecting `deletedAt`**.

---

## 9. Correct fix (if admin expected them to disappear)

Options (conceptual; no code change in this step):

1. **Treat soft-deleted as “not found” for by-ID:**
   - In **`getTournamentById`**: if the row has `deletedAt` set, return `undefined` (and API returns 404). Then `/predict/:id` for a deleted competition will show “not found” instead of the competition.
2. **Submission list behavior:**
   - When listing submissions, either:
     - filter out submissions whose tournament has `deletedAt` set, or
     - keep them but show a “Competition removed” label and disable or redirect links to `/predict/{id}` so by-ID is not used for deleted tournaments.
3. **Keep current soft-delete semantics** but make UI consistent with “deleted = hidden everywhere”: apply the same `deletedAt` filter wherever a tournament is resolved (including by-ID and any submission→tournament resolution). Option 1 is the minimal change for “disappear” behavior.

No change was applied in this step; this is diagnosis only.
