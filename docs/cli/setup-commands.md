---
title: Setup Commands
summary: Onboard, run, doctor, and configure
---

Instance setup and diagnostics commands.

## `cubecloud.io run`

One-command bootstrap and start:

```sh
pnpm cubecloud.io run
```

Does:

1. Auto-onboards if config is missing
2. Runs `cubecloud.io doctor` with repair enabled
3. Starts the server when checks pass

Choose a specific instance:

```sh
pnpm cubecloud.io run --instance dev
```

## `cubecloud.io onboard`

Interactive first-time setup:

```sh
pnpm cubecloud.io onboard
```

First prompt:

1. `Quickstart` (recommended): local defaults (embedded database, no LLM provider, local disk storage, default secrets)
2. `Advanced setup`: full interactive configuration

Start immediately after onboarding:

```sh
pnpm cubecloud.io onboard --run
```

Non-interactive defaults + immediate start (opens browser on server listen):

```sh
pnpm cubecloud.io onboard --yes
```

## `cubecloud.io doctor`

Health checks with optional auto-repair:

```sh
pnpm cubecloud.io doctor
pnpm cubecloud.io doctor --repair
```

Validates:

- Server configuration
- Database connectivity
- Secrets adapter configuration
- Storage configuration
- Missing key files

## `cubecloud.io configure`

Update configuration sections:

```sh
pnpm cubecloud.io configure --section server
pnpm cubecloud.io configure --section secrets
pnpm cubecloud.io configure --section storage
```

## `cubecloud.io env`

Show resolved environment configuration:

```sh
pnpm cubecloud.io env
```

## `cubecloud.io allowed-hostname`

Allow a private hostname for authenticated/private mode:

```sh
pnpm cubecloud.io allowed-hostname my-tailscale-host
```

## Local Storage Paths

| Data | Default Path |
|------|-------------|
| Config | `~/.paperclip/instances/default/config.json` |
| Database | `~/.paperclip/instances/default/db` |
| Logs | `~/.paperclip/instances/default/logs` |
| Storage | `~/.paperclip/instances/default/data/storage` |
| Secrets key | `~/.paperclip/instances/default/secrets/master.key` |

Override with:

```sh
PAPERCLIP_HOME=/custom/home PAPERCLIP_INSTANCE_ID=dev pnpm cubecloud.io run
```

Or pass `--data-dir` directly on any command:

```sh
pnpm cubecloud.io run --data-dir ./tmp/paperclip-dev
pnpm cubecloud.io doctor --data-dir ./tmp/paperclip-dev
```
