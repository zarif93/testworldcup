/**
 * PM2 ecosystem config – Production on Ubuntu 24.04 (CommonJS for "type": "module" projects)
 * Start: pm2 start ecosystem.config.cjs --env production
 * Reload: pm2 reload ecosystem.config.cjs --env production
 * PORT is read from .env.production when the app starts.
 */
module.exports = {
  apps: [
    {
      name: "worldcup2026",
      script: "dist/index.js",
      cwd: __dirname,
      // Keep production footprint predictable; override with PM2_INSTANCES if needed.
      instances: Number(process.env.PM2_INSTANCES || 2),
      exec_mode: "cluster",
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
