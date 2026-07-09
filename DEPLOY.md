# Fast Deploy

Use this when local changes are ready and Ruslan asks to push to GitHub and VPS.

## One-Time Environment

Set secrets in the current terminal session:

```powershell
$env:VPS_PASS = "..."
$env:CRM_SYNC_TOKEN = "..."
```

`CRM_SYNC_TOKEN` is only needed when the server `.env` must be updated. Do not commit secrets.

## Standard Flow

```powershell
npm.cmd run build
git status --short
git add <only-task-files>
git commit -m "Short commit message"
git push origin main
python scripts/deploy-vps.py
```

If Paramiko is installed in `C:\tmp\codex_paramiko`, run:

```powershell
$env:PYTHONPATH = "C:\tmp\codex_paramiko"
python scripts/deploy-vps.py
```

## What The Deploy Script Does

- Connects to `root@93.189.229.125`.
- Pulls `origin/main` in `/opt/flowerbox-crm`.
- Optionally writes `CRM_SYNC_TOKEN` to `/opt/flowerbox-crm/deploy/.env` if the env var exists locally.
- Rebuilds and restarts the `crm` service.
- Verifies nginx, `/products`, and Docker Compose status.

## Important

The script does not commit local changes. Commit and push first.
