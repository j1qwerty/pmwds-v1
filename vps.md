# vps.md — Contabo `147.93.155.185`

State surveyed **2026-10-03**, before and after the two-variant split.

Host: `vmi3609364`, Ubuntu 24.04.5 LTS, kernel `6.8.0-139-generic`.
CPU **4 vCPU**, RAM **7.8 GiB**, disk 96G `/`.
Access: `ssh contabo` (root, key `E:\contabo\contabo`).

Related: [PRODUCTION.md](PRODUCTION.md) (deployment), [vps-mssqlserver.md](vps-mssqlserver.md)
(SQL Server + Redis install, SSMS connection), [mssql-issue.md](mssql-issue.md) (the latency
issue and its fix), [deploy.ps1](deploy.ps1).

---

## Sites

| URL | nginx file | root | backend | TLS |
|---|---|---|---|---|
| `https://pmwds.dharmaatribe.app` | `sites-enabled/pmwds.dharmaatribe.app` | `/var/www/pmwds-mssql/html` | `127.0.0.1:5002` | cert `pmwds.dharmaatribe.app`, exp 2026-12-31 |
| `http://147.93.155.185/` (bare IP, `default_server` on :80) | `sites-enabled/pmwds-ip` | `/var/www/pmwds-sqlite/html` | `127.0.0.1:5001` | none possible for a bare IP |
| `https://dharmaatribe.com` (+www) | `sites-enabled/dharmaatribe.com` | `/var/www/dharmaatribe.com/html` | none (static SPA) | cert exp 2026-12-24, also covers `.app`/www |
| parked `dharmaatribe.in`, `dharmatribe.in`, `dharmaatribe.app` | same file, 2nd `server` | — | `301 → https://dharmaatribe.com$request_uri` | same cert |

Local copies of the nginx files: `E:\contabo\*.nginx.conf`.
`sites-available/default` exists on disk but is **not** enabled.

Both PMWDS vhosts proxy the same four prefixes to their own backend:
`/api/` (300 s timeouts), `/hubs/` (WebSocket upgrade, 3600 s timeouts), `/files/`, `/avatars/`.
`/assets/` is immutable for a year, `index.html` is `no-store`, `client_max_body_size 50M`.

---

## The two PMWDS deployments

Branch `prod-sqlite` → **bare IP**, branch `prod-mssql` → **subdomain**. Nothing is shared:
separate directories, services, ports and databases.

| | SQLite variant | MSSQL variant |
|---|---|---|
| branch | `prod-sqlite` | `prod-mssql` |
| app | `/var/www/pmwds-sqlite/app` | `/var/www/pmwds-mssql/app` |
| client | `/var/www/pmwds-sqlite/html` | `/var/www/pmwds-mssql/html` |
| service | `pmwds-sqlite.service` | `pmwds-mssql.service` |
| env file | `/etc/pmwds/pmwds-sqlite.env` | `/etc/pmwds/pmwds-mssql.env` |
| data | `/var/lib/pmwds-sqlite/` | `/var/lib/pmwds-mssql/` |
| port | `127.0.0.1:5001` | `127.0.0.1:5002` |
| database | SQLite at `/var/lib/pmwds-sqlite/database/pmwds-v1.sqlite` | SQL Server `pmwds-v1` + `pmwds-v1_Hangfire` |
| Redis | not used (`ConnectionStrings__Redis=`) | `127.0.0.1:6379` |

`deploy.ps1` never writes to a data directory, so databases and uploads survive every deploy.

### Retired

`pmwds.dharmaatribe.app.service` (port 5001, `/var/www/pmwds.dharmaatribe.app/`) served both
hosts from one SQLite database. It is **stopped and disabled but still on disk**, so rollback is
one command. Its data at `/var/lib/pmwds/` is **intact and untouched** as an independent backup
of the pre-split state. Tarred backups of the original data and nginx configs are in
`/root/pmwds-backup/`.

Do not delete either until the split has been stable for a while.

---

## Services

| Unit | State | Notes |
|---|---|---|
| `nginx` | active | certbot timer active, auto-renew |
| `pmwds-sqlite.service` | active, enabled | `User=www-data`, `ReadWritePaths=/var/lib/pmwds-sqlite` |
| `pmwds-mssql.service` | active, enabled | `ReadWritePaths=/var/lib/pmwds-mssql`, `After=mssql-server` |
| `mssql-server.service` | active, enabled | 2022 CU 16.0.4295.3, Developer Edition |
| `redis-server.service` | active, enabled | bound to loopback only |
| `pmwds.dharmaatribe.app.service` | **inactive, disabled** | retired, kept for rollback |

Both API units use `EnvironmentFile`, `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=full`,
`ProtectHome`. `ProtectSystem=full` makes everything outside `ReadWritePaths` read-only — a
wrong path there shows up immediately as a storage write failure rather than silently writing
uploads somewhere unexpected.

### Ports

| Port | Bound to | Service |
|---|---|---|
| 5001 | `127.0.0.1` | pmwds-sqlite |
| 5002 | `127.0.0.1` | pmwds-mssql |
| 1433 | `0.0.0.0` | SQL Server — ufw-scoped to `152.58.154.0/24` |
| 6379 | `127.0.0.1` | Redis |
| 80 / 443 | public | nginx |

SQL Server and Redis are both bound to `0.0.0.0` **except** Redis, which is loopback-only.
SQL Server's public exposure is intentional and scoped: `ufw` allows 1433 from
`152.58.154.0/24` only, and both sysadmin logins are disabled. `ufw` permits only `OpenSSH` and
`Nginx Full` otherwise. Verify with `ss -tln` and `ufw status numbered`.

Redis came up on `0.0.0.0` during setup and was corrected to loopback — it has no
authentication and must stay private.

---

## SQL Server and Redis

Installed and configured 2026-10-03. Full detail, including the Ubuntu 24.04 OpenLDAP problem,
the SA password traps and SSMS connection instructions:
**[vps-mssqlserver.md](vps-mssqlserver.md)**.

Load-bearing settings — without these, requests take ~25 seconds:

```
max degree of parallelism = 1
max server memory (MB)    = 2048
network.ipaddress         = 127.0.0.1
```

Load-bearing settings — without the first two, requests take ~25 seconds:

```
max degree of parallelism = 1
max server memory (MB)    = 2048
network.ipaddress         = 0.0.0.0   (public; scoped by ufw to 152.58.154.0/24)
```

SQL Server is reachable from the internet for SSMS, scoped by firewall to the operator's
`/24`. Only **`pmwds_app`** is usable there, and it is **not** sysadmin. `sa` and `pmwds_admin`
are **disabled** — SQL Server has no per-login network ACL, so disabling is the only way to keep
an admin login off a public port. Recovery procedure in
[vps-mssqlserver.md](vps-mssqlserver.md) §5d.

Passwords, root-only:

| What | Where |
|---|---|
| `pmwds_app` (enabled, internet-reachable, not sysadmin) | `/root/pmwds-secrets/pmwds_app_password.txt` |
| `pmwds_admin` (disabled) | `/root/pmwds-secrets/pmwds_admin_password.txt` |
| `pmwds_app`, in use by the app | `/etc/pmwds/pmwds-mssql.env` (mode 0640 root:www-data) |
| ~~`sa`~~ | `/root/mssql-sa-password.txt` — **stale**, `sa` is disabled |

Firewall: `1433/tcp ALLOW 152.58.154.0/24` — one rule, scoped, not open to the world. The
operator's IP is dynamic (`152.58.154.143`, `.32`, `.107`, `.195` all seen in one week), which is
why a `/24` rather than a single address.

Other runtimes: `.NET runtime 10.0.12` (no SDK on the box — publish locally), `python 3.12.3`,
`sqlite3` CLI **not** installed.

---

## Databases

`pmwds-v1` and `pmwds-v1_Hangfire` on SQL Server. Logins:

| Login | State | Role |
|---|---|---|
| `pmwds_app` | enabled | `db_datareader`, `db_datawriter`, `db_ddladmin` on both databases. Used by the app and SSMS. Verified: SELECT/INSERT/UPDATE/DELETE/transactions/CREATE TABLE all work |
| `sa` | **disabled** | unavailable; recovery via `mssql-conf` |
| `pmwds_admin` | **disabled** | sysadmin, kept off the network deliberately |

Hangfire has `TRUSTWORTHY` on and creates its own schema at startup — which is why `pmwds_app`
has `db_ddladmin` on `pmwds-v1_Hangfire`.

SQLite copies on disk: `/var/lib/pmwds-sqlite/database/pmwds-v1.sqlite` (live, 46 tables) and the
untouched original `/var/lib/pmwds/database/pmwds-v1.sqlite`.

**SQLite backups do not protect the subdomain any more.** Back up `pmwds-v1` with
`BACKUP DATABASE` — see [vps-mssqlserver.md](vps-mssqlserver.md) §6.

---

## Measured behaviour (2026-10-03)

Over the public internet, both variants healthy:

| | SQLite (IP) | MSSQL (subdomain) |
|---|---|---|
| `POST /auth/login` | 0.258 s | 0.421 s |
| `/projects` | 0.104 s | 0.387 s |
| `/pages?page=1` (290–330 KB) | 0.110 s | 0.310 s |
| six dashboard calls in parallel | **0.269 s** | **0.414 s** |

Login from localhost, no network in the path: 0.124 s and 0.116 s — the two are
indistinguishable server-side, and the visible gap is TLS and round trip.

Memory with everything running: **1.9 GiB used of 7.8 GiB**, 5.9 GiB available.

---

## Quick verify

```powershell
# both deployments
ssh contabo "systemctl is-active pmwds-sqlite pmwds-mssql mssql-server redis-server nginx"

# the two settings that keep the subdomain fast (pmwds_app can read these)
ssh contabo "sudo /opt/mssql-tools18/bin/sqlcmd -S 127.0.0.1,1433 -U pmwds_app -P `$(sudo cat /root/pmwds-secrets/pmwds_app_password.txt) -C -h-1 -W -Q `"SET NOCOUNT ON; SELECT CONCAT(name,'=',value_in_use) FROM sys.configurations WHERE name IN ('max degree of parallelism','max server memory (MB)');`""

# only pmwds_app should be reachable from outside; sa and pmwds_admin are disabled
curl -s -o /dev/null -w 'direct 1433 as pmwds_app: %{http_code}\n' --max-time 10 https://api.ipify.org > /dev/null; echo "(see vps-mssqlserver.md 5.4)"

# end to end, from here
curl -s -o /dev/null -w 'IP       %{http_code}\n' http://147.93.155.185/
curl -s -o /dev/null -w 'sub      %{http_code}\n' https://pmwds.dharmaatribe.app/
curl -s -o /dev/null -w 'IP hubs  %{http_code}\n' -X POST "http://147.93.155.185/hubs/dashboard/negotiate?negotiateVersion=1"
curl -s -o /dev/null -w 'sub hubs %{http_code}\n' -X POST "https://pmwds.dharmaatribe.app/hubs/dashboard/negotiate?negotiateVersion=1"
# 401 on both hubs = correct: DashboardHub is [Authorize], so an unauthenticated negotiate
# is supposed to be refused. It proves nginx reached the API rather than serving the SPA.

ssh contabo "nginx -t && sudo systemctl reload nginx"
ssh contabo "certbot certificates"
```

---

## Deploy

```powershell
git checkout prod-sqlite   # or prod-mssql
.\deploy.ps1               # prompts for the variant, defaults to the branch's
```

`deploy.ps1` never touches nginx, so vhost changes are manual. After any nginx edit, confirm both
`/hubs/` blocks still proxy and reload with `nginx -t && systemctl reload nginx`.
