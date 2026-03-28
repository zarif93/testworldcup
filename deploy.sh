#!/bin/bash
# Deploy script – Ubuntu 24.04 LTS x64
# Usage: chmod +x deploy.sh && ./deploy.sh
# Run from project root (e.g. /var/www/worldcup2026).
# Note: npm run build requires devDependencies (vite, esbuild), so we use npm install (not --production).

set -e

echo "=== Updating system packages ==="
sudo apt update
sudo apt install -y nodejs npm nginx build-essential python3

echo "=== Installing dependencies ==="
if command -v pnpm >/dev/null 2>&1; then
  pnpm install
  echo "=== Rebuilding better-sqlite3 (native module) ==="
  pnpm rebuild better-sqlite3 || true
else
  npm install
  echo "=== Rebuilding better-sqlite3 (native module) ==="
  npm rebuild better-sqlite3 || true
fi

echo "=== Building application (client + server) ==="
if command -v pnpm >/dev/null 2>&1; then
  pnpm run build
else
  npm run build
fi

echo "=== Preparing environment ==="
if [ ! -f .env.production ] && [ -f .env.production.example ]; then
  echo "Copying .env.production.example to .env.production – set JWT_SECRET, ALLOWED_ORIGINS, and other secrets."
  cp .env.production.example .env.production
fi
if [ ! -f .env.production ]; then
  echo "Warning: .env.production not found. Create from .env.production.example and set JWT_SECRET."
fi

echo "=== Starting PM2 (production) ==="
if command -v pnpm >/dev/null 2>&1; then
  pnpm exec pm2 start ecosystem.config.cjs --env production 2>/dev/null || pnpm exec pm2 reload ecosystem.config.cjs --env production
else
  npx pm2 start ecosystem.config.cjs --env production 2>/dev/null || npx pm2 reload ecosystem.config.cjs --env production
fi
pm2 save 2>/dev/null || npx pm2 save 2>/dev/null || true

echo "=== Restarting Nginx ==="
sudo systemctl restart nginx 2>/dev/null || true

echo "=== Done ==="
echo "App (direct): http://localhost"
echo "To enable Nginx reverse proxy: copy deployment/nginx-worldcup2026.conf to /etc/nginx/sites-available/ and enable the site."
