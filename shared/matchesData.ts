/**
 * FIFA World Cup 2026 - כל משחקי שלב הבתים
 * מעודכן לפי לוח רשמי
 */
export interface MatchData {
  matchNumber: number;
  homeTeam: string;
  awayTeam: string;
  group: string;
  date: string;
  time: string;
  stadium: string;
  city: string;
}

export const WORLD_CUP_2026_MATCHES: MatchData[] = [
  { matchNumber: 1, homeTeam: "מקסיקו", awayTeam: "דרום אפריקה", group: "A", date: "2026-06-11", time: "18:00", stadium: "אסטדיו האצטקה", city: "מקסיקו סיטי" },
  { matchNumber: 2, homeTeam: "דרום קוריאה", awayTeam: "פלייאוף אירופי (דנמרק / צ'כיה / צפון מקדוניה / אירלנד)", group: "A", date: "2026-06-11", time: "18:00", stadium: "אסטדיו אקרון", city: "גוואדלחארה" },
  { matchNumber: 3, homeTeam: "קנדה", awayTeam: "פלייאוף אירופי (איטליה / צפון אירלנד / וויילס / בוסניה)", group: "B", date: "2026-06-12", time: "18:00", stadium: "BMO FIELD", city: "טורונטו" },
  { matchNumber: 4, homeTeam: "ארצות הברית", awayTeam: "פרגוואי", group: "B", date: "2026-06-12", time: "18:00", stadium: "SOFI", city: "לוס אנג'לס" },
  { matchNumber: 5, homeTeam: "האיטי", awayTeam: "סקוטלנד", group: "C", date: "2026-06-13", time: "18:00", stadium: "ג'ילט", city: "פוקסבורו (בוסטון)" },
  { matchNumber: 6, homeTeam: "אוסטרליה", awayTeam: "פלייאוף אירופי (טורקיה / רומניה / סלובקיה / קוסובו)", group: "C", date: "2026-06-13", time: "18:00", stadium: "BC PLACE", city: "ונקובר" },
  { matchNumber: 7, homeTeam: "ברזיל", awayTeam: "מרוקו", group: "D", date: "2026-06-13", time: "18:00", stadium: "METLIFE", city: "ניו יורק – ניו ג'רזי" },
  { matchNumber: 8, homeTeam: "קטאר", awayTeam: "שווייץ", group: "D", date: "2026-06-13", time: "18:00", stadium: "אצטדיון Levi's", city: "סן פרנסיסקו" },
  { matchNumber: 9, homeTeam: "חוף השנהב", awayTeam: "אקוודור", group: "E", date: "2026-06-14", time: "18:00", stadium: "אצטדיון לינקולן", city: "פילדלפיה" },
  { matchNumber: 10, homeTeam: "גרמניה", awayTeam: "קורסאו", group: "E", date: "2026-06-14", time: "18:00", stadium: "NRG", city: "יוסטון" },
  { matchNumber: 11, homeTeam: "יפן", awayTeam: "הולנד", group: "F", date: "2026-06-14", time: "18:00", stadium: "AT&T", city: "דאלאס" },
  { matchNumber: 12, homeTeam: "טוניסיה", awayTeam: "פלייאוף אירופי (אוקראינה / שבדיה / פולין / אלבניה)", group: "F", date: "2026-06-14", time: "18:00", stadium: "BBVA", city: "מונטריי" },
  { matchNumber: 13, homeTeam: "אורוגוואי", awayTeam: "ערב הסעודית", group: "G", date: "2026-06-15", time: "18:00", stadium: "הארד רוק", city: "מיאמי" },
  { matchNumber: 14, homeTeam: "ספרד", awayTeam: "כף ורדה", group: "G", date: "2026-06-15", time: "18:00", stadium: "מרצדס בנץ", city: "אטלנטה" },
  { matchNumber: 15, homeTeam: "איראן", awayTeam: "ניו זילנד", group: "H", date: "2026-06-15", time: "18:00", stadium: "SOFI", city: "לוס אנג'לס" },
  { matchNumber: 16, homeTeam: "בלגיה", awayTeam: "מצרים", group: "H", date: "2026-06-15", time: "18:00", stadium: "LUMEN", city: "סיאטל" },
  { matchNumber: 17, homeTeam: "צרפת", awayTeam: "סנגל", group: "I", date: "2026-06-16", time: "18:00", stadium: "METLIFE", city: "ניו יורק – ניו ג'רזי" },
  { matchNumber: 18, homeTeam: "נורבגיה", awayTeam: "פלייאוף בין-יבשתי (בוליביה / סורינאם / עיראק)", group: "I", date: "2026-06-16", time: "18:00", stadium: "ג'ילט", city: "פוקסבורו (בוסטון)" },
  { matchNumber: 19, homeTeam: "ארגנטינה", awayTeam: "אלג'יריה", group: "J", date: "2026-06-16", time: "18:00", stadium: "Arrowhead", city: "קנזס סיטי" },
  { matchNumber: 20, homeTeam: "אוסטריה", awayTeam: "ירדן", group: "J", date: "2026-06-16", time: "18:00", stadium: "LEVI'S", city: "סן פרנסיסקו" },
  { matchNumber: 21, homeTeam: "גאנה", awayTeam: "פנמה", group: "K", date: "2026-06-17", time: "18:00", stadium: "BMO", city: "טורונטו" },
  { matchNumber: 22, homeTeam: "אנגליה", awayTeam: "קרואטיה", group: "K", date: "2026-06-17", time: "18:00", stadium: "AT&T", city: "דאלאס" },
  { matchNumber: 23, homeTeam: "פורטוגל", awayTeam: "פלייאוף בין-יבשתי (קונגו / ג'מייקה / קלדוניה)", group: "L", date: "2026-06-17", time: "18:00", stadium: "NRG", city: "יוסטון" },
  { matchNumber: 24, homeTeam: "אוזבקיסטן", awayTeam: "קולומביה", group: "L", date: "2026-06-17", time: "18:00", stadium: "אסטדיו האצטקה", city: "מקסיקו סיטי" },
  { matchNumber: 25, homeTeam: "דרום אפריקה", awayTeam: "פלייאוף אירופי (דנמרק / צ'כיה / צפון מקדוניה / אירלנד)", group: "A", date: "2026-06-18", time: "18:00", stadium: "מרצדס בנץ", city: "אטלנטה" },
  { matchNumber: 26, homeTeam: "שווייץ", awayTeam: "פלייאוף אירופי (איטליה / צפון אירלנד / וויילס / בוסניה)", group: "B", date: "2026-06-18", time: "18:00", stadium: "SOFI", city: "לוס אנג'לס" },
  { matchNumber: 27, homeTeam: "קנדה", awayTeam: "קטאר", group: "B", date: "2026-06-18", time: "18:00", stadium: "BC PLACE", city: "ונקובר" },
  { matchNumber: 28, homeTeam: "מקסיקו", awayTeam: "דרום קוריאה", group: "A", date: "2026-06-18", time: "18:00", stadium: "אסטדיו אקרון", city: "גוואדלחארה" },
  { matchNumber: 29, homeTeam: "ברזיל", awayTeam: "האיטי", group: "C", date: "2026-06-19", time: "18:00", stadium: "אצטדיון לינקולן", city: "פילדלפיה" },
  { matchNumber: 30, homeTeam: "מרוקו", awayTeam: "סקוטלנד", group: "C", date: "2026-06-19", time: "18:00", stadium: "ג'ילט", city: "פוקסבורו (בוסטון)" },
  { matchNumber: 31, homeTeam: "פרגוואי", awayTeam: "פלייאוף אירופי (טורקיה / רומניה / סלובקיה / קוסובו)", group: "D", date: "2026-06-19", time: "18:00", stadium: "LEVI'S", city: "סן פרנסיסקו" },
  { matchNumber: 32, homeTeam: "ארצות הברית", awayTeam: "אוסטרליה", group: "D", date: "2026-06-19", time: "18:00", stadium: "LUMEN", city: "סיאטל" },
  { matchNumber: 33, homeTeam: "גרמניה", awayTeam: "חוף השנהב", group: "E", date: "2026-06-20", time: "18:00", stadium: "BMO", city: "טורונטו" },
  { matchNumber: 34, homeTeam: "אקוודור", awayTeam: "קורסאו", group: "E", date: "2026-06-20", time: "18:00", stadium: "Arrowhead", city: "קנזס סיטי" },
  { matchNumber: 35, homeTeam: "הולנד", awayTeam: "פלייאוף אירופי (אוקראינה / שבדיה / פולין / אלבניה)", group: "F", date: "2026-06-20", time: "18:00", stadium: "NRG", city: "יוסטון" },
  { matchNumber: 36, homeTeam: "טוניסיה", awayTeam: "יפן", group: "F", date: "2026-06-20", time: "18:00", stadium: "BBVA", city: "מונטריי" },
  { matchNumber: 37, homeTeam: "אורוגוואי", awayTeam: "כף ורדה", group: "G", date: "2026-06-21", time: "18:00", stadium: "הארד רוק", city: "מיאמי" },
  { matchNumber: 38, homeTeam: "ספרד", awayTeam: "ערב הסעודית", group: "G", date: "2026-06-21", time: "18:00", stadium: "מרצדס בנץ", city: "אטלנטה" },
  { matchNumber: 39, homeTeam: "בלגיה", awayTeam: "איראן", group: "H", date: "2026-06-21", time: "18:00", stadium: "SOFI", city: "לוס אנג'לס" },
  { matchNumber: 40, homeTeam: "מצרים", awayTeam: "ניו זילנד", group: "H", date: "2026-06-21", time: "18:00", stadium: "BC PLACE", city: "ונקובר" },
  { matchNumber: 41, homeTeam: "נורבגיה", awayTeam: "סנגל", group: "I", date: "2026-06-22", time: "18:00", stadium: "METLIFE", city: "ניו יורק – ניו ג'רזי" },
  { matchNumber: 42, homeTeam: "צרפת", awayTeam: "פלייאוף בין-יבשתי (בוליביה / סורינאם / עיראק)", group: "I", date: "2026-06-22", time: "18:00", stadium: "אצטדיון לינקולן", city: "פילדלפיה" },
  { matchNumber: 43, homeTeam: "ארגנטינה", awayTeam: "אוסטריה", group: "J", date: "2026-06-22", time: "18:00", stadium: "AT&T", city: "דאלאס" },
  { matchNumber: 44, homeTeam: "אלג'יריה", awayTeam: "ירדן", group: "J", date: "2026-06-22", time: "18:00", stadium: "LEVI'S", city: "סן פרנסיסקו" },
  { matchNumber: 45, homeTeam: "אנגליה", awayTeam: "גאנה", group: "K", date: "2026-06-23", time: "18:00", stadium: "ג'ילט", city: "פוקסבורו (בוסטון)" },
  { matchNumber: 46, homeTeam: "פנמה", awayTeam: "קרואטיה", group: "K", date: "2026-06-23", time: "18:00", stadium: "BMO", city: "טורונטו" },
  { matchNumber: 47, homeTeam: "פורטוגל", awayTeam: "אוזבקיסטן", group: "L", date: "2026-06-23", time: "18:00", stadium: "NRG", city: "יוסטון" },
  { matchNumber: 48, homeTeam: "קולומביה", awayTeam: "פלייאוף בין-יבשתי (קונגו / ג'מייקה / קלדוניה)", group: "L", date: "2026-06-23", time: "18:00", stadium: "אסטדיו אקרון", city: "גוואדלחארה" },
  { matchNumber: 49, homeTeam: "ברזיל", awayTeam: "סקוטלנד", group: "C", date: "2026-06-24", time: "18:00", stadium: "הארד רוק", city: "מיאמי" },
  { matchNumber: 50, homeTeam: "מרוקו", awayTeam: "האיטי", group: "C", date: "2026-06-24", time: "18:00", stadium: "מרצדס בנץ", city: "אטלנטה" },
  { matchNumber: 51, homeTeam: "קנדה", awayTeam: "שווייץ", group: "B", date: "2026-06-24", time: "18:00", stadium: "BC PLACE", city: "ונקובר" },
  { matchNumber: 52, homeTeam: "קטאר", awayTeam: "פלייאוף אירופי (איטליה / צפון אירלנד / וויילס / בוסניה)", group: "B", date: "2026-06-24", time: "18:00", stadium: "LUMEN", city: "סיאטל" },
  { matchNumber: 53, homeTeam: "מקסיקו", awayTeam: "פלייאוף אירופי (דנמרק / צ'כיה / צפון מקדוניה / אירלנד)", group: "A", date: "2026-06-24", time: "18:00", stadium: "אסטדיו האצטקה", city: "מקסיקו סיטי" },
  { matchNumber: 54, homeTeam: "דרום אפריקה", awayTeam: "דרום קוריאה", group: "A", date: "2026-06-24", time: "18:00", stadium: "BBVA", city: "מונטריי" },
  { matchNumber: 55, homeTeam: "קורסאו", awayTeam: "חוף השנהב", group: "E", date: "2026-06-25", time: "18:00", stadium: "אצטדיון לינקולן", city: "פילדלפיה" },
  { matchNumber: 56, homeTeam: "גרמניה", awayTeam: "אקוודור", group: "E", date: "2026-06-25", time: "18:00", stadium: "METLIFE", city: "ניו יורק – ניו ג'רזי" },
  { matchNumber: 57, homeTeam: "יפן", awayTeam: "פלייאוף אירופי (אוקראינה / שבדיה / פולין / אלבניה)", group: "F", date: "2026-06-25", time: "18:00", stadium: "AT&T", city: "דאלאס" },
  { matchNumber: 58, homeTeam: "טוניסיה", awayTeam: "הולנד", group: "F", date: "2026-06-25", time: "18:00", stadium: "Arrowhead", city: "קנזס סיטי" },
  { matchNumber: 59, homeTeam: "ארצות הברית", awayTeam: "פלייאוף אירופי (טורקיה / רומניה / סלובקיה / קוסובו)", group: "D", date: "2026-06-25", time: "18:00", stadium: "SOFI", city: "לוס אנג'לס" },
  { matchNumber: 60, homeTeam: "פרגוואי", awayTeam: "אוסטרליה", group: "D", date: "2026-06-25", time: "18:00", stadium: "LEVI'S", city: "סן פרנסיסקו" },
  { matchNumber: 61, homeTeam: "נורבגיה", awayTeam: "צרפת", group: "I", date: "2026-06-26", time: "18:00", stadium: "ג'ילט", city: "פוקסבורו (בוסטון)" },
  { matchNumber: 62, homeTeam: "סנגל", awayTeam: "פלייאוף בין-יבשתי (בוליביה / סורינאם / עיראק)", group: "I", date: "2026-06-26", time: "18:00", stadium: "BMO", city: "טורונטו" },
  { matchNumber: 63, homeTeam: "מצרים", awayTeam: "איראן", group: "H", date: "2026-06-26", time: "18:00", stadium: "LUMEN", city: "סיאטל" },
  { matchNumber: 64, homeTeam: "בלגיה", awayTeam: "ניו זילנד", group: "H", date: "2026-06-26", time: "18:00", stadium: "BC PLACE", city: "ונקובר" },
  { matchNumber: 65, homeTeam: "כף ורדה", awayTeam: "ערב הסעודית", group: "G", date: "2026-06-26", time: "18:00", stadium: "NRG", city: "יוסטון" },
  { matchNumber: 66, homeTeam: "ספרד", awayTeam: "אורוגוואי", group: "G", date: "2026-06-26", time: "18:00", stadium: "אסטדיו אקרון", city: "גוואדלחארה" },
  { matchNumber: 67, homeTeam: "אנגליה", awayTeam: "פנמה", group: "K", date: "2026-06-27", time: "18:00", stadium: "METLIFE", city: "ניו יורק – ניו ג'רזי" },
  { matchNumber: 68, homeTeam: "קרואטיה", awayTeam: "גאנה", group: "K", date: "2026-06-27", time: "18:00", stadium: "אצטדיון לינקולן", city: "פילדלפיה" },
  { matchNumber: 69, homeTeam: "אוסטריה", awayTeam: "אלג'יריה", group: "J", date: "2026-06-27", time: "18:00", stadium: "Arrowhead", city: "קנזס סיטי" },
  { matchNumber: 70, homeTeam: "ארגנטינה", awayTeam: "ירדן", group: "J", date: "2026-06-27", time: "18:00", stadium: "AT&T", city: "דאלאס" },
  { matchNumber: 71, homeTeam: "קולומביה", awayTeam: "פורטוגל", group: "L", date: "2026-06-27", time: "18:00", stadium: "הארד רוק", city: "מיאמי" },
  { matchNumber: 72, homeTeam: "אוזבקיסטן", awayTeam: "פלייאוף בין-יבשתי (קונגו / ג'מייקה / קלדוניה)", group: "L", date: "2026-06-27", time: "18:00", stadium: "מרצדס בנץ", city: "אטלנטה" },
];
