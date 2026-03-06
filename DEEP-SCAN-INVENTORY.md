# DEEP-SCAN-INVENTORY – מיפוי Endpoints ו־Risk

## 1. רשימת Routes/Endpoints מלאה + Role

| Router | Endpoint | Procedure | Role | Risk | Files |
|--------|----------|-----------|------|------|-------|
| auth | me | query | public | Low | routers.ts |
| auth | getPointsHistory | query | protected | Low | routers.ts |
| auth | getPlayerPnL | query | protected | Low | routers.ts |
| auth | exportMyPlayerReport | query | protected (user only) | Medium (export) | routers.ts, csvExport.ts |
| auth | checkUsername | query | public | Low | routers.ts |
| auth | register | mutation | public | Medium | routers.ts, auth.ts |
| auth | login | mutation | public | High (rate limited) | routers.ts, auth.ts, loginRateLimit.ts |
| auth | logout | mutation | public | Low | routers.ts |
| tournaments | getAll | query | public | Low | routers.ts, db.ts |
| tournaments | getPublicStats | query | public | Low | routers.ts, db.ts |
| tournaments | getById | query | public | Low | routers.ts |
| tournaments | getCustomFootballMatches | query | public | Low | routers.ts |
| matches | getAll | query | public | Low | routers.ts |
| matches | getById | query | public | Low | routers.ts |
| submissions | submit | mutation | protected | **Critical** (points debit) | routers.ts, db.ts |
| submissions | update | mutation | protected | **High** (edit, no charge) | routers.ts, db.ts |
| submissions | getAll | query | public | Medium (returns by role) | routers.ts |
| submissions | getById | query | protected | Medium (ownership check) | routers.ts |
| submissions | getByTournament | query | public | Low | routers.ts |
| submissions | getChanceLeaderboard | query | public | Low | routers.ts |
| submissions | getLottoLeaderboard | query | public | Low | routers.ts |
| submissions | getCustomFootballLeaderboard | query | public | Low | routers.ts |
| submissions | getMine | query | protected | Low | routers.ts |
| submissions | getMyEntriesForTournament | query | protected | Low | routers.ts |
| transparency | getSummary | query | public | Low | routers.ts |
| admin | getStatus | query | protected | Low | routers.ts |
| admin | verifyCode | mutation | protected | Medium | routers.ts |
| admin | getUsers | query | admin | High | routers.ts |
| admin | getAllSubmissions | query | admin | High | routers.ts |
| admin | getPendingSubmissionsCount | query | admin | Low | routers.ts |
| admin | getFinancialReport | query | admin | High | routers.ts |
| admin | getDataFinancialRecords | query | admin | High | routers.ts |
| admin | getDataFinancialRecordDetail | query | admin | High | routers.ts |
| admin | getDataFinancialSummary | query | admin | High | routers.ts |
| admin | deleteFinancialHistory | mutation | superAdmin | **Critical** | routers.ts, db.ts |
| admin | getTransparencySummary | query | admin | High | routers.ts |
| admin | getTransparencyLog | query | admin | High | routers.ts |
| admin | deleteTransparencyHistory | mutation | superAdmin | **Critical** | routers.ts |
| admin | fullReset | mutation | superAdmin | **Critical** | routers.ts, db.ts |
| admin | depositPoints | mutation | admin | **Critical** (points) | routers.ts, db.ts |
| admin | withdrawPoints | mutation | admin | **Critical** (points) | routers.ts, db.ts |
| admin | getPointsLogs | query | admin | High | routers.ts |
| admin | getBalanceSummary | query | admin | High | routers.ts |
| admin | getAgentsWithBalances | query | admin | High | routers.ts |
| admin | getPnLSummary | query | admin | High | routers.ts |
| admin | getPlayerPnL | query | admin | High | routers.ts |
| admin | getAgentPnL | query | admin | High | routers.ts |
| admin | exportPnLSummaryCSV | query | admin | Medium (export) | routers.ts, csvExport.ts |
| admin | exportAgentPnLCSV | query | admin | Medium (export) | routers.ts, csvExport.ts |
| admin | exportPlayerPnLCSV | query | admin | Medium (export) | routers.ts, csvExport.ts |
| admin | exportPointsLogsCSV | query | admin | Medium (export) | routers.ts, csvExport.ts |
| admin | deletePointsLogsHistory | mutation | superAdmin | **Critical** | routers.ts |
| admin | distributePrizes | mutation | admin | **Critical** (payout) | routers.ts, db.ts |
| admin | approveSubmission | mutation | admin | **Critical** (status+commission) | routers.ts, db.ts |
| admin | rejectSubmission | mutation | admin | High | routers.ts |
| admin | markPayment | mutation | admin | High | routers.ts |
| admin | updateMatchResult | mutation | admin | High | routers.ts, db.ts, scoringService.ts |
| admin | updateMatch | mutation | admin | Low | routers.ts |
| admin | lockTournament | mutation | admin | High | routers.ts |
| admin | hideTournamentFromHomepage | mutation | admin | Medium | routers.ts, db.ts |
| admin | restoreTournamentToHomepage | mutation | admin | Medium | routers.ts, db.ts |
| admin | getLeagues | query | admin | Low | routers.ts |
| admin | createLeague | mutation | admin | Low | routers.ts |
| admin | updateLeague | mutation | admin | Low | routers.ts |
| admin | softDeleteLeague | mutation | admin | Low | routers.ts |
| admin | createTournament | mutation | admin | High | routers.ts, db.ts |
| admin | deleteTournament | mutation | admin | **Critical** (refund) | routers.ts, db.ts |
| admin | getCustomFootballMatches | query | admin | Low | routers.ts |
| admin | addCustomFootballMatch | mutation | admin | Low | routers.ts |
| admin | updateCustomFootballMatchResult | mutation | admin | High | routers.ts |
| admin | updateCustomFootballMatch | mutation | admin | Low | routers.ts |
| admin | deleteCustomFootballMatch | mutation | admin | Low | routers.ts |
| admin | recalcCustomFootballPoints | mutation | admin | High | routers.ts |
| admin | getCustomFootballLeaderboard | query | admin | Low | routers.ts |
| admin | getSiteSettings | query | admin | Low | routers.ts |
| admin | setSiteSetting | mutation | admin | Medium | routers.ts |
| admin | getChanceDrawResult | query | admin | Low | routers.ts |
| admin | updateChanceResults | mutation | admin | High | routers.ts |
| admin | lockChanceDraw | mutation | admin | Low | routers.ts |
| admin | getLottoDrawResult | query | admin | Low | routers.ts |
| admin | updateLottoResults | mutation | admin | High | routers.ts |
| admin | lockLottoDraw | mutation | admin | Low | routers.ts |
| admin | createAutoSubmissions | mutation | admin | High | routers.ts |
| admin | deleteSubmission | mutation | admin | High | routers.ts |
| admin | deleteAllSubmissions | mutation | admin | **Critical** | routers.ts |
| admin | deleteUser | mutation | admin | **Critical** | routers.ts |
| admin | getAdmins | query | superAdmin | High | routers.ts |
| admin | createAdmin | mutation | superAdmin | **Critical** | routers.ts |
| admin | deleteAdmin | mutation | superAdmin | **Critical** | routers.ts |
| admin | updateAdmin | mutation | superAdmin | **Critical** | routers.ts |
| admin | getAdminAuditLogs | query | superAdmin | High | routers.ts |
| admin | createAgent | mutation | admin | High | routers.ts, db.ts |
| admin | getAgents | query | admin | High | routers.ts |
| admin | getPlayers | query | admin | High | routers.ts |
| admin | getUsersList | query | admin | High | routers.ts |
| admin | setUserBlocked | mutation | admin | High | routers.ts |
| admin | resetUserPassword | mutation | admin | High | routers.ts |
| admin | getAgentReport | query | admin | High | routers.ts |
| agent | getMyReport | query | protected (agent) | Medium | routers.ts |
| agent | getCommissionReport | query | protected (agent) | Medium | routers.ts |
| agent | exportCommissionReportCSV | query | protected (agent) | Medium | routers.ts, csvExport.ts |
| agent | exportAgentPnLCSV | query | protected (agent) | Medium | routers.ts |
| agent | getWallet | query | protected (agent) | High | routers.ts |
| agent | withdrawFromPlayer | mutation | protected (agent) | **Critical** (points) | routers.ts, db.ts |
| agent | depositToPlayer | mutation | protected (agent) | **Critical** (points) | routers.ts, db.ts |
| agent | getTransferLog | query | protected (agent) | Low | routers.ts |
| agent | getMyPointsHistory | query | protected (agent) | Low | routers.ts |
| agent | getAgentPnL | query | protected (agent) | Medium | routers.ts |
| agent | getAgentPlayersPnL | query | protected (agent) | Medium | routers.ts |
| agent | getPlayerPnLDetail | query | protected (agent) | Medium (ownership) | routers.ts |

## 2. מקומות שינוי points/balance

| פעולה | קובץ | פונקציה | הערה |
|--------|------|---------|------|
| Debit (השתתפות) | db.ts | deductUserPoints | נקרא מ־submissions.submit |
| Credit (פרס) | db.ts | addUserPoints | נקרא מ־distributePrizes + distributePrizesForTournament |
| Credit (החזר) | db.ts | addUserPoints | refundTournamentParticipants, deleteTournament |
| Admin deposit | db.ts | addUserPoints | admin.depositPoints |
| Admin withdraw | db.ts | deductUserPoints | admin.withdrawPoints |
| Agent withdraw from player | db.ts | agentWithdrawFromPlayer | טרנזקציה SQLite |
| Agent deposit to player | db.ts | agentDepositToPlayer | טרנזקציה SQLite |

## 3. אישור טופס / עדכון סטטוס / תוצאות / חלוקת פרסים

| פעולה | Endpoint | קובץ | הערה |
|--------|----------|------|------|
| אישור טופס | admin.approveSubmission | routers.ts | updateSubmissionStatus + updateSubmissionPayment + commission |
| דחיית טופס | admin.rejectSubmission | routers.ts | updateSubmissionStatus + audit |
| עדכון תוצאות משחק | admin.updateMatchResult | routers.ts | updateMatchResult + recalc כל הטפסים |
| עדכון תוצאות צ'אנס/לוטו | admin.updateChanceResults, updateLottoResults | routers.ts | setChanceDrawResult, setLottoDrawResult |
| חלוקת פרסים | admin.distributePrizes | routers.ts | distributePrizesForTournament |
| הסתרה מהדף ראשי | admin.hideTournamentFromHomepage | routers.ts, db.ts | hideTournamentFromHomepage |
| מחיקת תחרות + החזר | admin.deleteTournament | db.ts | deleteTournament → refundTournamentParticipants |

## 4. עמלות סוכן/אתר

| מקום | קובץ | הערה |
|------|------|------|
| חישוב עמלה | routers.ts (submit) | calcAgentCommission, recordAgentCommission |
| עמלה באישור | routers.ts (approveSubmission) | hasCommissionForSubmission, recordAgentCommission |
| רישום בשקיפות | insertTransparencyLog | db/routers |

## 5. תיקיות סרוקות

- **server/** – routers, auth, db, _core, services, csvExport
- **client/** – לא נסרק לעומק (הגנות בשרת)
- **shared/** – const, types, matchesData
- **scripts/** – create-admin, backup-db, load-test, production-readiness, delete-open-mondial
- **drizzle/** – schema, schema-sqlite, migrations
