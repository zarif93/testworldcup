# Environment and configuration reference

Minimal and optional variables for local, staging, and production. See also `server/docs/launch-audit.md` §4.

## Required for production

| Variable | Description |
|----------|-------------|
| **JWT_SECRET** | Secret for signing auth cookies. Non-empty required in production. |
| **NODE_ENV** | Set to `production` for production. |

## Database

| Variable | Description |
|----------|-------------|
| **DATABASE_URL** | If unset, SQLite is used (./data). If set (MySQL URL), use MySQL. |

## Optional – auth and admin

| Variable | Description |
|----------|-------------|
| **ADMIN_SECRET** | If set, admin area requires this cookie in addition to login. Must be non-empty if set. |
| **SUPER_ADMIN_USERNAMES** | Comma-separated usernames for super-admin (e.g. full reset). Default: Yoven!,Yoven |

## Optional – server and URLs

| Variable | Description |
|----------|-------------|
| **PORT** | HTTP port. Default 3000. |
| **BASE_URL** | Full base URL for OAuth and links. Default http://localhost:PORT |
| **OAUTH_SERVER_URL** | OAuth server URL. Default BASE_URL |
| **ALLOWED_ORIGINS** | Comma-separated CORS origins. In production with empty, request origin is used. |
| **SAME_SITE_LAX_SAME_ORIGIN** | 1 or true for SameSite=Lax when same-origin. Default false. |

## Optional – business and workers

| Variable | Description |
|----------|-------------|
| **INSTANCE_ID** | Identifier for this process (locks, workers). Default node-{pid}-{ts} |
| **AGENT_COMMISSION_PERCENT_OF_FEE** | Percent of house fee given to agent. Default 50. |
| **VITE_APP_ID** | App id for frontend. |
| **OWNER_OPEN_ID** | Owner OpenID if used. |
| **BUILT_IN_FORGE_API_URL** / **BUILT_IN_FORGE_API_KEY** | Forge API if used. |

## Local

- **JWT_SECRET**: Can be empty.
- **DATABASE_URL**: Omit for SQLite.
- **PORT**: 3000 or any free port.

## Staging

- **JWT_SECRET**: Set.
- **NODE_ENV**: staging or production.
- **DATABASE_URL**: Optional (SQLite or MySQL).
- **ADMIN_SECRET**: Recommended.
- **BASE_URL**: Staging URL.

## Production

- **JWT_SECRET**: Required, non-empty.
- **NODE_ENV**: production.
- **DATABASE_URL**: Optional; if omitted, SQLite must have write access to ./data.
- **ADMIN_SECRET**: Recommended.
- **BASE_URL**: Production URL.
- **ALLOWED_ORIGINS**: Recommended for CORS.
- Startup exits with code 1 if critical config invalid or DB unreachable.
