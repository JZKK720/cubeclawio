# Federated Control Plane and IronHub Plan

## Context

This fork is moving toward a federated control-plane model:

- Paperclip-derived backend remains the company-scoped control plane
- IronHub becomes the operator-facing product and frontend brand
- external execution fabrics such as IronClaw, OpenCode/Codex, and OpenWork are treated as specialized backends rather than absorbed into core orchestration loops

The immediate goal is to define the first additive contract layer that supports:

1. a new IronHub frontend
2. normalized run tracking across multiple execution engines
3. connector-driven dispatch to external runtimes
4. a first real connector target: `ironclaw_gateway`

This plan is intentionally additive. Existing Paperclip concepts such as `HeartbeatRun`, plugin job runs, approvals, workspace runtime services, and company scoping remain valid.

## Recommendation In One Sentence

Keep the current backend as the governance and routing control plane, add a normalized execution connector contract in shared types, and build IronHub as a new frontend that talks to that control plane while the first external execution backend is an HTTP-authenticated `ironclaw_gateway` connector.

## Product Decisions

### 1. Soft rebrand, not hard rename

The forked product is branded as IronHub, while internal package scopes and runtime internals remain Paperclip-derived for now.

That means:

- keep MIT attribution and explicit fork credit
- allow new frontend branding and product copy under IronHub
- avoid immediate churn across package scopes, plugin SDK names, CLI names, and env vars

### 2. Paperclip-derived backend is the control plane, not the universal worker

The backend should own:

- company scoping
- task intake and routing
- approval gates
- budget policy and cost attribution
- unified execution registry
- audit and activity history
- connector health and configuration

The backend should not try to replicate every downstream engine's internal semantics.

### 3. Execution fabrics are first-class backends

External engines are modeled as connectors with stable capabilities.

Initial connector families:

- job execution
- routine execution
- session execution

Initial engines in scope:

- `ironclaw_gateway` for jobs and routines
- OpenCode or Codex-oriented coding connector
- OpenWork-style multi-agent orchestration connector

### 4. Normalized runs are additive, not a replacement for heartbeat runs

Existing models remain source-of-truth for current built-in behavior.

New normalized run models should:

- aggregate external executions under one shape
- point back to engine-native ids
- preserve parent-child run relationships
- align to approvals, budgets, issues, projects, and artifacts

This is a new control-plane abstraction above existing engine-native records.

### 5. The frontend should talk to the control plane, not every engine directly

IronHub should primarily call Paperclip-derived backend APIs.

That keeps:

- auth and company scoping centralized
- browser exposure small
- engine credentials server-side
- event normalization consistent across engines

Direct browser-to-engine access should be an exception and should use brokered short-lived credentials if it is ever needed.

## Architecture

## Layer 1: Experience Layer

- IronHub website frontend
- operator dashboards
- approvals and interventions
- unified run explorer
- routines management
- connector health views
- artifacts, logs, and trace views

## Layer 2: Control Plane

- task intake
- execution routing
- approval checkpoints
- budget ledger and usage attribution
- normalized run registry
- activity and audit log
- connector catalog and config

## Layer 3: Execution Fabric

- IronClaw gateway
- OpenCode or Codex-oriented code execution runtime
- OpenWork multi-agent orchestration runtime
- future browser, research, or data runtimes

## Layer 4: State and Event Plane

- normalized run records
- provider-native run references
- artifacts and work product references
- event stream normalization
- usage and cost summaries
- provenance back to issue, project, approval, and company

## Control Plane Object Model

The control plane should normalize around these concepts:

- `ExecutionConnector`
- `ExecutionJobRequest`
- `ExecutionRoutineDefinition`
- `ExecutionSessionOpenRequest`
- `NormalizedExecutionRun`
- `NormalizedExecutionRunEvent`
- `NormalizedExecutionArtifact`
- `ExecutionApprovalCheckpoint`
- `ExternalExecutionRef`

These objects are additive and do not replace:

- `HeartbeatRun`
- `PluginJobRunRecord`
- workspace runtime service records
- budget incident records
- approval records

## Connector Taxonomy

### Job connectors

Used for one-shot or long-running task execution.

Required operations:

- submit
- get status
- cancel
- restart when supported
- stream or poll events
- fetch artifacts or file handles when supported

### Routine connectors

Used for recurring, scheduled, or event-triggered automations.

Required operations:

- list
- get detail
- trigger now
- enable or disable
- delete when supported
- list routine runs when supported

### Session connectors

Used for long-lived interactive sessions.

Required operations:

- open
- append input
- stream output
- close

The first implementation target does not need session support.

## Normalized Run Model

Each run tracked by the control plane should answer:

- what operator intent caused this run
- which company owns it
- which connector accepted it
- which external engine owns native execution
- what state it is in now
- what approvals or interventions block it
- what artifacts, logs, costs, and runtime services it produced

Each normalized run therefore needs:

- stable internal id
- external reference ids
- parent and root linkage
- operation kind: `job`, `routine_run`, or `session`
- source kind: manual, automation, assignment, API, approval, routine
- normalized status
- cost and usage summary
- preview URLs and runtime services
- timestamps

## Status Normalization

The normalized run state should collapse engine-native states into:

- `queued`
- `connecting`
- `running`
- `awaiting_input`
- `awaiting_approval`
- `succeeded`
- `failed`
- `cancelled`
- `timed_out`

This allows IronHub to present one coherent run state model even when engines disagree on their native vocabulary.

## IronHub Frontend Direction

IronHub should be implemented as a new frontend shell over the control plane.

Initial page map:

- dashboard
- tasks
- runs
- run detail
- routines
- connectors
- approvals
- budgets
- artifacts
- activity
- settings

The current bundled Paperclip UI can remain as a legacy admin surface during transition.

## First Connector: `ironclaw_gateway`

## Why IronClaw first

IronClaw already exposes a real authenticated gateway API with:

- health and gateway status
- job listing, detail, restart, cancel, and prompt continuation
- job event streaming
- routine listing, detail, trigger, toggle, delete, and routine run history

That makes it the most suitable first external execution fabric for the federated model.

## Deployment Assumption

Paperclip-derived backend connects server-to-server to an IronClaw gateway over HTTP using a bearer token.

Typical topology:

- IronHub browser -> Paperclip-derived backend
- backend -> `ironclaw_gateway` connector -> IronClaw gateway

## IronClaw Gateway Route Inventory

The current local IronClaw gateway exposes these protected routes:

### Job routes

- `GET /api/jobs`
- `GET /api/jobs/summary`
- `GET /api/jobs/{id}`
- `POST /api/jobs/{id}/cancel`
- `POST /api/jobs/{id}/restart`
- `POST /api/jobs/{id}/prompt`
- `GET /api/jobs/{id}/events`
- `GET /api/jobs/{id}/files/list`
- `GET /api/jobs/{id}/files/read`

### Routine routes

- `GET /api/routines`
- `GET /api/routines/summary`
- `GET /api/routines/{id}`
- `POST /api/routines/{id}/trigger`
- `POST /api/routines/{id}/toggle`
- `DELETE /api/routines/{id}`
- `GET /api/routines/{id}/runs`

### Gateway routes

- `GET /api/health`
- `GET /api/gateway/status`

## First Connector Scope

The first `ironclaw_gateway` connector should support:

1. health and configuration testing
2. job discovery and status mapping
3. job control: cancel, restart, prompt
4. job event ingestion from SSE or event APIs
5. routine discovery and triggering
6. routine enable and disable
7. routine run listing for observability

It does not need to create new IronClaw routines in phase 1.

## Connector API Surface Mapping

### Health

Paperclip connector operation:

- `testConnector(config)`

IronClaw calls:

- `GET /api/health`
- `GET /api/gateway/status`

Paperclip object impact:

- populate `ExecutionConnectorHealth`
- confirm auth, reachability, and engine metadata

### Job discovery

Paperclip connector operation:

- `listJobs(filter?)`

IronClaw call:

- `GET /api/jobs`

Mapping:

- `JobInfo.id` -> `NormalizedExecutionRun.external.jobId`
- `JobInfo.title` -> `NormalizedExecutionRun.title`
- `JobInfo.state` -> normalized status
- `JobInfo.user_id` -> `external.ownerKey`
- `JobInfo.created_at` and `started_at` -> normalized timestamps

### Job detail

Paperclip connector operation:

- `getJob(runRef)`

IronClaw call:

- `GET /api/jobs/{id}`

Mapping:

- `JobDetailResponse.id` -> external job id
- `state` -> normalized run status
- `elapsed_secs` -> telemetry
- `browse_url` -> preview URL artifact
- `job_mode` -> provider-native metadata
- `transitions` -> normalized run events
- `project_dir` -> external artifact hint

### Job events

Paperclip connector operation:

- `streamJobEvents(runRef)`

IronClaw call:

- `GET /api/jobs/{id}/events`

Expected event mapping from IronClaw SSE event family:

- `job_message` -> `output.delta`
- `job_tool_use` -> `tool.started`
- `job_tool_result` -> `tool.completed`
- `job_status` -> `status.changed`
- `job_result` -> terminal event and external session ref update

### Job control

Paperclip connector operations:

- `cancelJob(runRef)`
- `restartJob(runRef)`
- `sendPrompt(runRef, prompt)`

IronClaw calls:

- `POST /api/jobs/{id}/cancel`
- `POST /api/jobs/{id}/restart`
- `POST /api/jobs/{id}/prompt`

Paperclip object impact:

- append normalized control events
- update status or pending input state
- create audit entries for operator actions

### Routine discovery

Paperclip connector operation:

- `listRoutines()`

IronClaw call:

- `GET /api/routines`

Mapping:

- IronClaw routine id -> `ExecutionRoutineReference.external.routineId`
- enabled flag -> connector-visible status
- trigger summary -> normalized schedule summary
- next fire and last run times -> routine telemetry

### Routine detail and runs

Paperclip connector operations:

- `getRoutine(routineRef)`
- `listRoutineRuns(routineRef)`

IronClaw calls:

- `GET /api/routines/{id}`
- `GET /api/routines/{id}/runs`

Mapping:

- recent runs become normalized `routine_run` child runs
- `job_id` from routine runs becomes external linkage to job executions when present

### Routine control

Paperclip connector operations:

- `triggerRoutine(routineRef)`
- `setRoutineEnabled(routineRef, enabled)`
- `deleteRoutine(routineRef)`

IronClaw calls:

- `POST /api/routines/{id}/trigger`
- `POST /api/routines/{id}/toggle`
- `DELETE /api/routines/{id}`

Paperclip object impact:

- trigger returns a new normalized child run reference when IronClaw returns a `run_id`
- toggle mutates routine status
- delete marks external routine as removed

## Initial Status Mapping Table

IronClaw job states should initially map as follows:

- `creating` -> `queued`
- `pending` -> `queued`
- `running` -> `running`
- `in_progress` -> `running`
- `completed` -> `succeeded`
- `failed` -> `failed`
- `cancelled` -> `cancelled`
- `interrupted` -> `failed`
- `stuck` -> `failed`

This mapping can be refined later without changing the IronHub frontend contract.

## Implementation Plan

## Phase 1: Shared Contracts

1. Add connector and normalized run interfaces in `packages/shared`.
2. Export them through shared package entrypoints.
3. Keep contracts additive and independent from existing heartbeat models.

## Phase 2: Connector Registry Layer

1. Introduce a connector registry distinct from the current local adapter execution path.
2. Allow connectors to advertise job, routine, and session capabilities separately.
3. Keep the existing adapter registry working unchanged.

## Phase 3: `ironclaw_gateway` Server Connector

1. Add config validation and health test path.
2. Implement job list, detail, events, cancel, restart, and prompt.
3. Implement routine list, detail, runs, trigger, toggle, and delete.
4. Normalize statuses, events, and preview URLs.

## Phase 4: Run Registry and API

1. Add backend endpoints for normalized runs and connector health.
2. Store external references and event summaries.
3. Link normalized runs back to issues, approvals, projects, and costs.

## Phase 5: IronHub Frontend Shell

1. Build a new frontend shell around connectors, runs, routines, and approvals.
2. Keep the current bundled UI available during migration.

## Non-Goals For This Slice

- hard-renaming all package scopes to IronHub
- replacing `HeartbeatRun`
- forcing all built-in adapters into the new connector shape immediately
- implementing multi-engine fanout in the first connector
- exposing engine admin tokens directly to the browser

## Acceptance Criteria

1. Shared contracts can represent external job, routine, and session execution without breaking existing types.
2. `ironclaw_gateway` has a documented minimal API surface tied to real IronClaw routes.
3. The normalized run model can express parent-child relationships, external ids, statuses, usage, and artifacts.
4. The plan keeps company scoping, approval visibility, and budget attribution anchored in the Paperclip-derived backend.
5. IronHub can be developed as a new frontend without requiring an immediate hard rename of the monorepo internals.