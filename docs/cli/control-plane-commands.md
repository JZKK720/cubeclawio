---
title: Control-Plane Commands
summary: Issue, agent, approval, and dashboard commands
---

Client-side commands for managing issues, agents, approvals, and more.

## Issue Commands

```sh
# List issues
pnpm cubecloud.io issue list [--status todo,in_progress] [--assignee-agent-id <id>] [--match text]

# Get issue details
pnpm cubecloud.io issue get <issue-id-or-identifier>

# Create issue
pnpm cubecloud.io issue create --title "..." [--description "..."] [--status todo] [--priority high]

# Update issue
pnpm cubecloud.io issue update <issue-id> [--status in_progress] [--comment "..."]

# Add comment
pnpm cubecloud.io issue comment <issue-id> --body "..." [--reopen]

# Checkout task
pnpm cubecloud.io issue checkout <issue-id> --agent-id <agent-id>

# Release task
pnpm cubecloud.io issue release <issue-id>
```

## Company Commands

```sh
pnpm cubecloud.io company list
pnpm cubecloud.io company get <company-id>

# Export to portable folder package (writes manifest + markdown files)
pnpm cubecloud.io company export <company-id> --out ./exports/acme --include company,agents

# Preview import (no writes)
pnpm cubecloud.io company import \
  --from https://github.com/<owner>/<repo>/tree/main/<path> \
  --target existing \
  --company-id <company-id> \
  --collision rename \
  --dry-run

# Apply import
pnpm cubecloud.io company import \
  --from ./exports/acme \
  --target new \
  --new-company-name "Acme Imported" \
  --include company,agents
```

## Agent Commands

```sh
pnpm cubecloud.io agent list
pnpm cubecloud.io agent get <agent-id>
```

## Approval Commands

```sh
# List approvals
pnpm cubecloud.io approval list [--status pending]

# Get approval
pnpm cubecloud.io approval get <approval-id>

# Create approval
pnpm cubecloud.io approval create --type hire_agent --payload '{"name":"..."}' [--issue-ids <id1,id2>]

# Approve
pnpm cubecloud.io approval approve <approval-id> [--decision-note "..."]

# Reject
pnpm cubecloud.io approval reject <approval-id> [--decision-note "..."]

# Request revision
pnpm cubecloud.io approval request-revision <approval-id> [--decision-note "..."]

# Resubmit
pnpm cubecloud.io approval resubmit <approval-id> [--payload '{"..."}']

# Comment
pnpm cubecloud.io approval comment <approval-id> --body "..."
```

## Activity Commands

```sh
pnpm cubecloud.io activity list [--agent-id <id>] [--entity-type issue] [--entity-id <id>]
```

## Dashboard

```sh
pnpm cubecloud.io dashboard get
```

## Heartbeat

```sh
pnpm cubecloud.io heartbeat run --agent-id <agent-id> [--api-base http://localhost:3100]
```
