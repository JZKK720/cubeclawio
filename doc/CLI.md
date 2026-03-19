# CLI Reference

Paperclip CLI now supports both:

- instance setup/diagnostics (`onboard`, `doctor`, `configure`, `env`, `allowed-hostname`)
- control-plane client operations (issues, approvals, agents, activity, dashboard)

## Base Usage

Use repo script in development:

```sh
pnpm cubecloud.io --help
```

First-time local bootstrap + run:

```sh
pnpm cubecloud.io run
```

Choose local instance:

```sh
pnpm cubecloud.io run --instance dev
```

## Deployment Modes

Mode taxonomy and design intent are documented in `doc/DEPLOYMENT-MODES.md`.

Current CLI behavior:

- `cubecloud.io onboard` and `cubecloud.io configure --section server` set deployment mode in config
- runtime can override mode with `PAPERCLIP_DEPLOYMENT_MODE`
- `cubecloud.io run` and `cubecloud.io doctor` do not yet expose a direct `--mode` flag

Target behavior (planned) is documented in `doc/DEPLOYMENT-MODES.md` section 5.

Allow an authenticated/private hostname (for example custom Tailscale DNS):

```sh
pnpm cubecloud.io allowed-hostname dotta-macbook-pro
```

All client commands support:

- `--data-dir <path>`
- `--api-base <url>`
- `--api-key <token>`
- `--context <path>`
- `--profile <name>`
- `--json`

Company-scoped commands also support `--company-id <id>`.

Use `--data-dir` on any CLI command to isolate all default local state (config/context/db/logs/storage/secrets) away from `~/.paperclip`:

```sh
pnpm cubecloud.io run --data-dir ./tmp/paperclip-dev
pnpm cubecloud.io issue list --data-dir ./tmp/paperclip-dev
```

## Context Profiles

Store local defaults in `~/.paperclip/context.json`:

```sh
pnpm cubecloud.io context set --api-base http://localhost:3100 --company-id <company-id>
pnpm cubecloud.io context show
pnpm cubecloud.io context list
pnpm cubecloud.io context use default
```

To avoid storing secrets in context, set `apiKeyEnvVarName` and keep the key in env:

```sh
pnpm cubecloud.io context set --api-key-env-var-name PAPERCLIP_API_KEY
export PAPERCLIP_API_KEY=...
```

## Company Commands

```sh
pnpm cubecloud.io company list
pnpm cubecloud.io company get <company-id>
pnpm cubecloud.io company delete <company-id-or-prefix> --yes --confirm <same-id-or-prefix>
```

Examples:

```sh
pnpm cubecloud.io company delete PAP --yes --confirm PAP
pnpm cubecloud.io company delete 5cbe79ee-acb3-4597-896e-7662742593cd --yes --confirm 5cbe79ee-acb3-4597-896e-7662742593cd
```

Notes:

- Deletion is server-gated by `PAPERCLIP_ENABLE_COMPANY_DELETION`.
- With agent authentication, company deletion is company-scoped. Use the current company ID/prefix (for example via `--company-id` or `PAPERCLIP_COMPANY_ID`), not another company.

## Issue Commands

```sh
pnpm cubecloud.io issue list --company-id <company-id> [--status todo,in_progress] [--assignee-agent-id <agent-id>] [--match text]
pnpm cubecloud.io issue get <issue-id-or-identifier>
pnpm cubecloud.io issue create --company-id <company-id> --title "..." [--description "..."] [--status todo] [--priority high]
pnpm cubecloud.io issue update <issue-id> [--status in_progress] [--comment "..."]
pnpm cubecloud.io issue comment <issue-id> --body "..." [--reopen]
pnpm cubecloud.io issue checkout <issue-id> --agent-id <agent-id> [--expected-statuses todo,backlog,blocked]
pnpm cubecloud.io issue release <issue-id>
```

## Agent Commands

```sh
pnpm cubecloud.io agent list --company-id <company-id>
pnpm cubecloud.io agent get <agent-id>
pnpm cubecloud.io agent local-cli <agent-id-or-shortname> --company-id <company-id>
```

`agent local-cli` is the quickest way to run local Claude/Codex manually as a Paperclip agent:

- creates a new long-lived agent API key
- installs missing Paperclip skills into `~/.codex/skills` and `~/.claude/skills`
- prints `export ...` lines for `PAPERCLIP_API_URL`, `PAPERCLIP_COMPANY_ID`, `PAPERCLIP_AGENT_ID`, and `PAPERCLIP_API_KEY`

Example for shortname-based local setup:

```sh
pnpm cubecloud.io agent local-cli codexcoder --company-id <company-id>
pnpm cubecloud.io agent local-cli claudecoder --company-id <company-id>
```

## Approval Commands

```sh
pnpm cubecloud.io approval list --company-id <company-id> [--status pending]
pnpm cubecloud.io approval get <approval-id>
pnpm cubecloud.io approval create --company-id <company-id> --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]
pnpm cubecloud.io approval approve <approval-id> [--decision-note "..."]
pnpm cubecloud.io approval reject <approval-id> [--decision-note "..."]
pnpm cubecloud.io approval request-revision <approval-id> [--decision-note "..."]
pnpm cubecloud.io approval resubmit <approval-id> [--payload '{"...":"..."}']
pnpm cubecloud.io approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm cubecloud.io activity list --company-id <company-id> [--agent-id <agent-id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard Commands

```sh
pnpm cubecloud.io dashboard get --company-id <company-id>
```

## Heartbeat Command

`heartbeat run` now also supports context/api-key options and uses the shared client stack:

```sh
pnpm cubecloud.io heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100] [--api-key <token>]
```

## Local Storage Defaults

Default local instance root is `~/.paperclip/instances/default`:

- config: `~/.paperclip/instances/default/config.json`
- embedded db: `~/.paperclip/instances/default/db`
- logs: `~/.paperclip/instances/default/logs`
- storage: `~/.paperclip/instances/default/data/storage`
- secrets key: `~/.paperclip/instances/default/secrets/master.key`

Override base home or instance with env vars:

```sh
PAPERCLIP_HOME=/custom/home PAPERCLIP_INSTANCE_ID=dev pnpm cubecloud.io run
```

## Storage Configuration

Configure storage provider and settings:

```sh
pnpm cubecloud.io configure --section storage
```

Supported providers:

- `local_disk` (default; local single-user installs)
- `s3` (S3-compatible object storage)
