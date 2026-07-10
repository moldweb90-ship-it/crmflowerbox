#!/usr/bin/env python3
import argparse
import os
import shlex
import sys


DEFAULT_HOST = "93.189.229.125"
DEFAULT_USER = "root"
DEFAULT_APP_DIR = "/opt/flowerbox-crm"
DEFAULT_BRANCH = "main"
DEFAULT_SERVICE = "crm"


def load_paramiko():
    try:
        import paramiko  # type: ignore
        return paramiko
    except ModuleNotFoundError:
        extra_path = os.environ.get("PARAMIKO_PATH") or r"C:\tmp\codex_paramiko"
        if os.path.isdir(extra_path) and extra_path not in sys.path:
            sys.path.insert(0, extra_path)
            try:
                import paramiko  # type: ignore
                return paramiko
            except ModuleNotFoundError:
                pass
        raise SystemExit(
            "Paramiko is required for password SSH deploy. Install it with:\n"
            "python -m pip install --target C:\\tmp\\codex_paramiko paramiko\n"
            "or set PARAMIKO_PATH to an existing Paramiko install."
        )


def build_remote_command(args):
    app_dir = shlex.quote(args.app_dir)
    branch = shlex.quote(args.branch)
    service = shlex.quote(args.service)
    token = os.environ.get("CRM_SYNC_TOKEN", "")
    token_block = ""

    if token:
        token_block = f"""
export CRM_SYNC_TOKEN_VALUE={shlex.quote(token)}
if grep -q '^CRM_SYNC_TOKEN=' deploy/.env; then
  sed -i "s|^CRM_SYNC_TOKEN=.*|CRM_SYNC_TOKEN=$CRM_SYNC_TOKEN_VALUE|" deploy/.env
else
  printf '\\nCRM_SYNC_TOKEN=%s\\n' "$CRM_SYNC_TOKEN_VALUE" >> deploy/.env
fi
"""

    sync_check = ""
    if args.check_sync:
        sync_check = """
printf "SYNC_STATUS="
curl -sS -o /tmp/crm-sync-check.txt -w '%{http_code}\\n' \
  -X POST http://127.0.0.1/api/vm-sync \
  -H 'Content-Type: application/json' \
  --data '{"products":[]}' || true
printf "SYNC_BODY_HEAD="
head -c 220 /tmp/crm-sync-check.txt || true
printf "\\n"
"""

    return f"""set -e
cd {app_dir}
printf "BEFORE_HEAD="
git rev-parse --short HEAD
git fetch origin {branch}
git checkout {branch}
git pull --ff-only origin {branch}
printf "AFTER_HEAD="
git rev-parse --short HEAD
{token_block}
cd deploy
docker compose up -d --build {service}
printf "NGINX_TEST\\n"
docker compose exec -T {service} nginx -t
HTTP_PRODUCTS=000
for attempt in $(seq 1 20); do
  HTTP_PRODUCTS=$(curl -sS -o /dev/null -w '%{{http_code}}' http://127.0.0.1/products 2>/dev/null || true)
  if [ "$HTTP_PRODUCTS" = "200" ]; then
    break
  fi
  sleep 1
done
printf "HTTP_PRODUCTS=%s\\n" "$HTTP_PRODUCTS"
test "$HTTP_PRODUCTS" = "200"
{sync_check}
docker compose ps
"""


def main():
    parser = argparse.ArgumentParser(description="Deploy CRM Flower Box to VPS.")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--user", default=DEFAULT_USER)
    parser.add_argument("--app-dir", default=DEFAULT_APP_DIR)
    parser.add_argument("--branch", default=DEFAULT_BRANCH)
    parser.add_argument("--service", default=DEFAULT_SERVICE)
    parser.add_argument("--check-sync", action="store_true")
    args = parser.parse_args()

    password = os.environ.get("VPS_PASS")
    if not password:
        raise SystemExit("Set VPS_PASS in the environment before deploying.")

    paramiko = load_paramiko()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=args.host,
        username=args.user,
        password=password,
        timeout=40,
        banner_timeout=40,
        auth_timeout=40,
    )

    command = build_remote_command(args)
    _, stdout, stderr = client.exec_command(command, timeout=900)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    client.close()

    if out:
        print(out)
    if err:
        print(err, file=sys.stderr)
    if code:
        raise SystemExit(code)


if __name__ == "__main__":
    main()
