# ולידציה ממוקדת – שחקן 1212 (משתמש מצולם)

תוצאות הסקריפט `scripts/validate-player-1212.ts` והתאמה למסכים.  
**הערה:** בבדאטאבייס הנוכחי "1212" זוהה כ־**username** (ולא כ־userId); המשתמש המחובר הוא **userId 90901508**.

---

## 1. Breakdown מלא של ה־PnL הקנוני (טווח: כל הזמנים + תחרויות שהוסדרו)

| שדה | ערך |
|-----|-----|
| **totalEntryFees** | 0 |
| **totalEntryFeeRefunds** | 0 |
| **totalPrizesWon** | 2,575 |
| **totalJackpotContributions** | 0 |
| **totalJackpotPayouts** | 0 |
| **competitionNetPnL** | 2,575 |

**נוסחה:**  
`competitionNetPnL = totalPrizesWon + totalJackpotPayouts - totalEntryFees + totalEntryFeeRefunds - totalJackpotContributions`  
→ 2575 + 0 - 0 + 0 - 0 = **2575** ✓

עם פילטר **תחרויות שהוסדרו בלבד:**  
- competitionNetPnL (settled only): 2575  
- totalJackpotPayouts / totalJackpotContributions: 0  

---

## 2. התאמה למסכים בפועל (מה אמור להופיע עכשיו)

### דוח שחקן במרכז הכספים
- **finalResult (תוצאה סופית):** 2,575  
- **שורות הדוח:** סכום השורות = 2,575 (תואם ל־finalResult).  
- **פירוט:** שורה per תחרות/השתתפות + במידת הצורך שורת "יתר זכיות" ו/או "ג׳קפוט".  
  - לדוגמה: לוטו חינם: 1,000 | יתר זכיות: 1,575 (כשיש זכיות שלא משויכות ל־submission בודד).

### היסטוריית נקודות (point history)
- מספר תנועות (עד 30 אחרונות): 6  
- סכום זכיות (prize) בהיסטוריה: 2,575 (תואם ל־totalPrizesWon).

### טאב ג׳קפוט במרכז הכספים
- אירועי ג׳קפוט של השחקן: 0 (אין תרומות/תשלומי ג׳קפוט).

### חלון / רשימת הזוכים של הג׳קפוט
- השחקן לא מופיע ברשימת הזוכים (0 זכיות ג׳קפוט).  
- בזוכים: מוצג **username** או **username (#id)** (לא raw #id בלבד).

### CSV export
- רלוונטי: ייצוא אירועי ג׳קפוט / דוחות הסדר.  
- תוויות משתמש: `getDisplayName` → "username" או "username (#id)" או "משתמש #id" כ־fallback.

---

## 3. אימות username

- **בכל המסכים שהיו בעייתיים:** מוצג כעת **username** או **username (#id)** (מהפונקציה `getDisplayName`), ולא raw **#id** בלבד.  
- **fallback:** כאשר אין username/name למשתמש, מוצג **"משתמש #id"** (או "#id") בכוונה – כדי שלא להציג מחרוזת ריקה.  
- **מיקומים:**  
  - דוח שחקן / מרכז כספים: `playerReport.username` / `getDisplayName`.  
  - רשימת זוכים (Home, אדמין): `winnerUsername` מ־`listJackpotDraws` (משולב עם `getDisplayName`).  
  - תשלומים / אירועי ג׳קפוט / CSV: תווית מהשרת עם `getDisplayName`.

---

## 4. ולידציה ידנית (תוצאה מהרצת הסקריפט)

- **המסכים נבדקו דרך שירותי השרת (getPlayerReportDetailed, getPlayerSettlementReport, listJackpotDraws, getJackpotFinancialEvents, point_transactions).**  
- **השחקן לא מוצג כ־raw ID:** getDisplayName = "1212" (username).  
- **תוצאה בדוח תואמת ל־competitionNetPnL:** summary.finalResult = 2,575 = competitionNetPnL.  
- **זכיית ג׳קפוט:** אין לאותו שחקן – לא רלוונטי; אם הייתה – הייתה מופיעה בדוח ובמרכז הכספים (שורת "ג׳קפוט").  
- **סכום השורות מתיישב עם התוצאה הסופית:** sum(rows.result) = 2,575 = finalResult (כולל שורת "יתר זכיות" כשיש זכיות יתר שלא משויכות להשתתפות בודדת).

---

## 5. תשובת סגירה

**All financial and reporting views are now consistent for the tested player.**

- PnL קנוני: נוסחה אחת, ערכים תואמים.  
- דוח שחקן במרכז הכספים: finalResult = competitionNetPnL; סכום שורות = finalResult (כולל שורת "יתר זכיות" כשיש).  
- היסטוריית נקודות ו־CSV: משתמשים במקור קנוני ובתצוגת username/משתמש #id בהתאם.  
- אין אי-התאמה פתוחה עבור השחקן שנבדק (username "1212" / userId 90901508).
