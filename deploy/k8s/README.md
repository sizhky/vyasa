# Vyasa on Kubernetes

One pod serves content from git mirrors. Pushing to a configured repo publishes it: the in-process fetcher ([`_start_git_fetcher()`](../../vyasa/core.py)) pulls every `VYASA_GIT_FETCH_INTERVAL` seconds, and the server re-reads mounts within two seconds. No restart is needed.

## Layout

| Path in pod | Holds |
|---|---|
| `/data` (PVC) | Content root: mirrors in `.vyasa-mirrors`, extension data in `.vyasa-storage`, RBAC store in `.vyasa-rbac.db`, and the `.vyasa` file the RBAC admin writes. |
| `/etc/vyasa/ssh` (Secret) | Read-only deploy key and `known_hosts` for the fetcher. |
| `/opt/vyasa/vendor` (image) | Frontend libraries vendored at build time, so pages need no CDN. |

The deployment uses `Recreate` because the PVC is `ReadWriteOnce`. A rolling update would wait for the old pod to release the volume.

## Steps

1. Build and push the image from the repo root:
   `docker build -t <registry>/vyasa:<tag> . && docker push <registry>/vyasa:<tag>`
2. Register a Microsoft Entra app in the penguinai.co tenant. Set "Accounts in this organizational directory only". Add the web redirect URI `https://<host>/auth/microsoft/callback`. Copy the tenant ID (a GUID) and client ID, and create a client secret.
3. Add a read-only deploy key to each content repo. Then create the secret:

   ```bash
   kubectl create secret generic vyasa-secrets \
     --from-literal=microsoft-client-id=<client-id> \
     --from-literal=microsoft-client-secret=<client-secret> \
     --from-literal=session-secret="$(openssl rand -hex 32)" \
     --from-file=ssh-key=./id_ed25519 \
     --from-file=known-hosts=<(ssh-keyscan github.com)
   ```

4. Replace each `REPLACE_ME` in [vyasa.yaml](vyasa.yaml), then `kubectl apply -f deploy/k8s/vyasa.yaml`.

## Configuration

Every setting is an env var, so `/data/.vyasa` stays writable for the RBAC admin. `VYASA_GIT_REPOS` takes comma-separated `name=url` pairs; each `name` becomes a top-level URL path. Sign-in keys follow `VYASA_<PROVIDER>_<KEY>`, as described in [Security And Access](../../vyasa%20manual/security.md).

`FORWARDED_ALLOW_IPS=*` in the image makes uvicorn trust the ingress's `X-Forwarded-Proto`. Without it, the OAuth callback URL is built as `http://` and Microsoft rejects it. Keep the Service reachable only through the ingress.

Use one replica. The fetcher, the SQLite stores, and the RBAC file all assume a single writer.
