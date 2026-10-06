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
2. Register one or both sign-in providers for your organization (see [Sign-in](#sign-in)).
3. Add a read-only SSH key that can read every repo (see [Repos](#repos)). Then create the secret. Include only the client keys of the providers you registered:

   ```bash
   kubectl create secret generic vyasa-secrets \
     --from-literal=microsoft-client-id=<client-id> \
     --from-literal=microsoft-client-secret=<client-secret> \
     --from-literal=google-client-id=<client-id> \
     --from-literal=google-client-secret=<client-secret> \
     --from-literal=session-secret="$(openssl rand -hex 32)" \
     --from-file=ssh-key=./id_ed25519 \
     --from-file=known-hosts=<(ssh-keyscan github.com)
   ```

4. Replace each `REPLACE_ME` in [vyasa.yaml](vyasa.yaml), then `kubectl apply -f deploy/k8s/vyasa.yaml`.

## Sign-in

A provider is enabled when its client ID and secret exist in `vyasa-secrets`. Each enabled provider adds one button to the login page. Set `VYASA_<PROVIDER>_ALLOWED_DOMAINS` to your organization's email domain.

| Provider | Register | Restrict to your organization |
|---|---|---|
| Microsoft | An Entra app in your organization's tenant, with "Accounts in this organizational directory only". | Set `VYASA_MICROSOFT_TENANT_ID` to the tenant GUID. Vyasa refuses `common`, `organizations`, and `consumers`, and checks the token's `tid`. |
| Google | An OAuth client in a Google Cloud project owned by your Workspace organization, with the consent screen's user type set to "Internal". | "Internal" limits sign-in to your Workspace accounts. `VYASA_GOOGLE_ALLOWED_DOMAINS` checks the email domain as a second gate. |

Redirect URIs are `https://<host>/auth/microsoft/callback` and `https://<host>/auth/google/callback`.

## Repos

`VYASA_GIT_REPOS` lists the served repos as comma-separated `name=url` pairs. The same image serves one repo or several; only this env var changes.

| Repos | `VYASA_GIT_REPOS` | URLs |
|---|---|---|
| One | `docs=git@github.com:acme/docs.git` | `/docs/...` |
| Several | `docs=git@github.com:acme/docs.git,handbook=git@github.com:acme/handbook.git` | `/docs/...`, `/handbook/...` |

Each `name` becomes a top-level URL path and a mirror at `/data/.vyasa-mirrors/<name>.git`. To add a repo, append a pair and run `kubectl apply`. The pod restarts and clones the new mirror. Folders placed directly in `/data` are not served.

A GitHub deploy key works for one repo only. For several repos, use the SSH key of a read-only machine user that can read all of them. The `GIT_SSH_COMMAND` in the manifest then stays unchanged.

## Configuration

Every setting is an env var, so `/data/.vyasa` stays writable for the RBAC admin. Sign-in keys follow `VYASA_<PROVIDER>_<KEY>`, as described in [Security And Access](../../vyasa%20manual/security.md).

`FORWARDED_ALLOW_IPS=*` in the image makes uvicorn trust the ingress's `X-Forwarded-Proto`. Without it, the OAuth callback URL is built as `http://` and Microsoft rejects it. Keep the Service reachable only through the ingress.

Use one replica. The fetcher, the SQLite stores, and the RBAC file all assume a single writer.
