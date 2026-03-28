/**
 * PM2 ecosystem config – Production on Ubuntu 24.04 (CommonJS for "type": "module" projects)
 * Start: pm2 start ecosystem.config.cjs --env production
 * Reload: pm2 reload ecosystem.config.cjs --env production
 * PORT is read from .env.production when the app starts.
 * Uses fork + 1 instance: SQLite and in-process timers must not be duplicated across workers.
 */
module.exports = {
  apps: [
    {
      name: "worldcup2026",
      script: "dist/index.js",
      cwd: __dirname,
      // SQLite + in-process jobs require exactly one Node process. Do not use cluster / multiple instances.
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
        // PORT: override in .env.production; default 3000
        PORT: process.env.PORT || "3000",
      },
    },
  ],
};
