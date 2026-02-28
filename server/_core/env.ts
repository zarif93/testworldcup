export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  /** קוד מנהל סודי – אם מוגדר, נדרש להזנה לפני גישה ללוח הניהול */
  adminSecret: process.env.ADMIN_SECRET ?? "",
  /** אחוז מעמלת האתר (12.5%) שהסוכן מקבל – למשל 50 = סוכן מקבל 50% מ-12.5% = 6.25% מסכום התפוס */
  agentCommissionPercentOfFee: Math.min(100, Math.max(0, Number(process.env.AGENT_COMMISSION_PERCENT_OF_FEE) || 50)),
};
