#!/usr/bin/env bash
# Run this ON THE LIVE SERVER (where nginx runs) to find the real active config and upload limit.
# Usage: sudo bash scripts/diagnose-upload-413.sh
# Or:    scp scripts/diagnose-upload-413.sh user@megatoto.net:/tmp && ssh user@megatoto.net "sudo bash /tmp/diagnose-upload-413.sh"

set -e
LIVE_DOMAIN="${LIVE_DOMAIN:-megatoto.net}"

echo "=============================================="
echo "1. NGINX SITES-ENABLED (which configs are active)"
echo "=============================================="
if [ -d /etc/nginx/sites-enabled ]; then
  ls -la /etc/nginx/sites-enabled/
else
  echo "No /etc/nginx/sites-enabled"
fi

echo ""
echo "=============================================="
echo "2. EFFECTIVE NGINX CONFIG: server_name and client_max_body_size"
echo "    (nginx -T = full effective config after includes)"
echo "=============================================="
nginx -T 2>/dev/null | grep -E "server_name|client_max_body_size|configuration file" || true

echo ""
echo "=============================================="
echo "3. SERVER BLOCKS CONTAINING $LIVE_DOMAIN"
echo "=============================================="
nginx -T 2>/dev/null | awk -v domain="$LIVE_DOMAIN" '
  /^server \{/ { in_server=1; block="" }
  in_server { block = block $0 "\n" }
  /^\}/ && in_server {
    if (block ~ domain) print block
    in_server=0
  }
' || true

echo ""
echo "=============================================="
echo "4. WHICH CONFIG FILE DEFINES THE SITE?"
echo "=============================================="
# nginx -T prints "# configuration file /path" before each file's content
nginx -T 2>/dev/null | grep -B200 "server_name.*$LIVE_DOMAIN" | grep "configuration file" | tail -1 || echo "Could not determine. Check section 2."

echo ""
echo "=============================================="
echo "5. RECOMMENDED FIX"
echo "=============================================="
echo "In the server block for $LIVE_DOMAIN, set:"
echo "  client_max_body_size 50m;"
echo ""
echo "Then: sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "=============================================="
echo "6. CLOUDFLARE / PROXY CHECK (run locally)"
echo "=============================================="
echo "If the site is behind Cloudflare (or another proxy), their limit applies first."
echo "  - DNS: dig $LIVE_DOMAIN  (if A/AAAA points to Cloudflare IPs, proxy is on)"
echo "  - Cloudflare: Dashboard -> Scrape Shield / Security -> check upload/body limits"
echo "  - Free plan often allows 100MB; ensure it is not lower."
echo ""
