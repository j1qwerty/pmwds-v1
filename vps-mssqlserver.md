# vps-mssqlserver.md — SQL Server and Redis on the Contabo VPS

How the `prod-mssql` deployment's database layer is installed, configured, secured and reached
from a developer machine. Written from the actual installation on 2026-10-03, including every
thing that went wrong on the way.

Related: [PRODUCTION.md](PRODUCTION.md) (§3b provisioning), [mssql-issue.md](mssql-issue.md)
(the latency problem and its fix), [vps.md](vps.md) (what is on the box).

---

## 1. What is installed

| Component | Version | Location | Listens on |
|---|---|---|---|
| SQL Server | 2022 CU, 16.0.4295.3, **Developer Edition** | `/opt/mssql` | `127.0.0.1:1433` |
| SQL Server data | — | `/var/opt/mssql/data` | — |
| SQL Server config | — | `/var/opt/mssql/mssql.conf` | — |
| `sqlcmd` (mssql-tools18) | 18.7.1.1 | `/opt/mssql-tools18/bin/sqlcmd` | — |
| Redis | 7.0.15 | `/etc/redis/redis.conf`, data `/var/lib/redis` | `127.0.0.1:6379` |
| OpenLDAP 2.5 shim | 2.5.20 (from 22.04) | `/usr/lib/x86_64-linux-gnu/libl{ber,dap}-2.5.so.0` | — |

Databases: `pmwds-v1` (application) and `pmwds-v1_Hangfire` (background jobs).

### Logins

| Login | Status | Reachable from the internet | Purpose |
|---|---|---|---|
| `pmwds_app` | enabled | **yes** — `147.93.155.185,1433` | the application, and SSMS. Not sysadmin |
| `sa` | **disabled** | no | unavailable; see §5d to re-enable |
| `pmwds_admin` | **disabled** | no | sysadmin replacement, disabled to keep it off the network |

Only `pmwds_app` is internet-reachable, and it is not sysadmin. SQL Server has no per-login
network ACL, so the way to keep an admin login off the network is to disable it entirely — that
is why both admin accounts are switched off rather than merely left unexposed. Never run the
application as an admin login.

### Critical settings, and why they matter

```
max degree of parallelism = 1        <-- the fix. Without it, requests stall ~25s.
max server memory (MB)    = 2048     <-- leaves ~2GB for everything else on a 7.8GB box
network.ipaddress         = 0.0.0.0  <-- public, scoped by ufw to 152.58.154.0/24 (see 5f)
network.tcpport           = 1433
memory.memorylimitmb      = 2048
```

`max degree of parallelism = 1` is not a tuning preference, it is what makes the deployment
usable. With the default (`0`, meaning "up to 8 threads per query") and seven concurrent
requests from the browser, SQL Server starved its own memory grants and every request suspended
having read nothing. Measured: **33.01 s → 0.30 s**. Full analysis in
[mssql-issue.md](mssql-issue.md).

---

## 2. Install, from scratch

Ubuntu 24.04. Microsoft publishes SQL Server 2022 packages for 22.04, which are what you
install here.

```bash
# 1. Microsoft repo
curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
  | sudo tee /etc/apt/trusted.gpg.d/microsoft.asc > /dev/null
curl -fsSL https://packages.microsoft.com/config/ubuntu/22.04/mssql-server-2022.list \
  | sudo tee /etc/apt/sources.list.d/mssql-server-2022.list
apt-get update -qq

# 2. The engine
ACCEPT_EULA=Y DEBIAN_FRONTEND=noninteractive apt-get install -y mssql-server

# 3. sqlcmd - NOTE: this is a DIFFERENT repo, see the challenges below
curl -fsSL https://packages.microsoft.com/config/ubuntu/22.04/prod.list \
  | sudo tee /etc/apt/sources.list.d/mssql-release.list
apt-get update -qq
ACCEPT_EULA=Y DEBIAN_FRONTEND=noninteractive apt-get install -y mssql-tools18 unixodbc-dev
```

### 2a. The OpenLDAP problem — you will hit this

SQL Server will not start on Ubuntu 24.04:

```
/opt/mssql/bin/sqlservr: error while loading shared libraries:
  liblber-2.5.so.0: cannot open shared object file: No such file or directory
```

Ubuntu 24.04 replaced OpenLDAP 2.5 with 2.6. **Symlinking does not work.** It looks like it
should — the file resolves — but the binary requires a specific *symbol version*:

```
version `OPENLDAP_2.5' not found (required by /opt/mssql/bin/sqlservr)
```

You need the genuine 2.5 libraries. They coexist with 2.6 because the sonames differ:

```bash
curl -fsSL \
  http://archive.ubuntu.com/ubuntu/pool/main/o/openldap/libldap-2.5-0_2.5.20+dfsg-0ubuntu0.22.04.1_amd64.deb \
  -o /tmp/libldap-2.5.deb
sudo dpkg -i /tmp/libldap-2.5.deb
sudo ldconfig
```

Verify before moving on:

```bash
ldd /opt/mssql/bin/sqlservr | grep -i 'not found' || echo "all libraries resolved"
```

> **`liblber-2.5-0` is not a package.** Both `liblber-2.5.so.0` and `libldap-2.5.so.0` ship
> inside `libldap-2.5-0`. Searching the archive for a separate `liblber` package wastes time.

### 2b. First-time setup and the SA password

This is the step with the sharpest edge.

```bash
sudo systemctl stop mssql-server      # REQUIRED - setup refuses while it is running

export MSSQL_SA_PASSWORD='<strong password>'
MSSQL_SA_PASSWORD="$MSSQL_SA_PASSWORD" ACCEPT_EULA=Y sudo -E \
  /opt/mssql/bin/mssql-conf -n setup accept-eula

sudo systemctl enable mssql-server
sudo systemctl start mssql-server
```

**Three traps, all of which cost time here:**

1. **`mssql-conf setup` will not run while the service is up.** It prints "An instance of SQL
   Server is running. Please stop the SQL Server service" and changes nothing — but the
   password you exported then looks like it was set. Stop the service first.

2. **If you omit `MSSQL_SA_PASSWORD`, setup silently keeps the existing password.** There is no
   error. If you do not know the current one, you cannot connect as `sa` and have to redo
   setup with the service stopped.

3. **`sudo` drops the variable.** `MSSQL_SA_PASSWORD=x sudo mssql-conf ...` does not work —
   the assignment applies to `sudo`, not to what `sudo` runs. Use `sudo -E` with the variable
   exported, as above.

Password requirements: at least 8 characters from three of four categories. A 32-character
base64 string is comfortably beyond that.

Record it. It is stored at:

| What | Where | Mode |
|---|---|---|
| `pmwds_app` password | `/root/pmwds-secrets/pmwds_app_password.txt` | `0600 root` |
| `pmwds_admin` password (login disabled) | `/root/pmwds-secrets/pmwds_admin_password.txt` | `0600 root` |
| `pmwds_app` password, in use | `/etc/pmwds/pmwds-mssql.env` | `0640 root:www-data` |
| ~~`sa` password~~ | `/root/mssql-sa-password.txt` | **stale** — `sa` is disabled |

Because `sa` is disabled, most of the `sqlcmd` commands in this document need `pmwds_admin`
instead, which is *also* disabled. In practice: re-enable an admin login per §5d, do the
maintenance, disable it again. Routine day-to-day work needs neither.

### 2c. Confirm it is up

```bash
systemctl is-active mssql-server           # active
ss -tln | grep 1433                        # 0.0.0.0:1433 on this instance (see 3a, 5f)
sudo /opt/mssql-tools18/bin/sqlcmd -S 127.0.0.1,1433 -U sa -P "$MSSQL_SA_PASSWORD" -C \
  -Q "SELECT @@VERSION"
```

This works immediately after setup, because `sa` is enabled at this point. It is disabled once
configuration is finished — see §5d.

---

## 3. Configure it properly

### 3a. Bind to loopback and cap memory — via `mssql-conf`

Do this **before** anything else. Setting a value with `mssql-conf` is also what implicitly
enables advanced options, without which step 3b fails.

```bash
sudo /opt/mssql/bin/mssql-conf set network.ipaddress 127.0.0.1
sudo /opt/mssql/bin/mssql-conf set network.tcpport 1433
sudo /opt/mssql/bin/mssql-conf set memory.memorylimitmb 2048
sudo systemctl restart mssql-server
```

**Sizing:** the box is 7.8 GiB. 2048 MB for SQL Server leaves room for nginx, two API
processes, Redis and the OS. Do not raise it — an over-large buffer pool on a small box
reproduces the paging behaviour that caused the original problem.

> **This instance is currently bound to `0.0.0.0`, not loopback**, because direct SSMS access
> over the public IP was requested. It is scoped by `ufw` to `152.58.154.0/24` — see §5f — and
> both sysadmin logins are disabled (§5d). To return it to loopback-only, follow the removal
> steps at the end of §5f.

### 3b. `MAXDOP = 1` and the server memory setting — via `sp_configure`

```sql
EXEC sp_configure 'show advanced options', 1; RECONFIGURE;
EXEC sp_configure 'max degree of parallelism', 1; RECONFIGURE;
EXEC sp_configure 'max server memory (MB)', 2048; RECONFIGURE;
```

Restart so the memory setting takes effect, then verify:

```sql
SELECT name, value_in_use FROM sys.configurations
WHERE name IN ('max degree of parallelism', 'max server memory (MB)',
               'show advanced options', 'network.ipaddress');
```

Expected:

```
max degree of parallelism    1
max server memory (MB)       2048
show advanced options        1
network.ipaddress            127.0.0.1
```

> On the Windows dev machine `sp_configure` refuses both of these and
> `show advanced options` silently reverts. That is a quirk of that install, not of SQL
> Server — on Linux it works fine. Do not carry the conclusion that "these settings cannot be
> changed" over from Windows. See [mssql-issue.md](mssql-issue.md) §9.

### 3c. Databases and the application login

```bash
# sa is still enabled at this point in a fresh setup; it is disabled afterwards (5d).
sudo /opt/mssql-tools18/bin/sqlcmd -S 127.0.0.1,1433 -U sa -P "$MSSQL_SA_PASSWORD" -C -Q "
CREATE DATABASE [pmwds-v1];
CREATE DATABASE [pmwds-v1_Hangfire];
"
```

```sql
CREATE LOGIN [pmwds_app] WITH PASSWORD = '<strong password>', CHECK_POLICY = ON;

USE [pmwds-v1];
CREATE USER [pmwds_app] FOR LOGIN [pmwds_app];
ALTER ROLE db_datareader ADD MEMBER [pmwds_app];
ALTER ROLE db_datawriter ADD MEMBER [pmwds_app];
ALTER ROLE db_ddladmin   ADD MEMBER [pmwds_app];

USE [pmwds-v1_Hangfire];
CREATE USER [pmwds_app] FOR LOGIN [pmwds_app];
ALTER ROLE db_datareader ADD MEMBER [pmwds_app];
ALTER ROLE db_datawriter ADD MEMBER [pmwds_app];
ALTER ROLE db_ddladmin   ADD MEMBER [pmwds_app];
ALTER DATABASE [pmwds-v1_Hangfire] SET TRUSTWORTHY ON;
```

The application creates its own databases at startup *only if it can*, which a least-privilege
login cannot — so they are created up front. `TRUSTWORTHY` is what lets Hangfire create its own
schema.

`db_ddladmin` is what lets Entity Framework apply migrations. Verified working over the public
IP: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, transactions, `CREATE TABLE` and `DROP TABLE`. It
is deliberately **not** `db_owner` and **not** sysadmin — it cannot create logins or touch
server configuration.

Verify:

```bash
sudo /opt/mssql-tools18/bin/sqlcmd -S 127.0.0.1,1433 \
  -U pmwds_app -P '<app password>' -C -d pmwds-v1 \
  -Q "SELECT CONCAT('connected as ', ORIGINAL_LOGIN()) AS v;"
```

> Writing to these tables from `sqlcmd` needs `SET QUOTED_IDENTIFIER ON`. Without it you get
> `INSERT failed because the following SET options have incorrect settings`, which reads like a
> permissions failure but is not. EF sets it already; `sqlcmd` does not by default.

Once setup is complete, **disable the admin logins** (§5d). Leaving a sysadmin login reachable
on a public port is the whole risk this section is about.

---

## 4. Redis

Optional. Without it the app logs "Redis disabled" and uses an in-memory cache, which is fine
for a single instance but loses everything on restart. The `prod-sqlite` variant does not use
Redis at all.

```bash
apt-get install -y redis-server

# Bind to loopback. Redis has NO authentication by default — left on 0.0.0.0 it is an open
# remote-code-execution path on the public internet.
sudo sed -i 's/^bind .*/bind 127.0.0.1 ::1/'  /etc/redis/redis.conf
sudo sed -i 's/^protected-mode .*/protected-mode yes/' /etc/redis/redis.conf

sudo systemctl enable redis-server
sudo systemctl restart redis-server
```

Verify both the positive and the negative case — the second is the one that matters:

```bash
redis-cli -h 127.0.0.1 ping                       # PONG
IP=$(hostname -I | awk '{print $1}')
timeout 5 redis-cli -h "$IP" -p 6379 ping          # must be "Connection refused"
sudo ufw status                                   # must NOT list 6379
```

`appendonly no` is the default, so Redis holds no durable data. That is acceptable: it is a
cache, and the app treats it as disposable. Turn on `appendonly yes` if you want the cache to
survive a restart.

The application connects with `ConnectionStrings__Redis=127.0.0.1:6379`, and the startup banner
confirms it:

```
[PMWDS] Redis connected (127.0.0.1:6379).
```

---

## 5. Connecting SSMS on your Windows machine to the VPS instance

SQL Server is reachable **directly over the public IP**, scoped by firewall to the operator's
address range. No SSH tunnel is needed for normal use.

### 5a. The dialog

| Field | Value |
|---|---|
| Server type | Database Engine |
| **Server name** | **`147.93.155.185,1433`** |
| Authentication | **SQL Server Authentication** |
| User name | `pmwds_app` |
| Password | see below |
| Database name | `pmwds-v1`, or `<default>` |
| Encrypt | Mandatory |
| **Trust server certificate** | **ticked** ✓ |

Get the password:

```powershell
ssh contabo "sudo cat /root/pmwds-secrets/pmwds_app_password.txt"
```

> **Do not type `localhost`.** That is your own machine, not the VPS. Your local SQL Server
> Express instance is also on 1433 and will happily answer — it looks like it worked, but you
> are looking at your laptop's database. This is the single most likely mistake here.
>
> Windows Authentication also only ever works against the local instance. There is no Active
> Directory on the VPS, so Windows auth cannot reach it at all.

### 5b. What `pmwds_app` can and cannot do

Not sysadmin. It is the application's own login, scoped to the two databases it uses:

| Database | Roles |
|---|---|
| `pmwds-v1` | `db_datareader`, `db_datawriter`, `db_ddladmin` |
| `pmwds-v1_Hangfire` | `db_datareader`, `db_datawriter`, `db_ddladmin` |

Verified working over the public IP: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, transactions with
`ROLLBACK`, `CREATE TABLE` and `DROP TABLE`. The DDL grant is what lets Entity Framework apply
migrations if you ever need to.

Not permitted: creating logins, changing server configuration, viewing other databases, or
anything outside `pmwds-v1` / `pmwds-v1_Hangfire`. For that, see §5d.

### 5c. Azure Data Studio / VS Code

Same values. **Server** `147.93.155.185,1433`, **Authentication type** *SQL Login*, user
`pmwds_app`, and tick **Trust server certificate** under *Encryption*.

### 5d. Admin access — both admin logins are disabled

**`sa` and `pmwds_admin` are disabled.** They cannot be used from anywhere, including the VPS
itself. That is deliberate: SQL Server has no per-login network ACL, so the only way to keep a
sysadmin login off the network is to disable it. A sysadmin login on the internet is protected
by nothing but its password.

This was arrived at the wrong way round, and it is worth recording. `sa` was first exposed
alongside the firewall change, on the belief that `ALTER LOGIN ... WITH PASSWORD` restricts it.
It does not — it only rotates the password, and `sa` remained reachable. Disabling it fixed
that. A replacement `pmwds_admin` was then created and, being sysadmin, was immediately
reachable too; it has also been disabled. The end state is right; the route there was not.

To administer the instance you have to re-enable an admin login from the VPS console:

```bash
# Recovery procedure. This is the only way in, and it needs SSH access.
sudo systemctl stop mssql-server
MSSQL_SA_PASSWORD='<new strong password>' ACCEPT_EULA=Y sudo -E \
  /opt/mssql/bin/mssql-conf -n setup accept-eula
sudo systemctl start mssql-server

sudo /opt/mssql-tools18/bin/sqlcmd -S 127.0.0.1,1433 -U sa -P '<new>' -C -Q "
ALTER LOGIN [sa] ENABLE;
ALTER SERVER ROLE [sysadmin] ADD MEMBER [pmwds_admin];"
```

Then re-disable both once you are done:

```sql
ALTER LOGIN [sa] DISABLE;
ALTER LOGIN [pmwds_admin] DISABLE;
```

Passwords on disk: `pmwds_admin` at `/root/pmwds-secrets/pmwds_admin_password.txt`. The old
`sa` password file at `/root/mssql-sa-password.txt` is **stale** — `sa` was disabled and its
password rotated during that recovery, so that file no longer authenticates anything.

### 5e. SSH tunnel — still useful, and the safest option

A tunnel needs no firewall rule and exposes nothing, so prefer it on an untrusted network or
from a machine outside the operator range:

```powershell
ssh -N -L 14330:127.0.0.1:1433 contabo
```

Then in SSMS use server name `127.0.0.1,14330`. The tunnel dies when that process exits and
does not survive a reboot.

### 5f. The firewall rule

```
1433/tcp   ALLOW IN   152.58.154.0/24    # MSSQL (SSMS) - operator range
```

Scoped rather than open, because an unrestricted database port is scanned within minutes and a
password is all that stands between it and the data.

**Your IP is dynamic.** The VPS has seen this operator from `152.58.154.143`, `.32`, `.107` and
`.195` within one week — all inside the `/24`, which is why the range was allowed rather than a
single address. If an address ever falls outside it, add one:

```bash
sudo ufw allow from YOUR_IP/32 to any port 1433 proto tcp
```

Check what you currently appear as:

```powershell
curl -s https://api.ipify.org
```

To remove public access entirely:

```bash
sudo ufw delete allow 1433/tcp
sudo /opt/mssql/bin/mssql-conf set network.ipaddress 127.0.0.1
sudo systemctl restart mssql-server
```

---

## 6. Day-to-day commands

Most inspection works with `pmwds_app`; anything needing `sysadmin` requires the §5d recovery
procedure first.

```bash
# services
systemctl status  mssql-server redis-server pmwds-mssql pmwds-sqlite --no-pager
systemctl restart mssql-server          # after any mssql-conf change
systemctl restart pmwds-mssql           # after a deploy (it holds SQL connections)

# the two settings that matter - readable with pmwds_app, no admin needed
APPPW=$(sudo cat /root/pmwds-secrets/pmwds_app_password.txt)
sudo /opt/mssql-tools18/bin/sqlcmd -S 127.0.0.1,1433 -U pmwds_app -P "$APPPW" -C -h-1 -W -Q "
SET NOCOUNT ON;
SELECT CONCAT(name, ' = ', value_in_use) FROM sys.configurations
WHERE name IN ('max degree of parallelism','max server memory (MB)','show advanced options');"
# expect: max degree of parallelism = 1, max server memory (MB) = 2048

# the waits that indicate the original latency problem has returned
sudo /opt/mssql-tools18/bin/sqlcmd -S 127.0.0.1,1433 -U pmwds_app -P "$APPPW" -C -h-1 -W -Q "
SET NOCOUNT ON;
SELECT CONCAT(wait_type, ' waiting=', waiting_tasks_count, ' max_ms=', max_wait_time_ms)
FROM sys.dm_os_wait_stats
WHERE wait_type IN ('RESOURCE_SEMAPHORE','SOS_SCHEDULER_YIELD','THREADPOOL');"
# RESOURCE_SEMAPHORE max_ms should be 0. Climbing into the thousands means MAXDOP was reset
# or the memory limit raised - see mssql-issue.md.

# memory granted to the instance
sudo /opt/mssql/bin/mssql-conf list | grep memory

# logs
journalctl -u mssql-server -n 50 --no-pager
tail -f /var/opt/mssql/log/errorlog
```

### Backups

`sqlite3 .backup` protects nothing now that the subdomain runs on SQL Server. `BACKUP DATABASE`
needs sysadmin, so enable an admin login (§5d) first:

```sql
BACKUP DATABASE [pmwds-v1]          TO DISK = '/var/opt/mssql/backup/pmwds-v1.bak'          WITH INIT, COMPRESSION;
BACKUP DATABASE [pmwds-v1_Hangfire] TO DISK = '/var/opt/mssql/backup/pmwds-v1_Hangfire.bak' WITH INIT, COMPRESSION;
```

Create `/var/opt/mssql/backup` first. Disable the admin login again afterwards. Nothing else on
the box depends on that directory.

---

## 7. Challenges hit during installation

In the order they occurred, since each one looks like the last.

**1. `mssql-tools18` not found.** The repo added in step 1 only carries `mssql-server`.
`mssql-tools18` lives in Microsoft's separate `prod` repo. `E: Unable to locate package`.

**2. Setup appeared to do nothing.** `mssql-conf -n setup accept-eula` printed licence text and
exited without configuring anything: `The MSSQL_SA_PASSWORD environment variable must be set`.

**3. `sqlservr` missing `liblber-2.5.so.0`.** Ubuntu 24.04 ships OpenLDAP 2.6. See §2a — this
needs the real 2.5 libraries.

**4. Symlinking the 2.5 soname resolved the file but not the symbols.** The error changed from
"cannot open shared object file" to `version 'OPENLDAP_2.5' not found`, which looks like
progress and is not. Confusing `ldconfig` cache entries and `ld.so.conf.d` entries did not help,
because the library that was found genuinely does not export the required symbol version.

**5. `liblber-2.5-0` does not exist in the archive.** Repeated 404s. Both libraries are inside
`libldap-2.5-0`; the package name is misleading.

**6. `mssql-conf setup` refuses while the service is running.** After the service was up, a
password reset appeared to succeed and then `sa` login failed. Setup had printed a message to
stop the service and exited without changing anything, while the shell variable holding the
intended password went out of scope.

**7. SQL Server listened on `0.0.0.0:1433`.** It started successfully and was reachable from the
public internet. Not a startup failure, but worse than one. Caught by inspecting `ss -tln`.

**8. `mssql-conf set memory...` reported success but `max server memory` was unchanged** until
after a restart. Several of these settings need a restart; the message says so, but it scrolls
past.

**9. The app was briefly able to fall back to SQLite.** The `pmwds-mssql` env file sets
`Database__AllowSqliteInProduction=false` specifically so that an unreachable or malformed
connection string fails loudly. With it `true`, a typo in the connection string produces a
working app writing to a local file — which is exactly the confusion that made this deployment
look like it had silently switched databases.

**10. `deploy.ps1` reported "API did not report listening" on a healthy deploy.** Not a
database problem, but it happened here and was fixed: `systemctl is-active` returns `active`
when the process launches, but the app then spends ~19 s applying migrations. The check now
polls for the "Now listening" line and confirms the port.

**11. `ALTER LOGIN sa WITH PASSWORD = ...` does not restrict network access.** This was
assumed, tested, and found false: after rotating `sa`'s password as if that made it
loopback-only, `sa` still authenticated from the public internet. `ALTER LOGIN ... WITH
PASSWORD` only rotates the password. SQL Server has no per-login network ACL, so **disabling**
a login is the only way to remove it from the reachable set. Verified after disabling: both the
old and new `sa` passwords are refused.

**12. Disabling `sa` and creating `pmwds_admin` made things worse before better.** The
replacement was sysadmin, so it was internet-reachable with full instance control — a larger
hole than the one just closed. It has been disabled too. Net result is correct: only
`pmwds_app`, which is not sysadmin, is reachable. The mistake was creating a privileged login
without checking what the previous one had been used for first.

**13. Both admin logins are now disabled, so `sqlcmd -U sa` in older notes no longer works.**
Expected, and the recovery path is in §5d. Worth knowing before you need it.

---

## 8. Measured behaviour

Both variants, measured from the VPS over the public internet, on 2026-10-03:

| | SQLite (bare IP) | MSSQL (subdomain, HTTPS) |
|---|---|---|
| `GET /` | 200 | 200 |
| main JS bundle (1.7 MB) | 0.009 s | 0.044 s |
| `POST /auth/login` | 0.258 s | 0.421 s |
| `/projects` | 0.104 s | 0.387 s |
| `/workspace/bootstrap` | 0.023 s | 0.097 s |
| `/users?pageSize=500` | 0.021 s | 0.090 s |
| `/departments?pageSize=500` | 0.023 s | 0.095 s |
| `/organizations` | 0.038 s | 0.187 s |
| `/pages?page=1` (290–330 KB) | 0.110 s | 0.310 s |
| **six calls in parallel, wall clock** | **0.269 s** | **0.414 s** |
| login from localhost, no network | 0.124 s | 0.116 s |

The remaining gap is the network round trip and TLS, not the database. Server-side the two are
indistinguishable.

Memory with both deployments plus SQL Server and Redis running: 1.9 GiB used of 7.8 GiB,
5.9 GiB available. There is headroom.
