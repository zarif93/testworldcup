export const COOKIE_NAME = "app_session_id";
export const ADMIN_VERIFIED_COOKIE = "admin_code_verified";
export const SUPER_ADMIN_USERNAME = "Yoven!"; // סופר מנהל – רק משתמש זה יכול לנהל מנהלים אחרים
/** שמות משתמש שמוכרים כסופר מנהל (למקרה שנרשם בלי סימן קריאה וכו') */
export const SUPER_ADMIN_USERNAMES: string[] = ["Yoven!", "Yoven"];
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = "עליך להירשם או להתחבר כדי לשלוח טופס";
export const NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
