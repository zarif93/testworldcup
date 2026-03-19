# Fix 413 (HTML) on Live Server – Find Real Limit and Fix

If the frontend gets **413 Request Entity Too Large** and **HTML** instead of JSON, the request is being rejected **before** it reaches the Node app (usually nginx or a CDN).

---

## 1. Find the actual active nginx config

Do **not** assume the repo’s `nginx-worldcup2026.conf` is the one in use. The live server may use a different path or an older file.

**On the live server** (SSH):

```bash
# Which configs are enabled?
ls -la /etc/nginx/sites-enabled/

# Full effective config (all includes merged)
sudo nginx -T 2>&1 | less
```

Search for:

- `server_name` – find the block that lists your live domain (e.g. `megatoto.net`).
- `client_max_body_size` – in that **server** (or in a **location** that overrides it).  
  If there is no `client_max_body_size` in that block, nginx uses the **default 1m**, which causes 413 for uploads.

**Or run the project script** (copy it to the server first):

```bash
# From your machine
scp scripts/diagnose-upload-413.sh user@your-server:/tmp/

# On the server
sudo bash /tmp/diagnose-upload-413.sh
```

Use the script output to see:

- What’s in `sites-enabled`
- Every `server_name` and `client_max_body_size` in the effective config
- Which server block matches the live domain

The **exact config file** that is active is the one that appears in `sites-enabled` (symlink) and that `nginx -T` shows as “configuration file …” for the server block you care about.

---

## 2. Effective nginx config (nginx -T)

Run:

```bash
sudo nginx -T 2>&1 | grep -n "server_name\|client_max_body_size"
```

Interpret:

- **server_name** for your domain → that server block is the one serving the site.
- **client_max_body_size** in that same block (or in a `location /` inside it) is the **effective limit** for uploads.  
  If it’s missing or `1m`, that’s why you get 413 and HTML.

---

## 3. Upstream proxy / CDN limits

If the browser talks to **Cloudflare** (or another proxy), their limit applies **before** nginx.

- **Cloudflare:**  
  - Check DNS: if the domain is “proxied” (orange cloud), traffic goes through Cloudflare.  
  - Free plan usually allows ~100 MB request body; confirm in the dashboard (e.g. Scrape Shield / Security or plan limits).  
- **Other reverse proxy:**  
  Check its docs for “max body size” or “upload size” and set it to at least 50 MB (or 25 MB minimum).

If you fix nginx but still get 413, the limit is almost certainly at the proxy/CDN.

---

## 4. Verify request size (frontend)

Before sending the request, the app logs to the **browser console**:

- File size (bytes and MB)
- Upload type (site-background / media)
- Target URL (`/api/upload`)
- Client-side limit (8 MB or 5 MB)

Compare:

- **File size** vs **client limit** (8 MB or 5 MB) → if file is larger, the UI should block or show the Hebrew message.
- **File size** vs **nginx** `client_max_body_size` → if file is under 8 MB but over 1m, and nginx is still 1m, 413 + HTML is expected.
- **File size** vs **multer** (app) limit → 50 MB in code; if nginx is fixed, the next bottleneck would be multer (already 50 MB).

So: **mismatch** = nginx (or CDN) limit is smaller than the uploaded file size.

---

## 5. Fix globally on the live site

1. **Edit the actual file** that defines the server block for the live domain (from step 1).  
   Example (path may differ):

   ```bash
   sudo nano /etc/nginx/sites-available/worldcup2026
   # or
   sudo nano /etc/nginx/sites-enabled/worldcup2026
   ```

2. In the **server { … }** block for your domain, set (or update):

   ```nginx
   client_max_body_size 50m;
   ```

   Put it near the top of the block (e.g. after `server_name`). If you have a `location /` that already sets `client_max_body_size`, set it in the **server** block so it applies to all locations, or ensure the **location** value is at least **50m**.

3. Test and reload:

   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

4. If the site is behind Cloudflare (or another proxy), also set their body/upload limit to at least 50 MB (or 25 MB minimum).

---

## 6. Frontend diagnostics and message

- **Console:** Every upload logs file size, type, target, and client limit. Use this to compare with nginx/CDN.
- **413:** The app always shows the clean Hebrew message:  
  **"הקובץ גדול מדי להעלאה. נסה קובץ קטן יותר או פורמט WebP."**  
  No raw HTML is shown. Optional: set `window.__UPLOAD_DEBUG = true` and reload to log 413 response body snippet.

---

## 7. Proof after fix

After applying the change and reloading nginx (and proxy if any), record:

| Item | Value |
|------|--------|
| **Exact nginx config file** for the live domain | e.g. `/etc/nginx/sites-enabled/worldcup2026` (from `sites-enabled` + `nginx -T`) |
| **Exact client_max_body_size** for that server block | e.g. `50m` |
| **Another proxy/CDN?** | e.g. Cloudflare yes/no; if yes, their limit (e.g. 100 MB) |
| **Test:** file size uploaded | e.g. 3.2 MB image |
| **Test result** | Success → JSON; or 413 → still HTML (then limit is at proxy/CDN) |
| **Max safe upload size** | e.g. 50 MB (or min(nginx, CDN, multer)) |

Example:

- **Config file:** `/etc/nginx/sites-enabled/worldcup2026`
- **client_max_body_size:** `50m`
- **CDN:** Cloudflare, 100 MB
- **Test:** 4 MB image → 200 JSON
- **Max safe upload:** 50 MB (nginx and app; client still limits to 8 MB / 5 MB for UX)
