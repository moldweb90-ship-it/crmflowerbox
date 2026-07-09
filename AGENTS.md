# Project Rules

## Fast Git + VPS Deploy

When Ruslan asks to push/deploy, including phrases like "kidai na git i VPS",
"zakin na git i na VPS", "push to git and VPS", or similar:

1. Inspect `git status --short` and stage only files related to the current task. Do not stage unrelated dirty files.
2. Run `npm.cmd run build`.
3. Commit with a concise message and push `main` to `origin`.
4. Deploy with `python scripts/deploy-vps.py`.
5. Use secrets from environment variables only:
   - `VPS_PASS` for SSH password.
   - `CRM_SYNC_TOKEN` only when the VPS `.env` needs to be created or updated.
6. Verify the deployment:
   - Remote `git rev-parse --short HEAD` matches the pushed commit.
   - `docker compose ps` shows `crm`, `db`, `events`, and `postgrest` running.
   - `curl http://127.0.0.1/products` on the VPS returns `200`.
   - For price sync changes, POST to `http://127.0.0.1/api/vm-sync` without a browser token and confirm `ok:true`.

Default VPS settings:

- Host: `93.189.229.125`
- User: `root`
- App directory: `/opt/flowerbox-crm`
- Compose directory: `/opt/flowerbox-crm/deploy`
- Branch: `main`
- Service to rebuild: `crm`

Keep the final answer short: commit hash, push status, VPS status, and verification results.
