/**
 * FIFA World Cup 2026 - משחקי שלב הבתים (מעודכן)
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

const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;
function groupForMatch(n: number) {
  return groups[Math.floor((n - 1) / 6)] ?? "A";
}
function dateForMatch(n: number) {
  const day = 11 + Math.floor((n - 1) / 6);
  return `2026-06-${String(day).padStart(2, "0")}`;
}

export const WORLD_CUP_2026_MATCHES: MatchData[] = [
  { matchNumber: 1, homeTeam: "Mexico", awayTeam: "South Africa", group: groupForMatch(1), date: dateForMatch(1), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 2, homeTeam: "Republic of Korea", awayTeam: "UEFA D", group: groupForMatch(2), date: dateForMatch(2), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 3, homeTeam: "Canada", awayTeam: "UEFA A", group: groupForMatch(3), date: dateForMatch(3), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 4, homeTeam: "United States", awayTeam: "Paraguay", group: groupForMatch(4), date: dateForMatch(4), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 5, homeTeam: "Qatar", awayTeam: "Switzerland", group: groupForMatch(5), date: dateForMatch(5), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 6, homeTeam: "Brazil", awayTeam: "Morocco", group: groupForMatch(6), date: dateForMatch(6), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 7, homeTeam: "Haiti", awayTeam: "Scotland", group: groupForMatch(7), date: dateForMatch(7), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 8, homeTeam: "Australia", awayTeam: "UEFA C", group: groupForMatch(8), date: dateForMatch(8), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 9, homeTeam: "Germany", awayTeam: "Curaçao", group: groupForMatch(9), date: dateForMatch(9), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 10, homeTeam: "Netherlands", awayTeam: "Japan", group: groupForMatch(10), date: dateForMatch(10), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 11, homeTeam: "Ivory Coast", awayTeam: "Ecuador", group: groupForMatch(11), date: dateForMatch(11), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 12, homeTeam: "UEFA B", awayTeam: "Tunisia", group: groupForMatch(12), date: dateForMatch(12), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 13, homeTeam: "Spain", awayTeam: "Cape Verde", group: groupForMatch(13), date: dateForMatch(13), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 14, homeTeam: "Belgium", awayTeam: "Egypt", group: groupForMatch(14), date: dateForMatch(14), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 15, homeTeam: "Saudi Arabia", awayTeam: "Uruguay", group: groupForMatch(15), date: dateForMatch(15), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 16, homeTeam: "Iran", awayTeam: "New Zealand", group: groupForMatch(16), date: dateForMatch(16), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 17, homeTeam: "France", awayTeam: "Senegal", group: groupForMatch(17), date: dateForMatch(17), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 18, homeTeam: "PLAYOFF 2", awayTeam: "Norway", group: groupForMatch(18), date: dateForMatch(18), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 19, homeTeam: "Argentina", awayTeam: "Algeria", group: groupForMatch(19), date: dateForMatch(19), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 20, homeTeam: "Austria", awayTeam: "Jordan", group: groupForMatch(20), date: dateForMatch(20), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 21, homeTeam: "Portugal", awayTeam: "Playoff 1", group: groupForMatch(21), date: dateForMatch(21), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 22, homeTeam: "England", awayTeam: "Croatia", group: groupForMatch(22), date: dateForMatch(22), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 23, homeTeam: "Ghana", awayTeam: "Panama", group: groupForMatch(23), date: dateForMatch(23), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 24, homeTeam: "Uzbekistan", awayTeam: "Colombia", group: groupForMatch(24), date: dateForMatch(24), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 25, homeTeam: "UEFA D", awayTeam: "South Africa", group: groupForMatch(25), date: dateForMatch(25), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 26, homeTeam: "Switzerland", awayTeam: "UEFA A", group: groupForMatch(26), date: dateForMatch(26), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 27, homeTeam: "Canada", awayTeam: "Qatar", group: groupForMatch(27), date: dateForMatch(27), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 28, homeTeam: "Mexico", awayTeam: "South Korea", group: groupForMatch(28), date: dateForMatch(28), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 29, homeTeam: "USA", awayTeam: "Australia", group: groupForMatch(29), date: dateForMatch(29), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 30, homeTeam: "Scotland", awayTeam: "Morocco", group: groupForMatch(30), date: dateForMatch(30), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 31, homeTeam: "Brazil", awayTeam: "Haiti", group: groupForMatch(31), date: dateForMatch(31), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 32, homeTeam: "UEFA C", awayTeam: "Paraguay", group: groupForMatch(32), date: dateForMatch(32), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 33, homeTeam: "Netherlands", awayTeam: "UEFA B", group: groupForMatch(33), date: dateForMatch(33), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 34, homeTeam: "Germany", awayTeam: "Ivory Coast", group: groupForMatch(34), date: dateForMatch(34), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 35, homeTeam: "Ecuador", awayTeam: "Curaçao", group: groupForMatch(35), date: dateForMatch(35), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 36, homeTeam: "Tunisia", awayTeam: "Japan", group: groupForMatch(36), date: dateForMatch(36), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 37, homeTeam: "Spain", awayTeam: "Saudi Arabia", group: groupForMatch(37), date: dateForMatch(37), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 38, homeTeam: "Belgium", awayTeam: "Iran", group: groupForMatch(38), date: dateForMatch(38), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 39, homeTeam: "Uruguay", awayTeam: "Cape Verde", group: groupForMatch(39), date: dateForMatch(39), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 40, homeTeam: "New Zealand", awayTeam: "Egypt", group: groupForMatch(40), date: dateForMatch(40), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 41, homeTeam: "Argentina", awayTeam: "Austria", group: groupForMatch(41), date: dateForMatch(41), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 42, homeTeam: "France", awayTeam: "Playoff 2", group: groupForMatch(42), date: dateForMatch(42), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 43, homeTeam: "Norway", awayTeam: "Senegal", group: groupForMatch(43), date: dateForMatch(43), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 44, homeTeam: "Jordan", awayTeam: "Algeria", group: groupForMatch(44), date: dateForMatch(44), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 45, homeTeam: "Portugal", awayTeam: "Uzbekistan", group: groupForMatch(45), date: dateForMatch(45), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 46, homeTeam: "England", awayTeam: "Ghana", group: groupForMatch(46), date: dateForMatch(46), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 47, homeTeam: "Panama", awayTeam: "Croatia", group: groupForMatch(47), date: dateForMatch(47), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 48, homeTeam: "Colombia", awayTeam: "PLAYOFF 1", group: groupForMatch(48), date: dateForMatch(48), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 49, homeTeam: "Switzerland", awayTeam: "Canada", group: groupForMatch(49), date: dateForMatch(49), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 50, homeTeam: "UEFA A", awayTeam: "Qatar", group: groupForMatch(50), date: dateForMatch(50), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 51, homeTeam: "Brazil", awayTeam: "Scotland", group: groupForMatch(51), date: dateForMatch(51), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 52, homeTeam: "Morocco", awayTeam: "Haiti", group: groupForMatch(52), date: dateForMatch(52), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 53, homeTeam: "UEFA D", awayTeam: "Mexico", group: groupForMatch(53), date: dateForMatch(53), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 54, homeTeam: "South Africa", awayTeam: "South Korea", group: groupForMatch(54), date: dateForMatch(54), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 55, homeTeam: "Curaçao", awayTeam: "Ivory Coast", group: groupForMatch(55), date: dateForMatch(55), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 56, homeTeam: "Ecuador", awayTeam: "Germany", group: groupForMatch(56), date: dateForMatch(56), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 57, homeTeam: "Japan", awayTeam: "UEFA B", group: groupForMatch(57), date: dateForMatch(57), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 58, homeTeam: "Tunisia", awayTeam: "Netherlands", group: groupForMatch(58), date: dateForMatch(58), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 59, homeTeam: "UEFA C", awayTeam: "USA", group: groupForMatch(59), date: dateForMatch(59), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 60, homeTeam: "Paraguay", awayTeam: "Australia", group: groupForMatch(60), date: dateForMatch(60), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 61, homeTeam: "Norway", awayTeam: "France", group: groupForMatch(61), date: dateForMatch(61), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 62, homeTeam: "Senegal", awayTeam: "PLAYOFF 2", group: groupForMatch(62), date: dateForMatch(62), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 63, homeTeam: "Cape Verde", awayTeam: "Saudi Arabia", group: groupForMatch(63), date: dateForMatch(63), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 64, homeTeam: "Uruguay", awayTeam: "Spain", group: groupForMatch(64), date: dateForMatch(64), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 65, homeTeam: "Egypt", awayTeam: "Iran", group: groupForMatch(65), date: dateForMatch(65), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 66, homeTeam: "New Zealand", awayTeam: "Belgium", group: groupForMatch(66), date: dateForMatch(66), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 67, homeTeam: "Panama", awayTeam: "England", group: groupForMatch(67), date: dateForMatch(67), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 68, homeTeam: "Croatia", awayTeam: "Ghana", group: groupForMatch(68), date: dateForMatch(68), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 69, homeTeam: "Colombia", awayTeam: "Portugal", group: groupForMatch(69), date: dateForMatch(69), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 70, homeTeam: "PLAYOFF 1", awayTeam: "Uzbekistan", group: groupForMatch(70), date: dateForMatch(70), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 71, homeTeam: "Algeria", awayTeam: "Austria", group: groupForMatch(71), date: dateForMatch(71), time: "18:00", stadium: "TBD", city: "TBD" },
  { matchNumber: 72, homeTeam: "Jordan", awayTeam: "Argentina", group: groupForMatch(72), date: dateForMatch(72), time: "18:00", stadium: "TBD", city: "TBD" },
];
