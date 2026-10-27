# Developer Guide

We use a pull request–based workflow for all tasks.

## Workflow

Before starting any task, create and switch to a new feature branch:

```bash
git checkout -b <branch-name>
```

After finishing the work and verifying that all checks pass:

1. Update `CHANGELOG.md` under `## [Unreleased]` for user-facing changes (see [Changelog Guidelines](#changelog-guidelines)).
2. Stage and commit your changes following [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#summary) (`<type>[optional scope]: <description>` in imperative mood, e.g., `feat(auth): add OAuth login support`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, and `!` or `BREAKING CHANGE:` for breaking changes).
3. Push the branch to `origin` and open a pull request using the GitHub CLI:

```bash
git add .
git commit -m "<commit-message>"
git push origin <branch-name>
gh pr create --title "<pull-request-title>" --body "<pull-request-body>"
```

## Changelog Guidelines

We maintain `CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Before opening a pull request, add an entry under `## [Unreleased]` for any user-facing changes:

- **End-User Friendly**: Write in plain language for end users without heavy technical jargon, internal file paths, or private symbols.
- **Formatting**: `- **<scope>**: <Description>` (e.g. `- **asset**: Fix an issue where moving a video to trash while it was still transcoding could cause it to lose its trashed status`).
- **No PR Numbers**: Do not include PR numbers or links; the release pipeline appends them automatically.
- **Internal Changes**: Routine refactors, test additions, or internal chores without external behavior changes may omit changelog updates.

## Pull Request Template

```md
## Summary

Briefly describe what this PR changes and why.

## Changes

- List the main updates made in this branch.
- Include any important implementation details.

## Verification

- Describe the checks or tests you ran.
- Include relevant outputs if applicable.

## Manual Verification Plan

- Provide concise instructions for manually verifying this change.
- Assume familiarity with the project and existing development workflow.
- Skip boilerplate steps (e.g. starting the app, logging in, opening common pages) unless they are part of the change.
- Focus on what needs to be verified, including scenarios, edge cases, and expected results.

## Notes

Add any additional context, caveats, or follow-up work.
```

## Submission Rules

- **Strict Requirement**: A submission is complete **only** when there is a single final code state in which **all** of the following pass **simultaneously** (do not submit intermediate states where some checks fail):
  - `bun run lint`
  - `bun run format`
  - `bun run typecheck`
  - `bun run test`
  - `bun run test:e2e:app`
  - `bun run test:e2e:webui`
  - `bun run test:e2e:workflow`
- **Backend Testing Mandate**: Every backend feature, service method, workflow, and activity MUST have comprehensive tests.
- **Type Safety**: Explicit `any` is strictly forbidden. Use `unknown` when the type is unknown. If `any` is unavoidable (e.g., untyped 3rd-party library), add `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with a comment directly above explaining why.
- **Cleanup Requirement**: Remove all temporary verification files, scripts, screenshots, and the `verification/` folder before submitting.

## Workspace Architecture

The project is a Bun Workspaces monorepo (Bun runtime, Hono API, Prisma + Pgvector18 DB, React + Tailwind CSS + Shadcn UI frontend):

- **`packages/webui`**: React frontend (`bun run dev` runs on port 3000).
- **`packages/api`**: Hono HTTP entry point and MCP server.
- **`packages/core`**: Business logic, services, operations, and asset readers.
- **`packages/db`**: Prisma client, schema, and migrations.
- **`packages/dtos`**: Shared Zod schemas and TypeScript types (do not append `Dto` suffix to type names).
- **`packages/operations`**: Shared Operation definitions (`@shumai/operations`) used by agent tools, MCP, and `apps/cli`.
- **Workers**: `@shumai/workflow-core` (DBOS engine), `@shumai/agent` (AI agent workflows/activities), and `@shumai/transcode` (media workflows/activities).

### Layered Communication & Code Patterns

1. **API → Core → DB**: API routes (`packages/api/src/`) call Core services (`packages/core/src/`), which call `@shumai/db`. Never access `prisma` directly in the API layer, and never return raw Prisma objects from API routes (always map to DTOs).
2. **Services**: Define service logic as instance methods on a class and export a singleton instance (check existing services in `packages/core/src/`).
3. **Hono Routes**: Always chain `.get()` / `.post()` on a Hono instance using `zValidator` and export the chained route as default to preserve Hono RPC type inference (check `packages/api/src/`).
4. **Operations First**: If an Operation exists for an action, API routes must call it via `runOperation` instead of re-implementing permission checks and audit logging. UI-only routes keep calling services directly.
5. **Dependencies & Imports**:
   - Declare runtime `dependencies` in each package's local `package.json` (`workspace:*` for internal packages). Keep root `package.json` strictly for shared `devDependencies` and scripts.
   - Never edit `package.json` manually to add dependencies; run `bun add <package> --filter <workspace>` from the root without an explicit version.
   - Use absolute workspace imports across packages (e.g., `@shumai/db`, `@shumai/core/src/...`). When adding a new package, add its path mappings to the root `tsconfig.json`.

## Operations & Asset Readers

### Operations

An **Operation** is defined once and exposed across built-in agent tools, the MCP server, and `shumai-cli`. Check existing definitions in `packages/operations/src/` and implementations in `packages/core/src/operations/`.

- **Definition (`packages/operations/src/**`)**: Keep free of server dependencies (no `@shumai/core` or `@shumai/db`). Every Zod input/output field must have `.describe()`. Object input fields must be listed in `cli.flatten` or `cli.omit`.
- **Implementation (`packages/core/src/operations/**`)**: Use `implementOperation(definition, { authz, prepare?, execute, audit? })`.
  - `authz` returns all required permissions (checked before any side effect).
  - `execute` calls Core services only (**importing `prisma` in Operations is forbidden by lint**).
  - `audit` resolves team/project from the affected asset, never trusting caller input.
  - Outputs must be DTOs matching the output schema.
- **Register & Run**: Register in both `packages/operations/src/registry.ts` and `packages/core/src/operations/registry.ts`. Execute only via `runOperation(op, { userId, via, agentId? }, input)`.
- **Surface Extensions**: For surface-specific parameters or rendering, check `packages/agent/src/operation-extensions/`, `packages/api/src/mcp-extensions/`, and `apps/cli/src/operations/extensions/`.

### Asset Readers

`read_asset` is backed by readers in `packages/core/src/asset-read/readers/` registered in `packages/core/src/asset-read/registry.ts` (order matters: first matching reader wins). To add or modify a reader, check existing readers in `packages/core/src/asset-read/readers/` and option schemas in `packages/operations/src/asset/read-asset.ts`. Use `badRequest(...)` for invalid input and return storage keys in `ReadResult`.

## Frontend Rules (`packages/webui`)

- **System Colors**: Prefer semantic design tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, etc.) over hardcoded Tailwind colors for light/dark theme support.
- **Route Code-Splitting**: Split all routes into `[route].tsx` (route definition and loaders) and `[route].lazy.tsx` (UI component and heavy imports).
- **Radix / Shadcn UI**: Set `modal={false}` on `<DropdownMenu>` when triggering a `Dialog` or `AlertDialog` from inside it to prevent focus-trap UI freezes. Use `ScrollArea` (`@/ui/components/ui/scroll-area`) for scrollable containers.
- **Pagination & Infinite Scroll**: Use `useInfiniteQuery` + `react-intersection-observer` with default `limit: 20` and the API's `total` field. Backend list APIs use `paginateQuery` from `packages/core/src/pagination.ts` (default `limit: 20`).
- **Internationalization (i18n)**: Hardcoded UI text is strictly forbidden. Add `snake_case` keys to both `packages/webui/messages/en.json` and `packages/webui/messages/zh.json`, run `bun run i18n:compile` (or `bun run i18n:watch`), and import `m` from `@/ui/paraglide/messages.js`.

## Database & Prisma (`packages/db`)

- **Schema & Config**: Schema at `packages/db/prisma/schema.prisma`, config at `prisma.config.ts`, generated client at `packages/db/src/generated/prisma`.
- **ULIDs & Sorting**: All models (except key-value stores like `Setting`) must use `@default(ulid())`. Do not manually generate DB IDs in application code. Order all list queries by `orderBy: { id: 'desc' }` (do not sort by unindexed `createdAt`).
- **Strict JSON Typing**: Annotate `Json` columns with `/// [TypeName]` in `schema.prisma` and define the type under the global `PrismaJson` namespace in `packages/db/src/prisma-json-types.ts`. Use type guards/narrowing instead of `as any`.
- **Migrations**:
  - Commands: `bun --bun run prisma migrate dev`, `bun --bun run prisma migrate deploy`, `bun --bun run prisma generate`.
  - Never hand-write DDL migration files; always generate them via `prisma migrate dev` (use `--create-only` for custom data migration SQL).
  - **Never run `prisma migrate reset --force`** automatically. If migrations are out of sync or require a reset, stop and ask the user.

## DBOS Workflows & Activities

Check existing workflows and activities in `packages/agent/src/{workflows,activities}`, `packages/transcode/src/{workflows,activities}`, and `packages/workflow-core/src/`.

- **Patterns**: Workflows are exported async functions registered at bootstrap (`initAgentWorkflows`, `initTranscodeWorkflows`) and auto-enqueued when `WorkflowTask` records are created. Wrap activity functions with `defineStep` from `@shumai/workflow-core` (activities may call services or query `prisma` directly).
- **Non-Retryable Errors**: Never throw standard `Error` objects for fatal validation or business failures in workflows/activities. Always throw `ApplicationFailure.create({ message: '...', nonRetryable: true })` from `@shumai/workflow-core`.
- **Durable Step File Exchange**: Save intermediate files passed across steps to S3, fetch them in consuming steps via `ensureLocalMediaFile` (never assume local `/tmp` persists across steps), and clean up temporary S3 files in a `finally` block.

## Logging

Use structured **pino** logging via `import { logger } from '@shumai/core/src/logger'`. Pass metadata object first and message string second: `logger.info({ userId, projectId }, 'Project deleted')`.

## Testing

Use **Vitest** via `bun run test` (**never** use `bun test`).

- **Bug Fixes**: Always write a test case that reproduces the bug (demonstrates failure) before applying a backend fix.
- **Test Maintenance**: Never delete tests unless the tested feature is permanently removed; update existing tests when refactoring.
- **Service & Operation Tests (`packages/core/src/**/*.test.ts`)**: Call `setupTestDbHooks()` from `@shumai/db` inside `describe` for per-test PostgreSQL transaction rollback, and use `prisma` from `@shumai/db`. Every Operation requires real-DB tests covering success, permission denial (no side effects), and audit entries.
- **API Tests (`packages/api/src/**/*.test.ts`)**: Mock Core services using `vi.spyOn` or `vi.mock`.
- **Workflow E2E Tests (`packages/e2e/workflow/**/*.test.ts`)**: Run via `bun run test:e2e:workflow`. Mandatory when adding/updating workflows or activities. Mock **only** AI API calls (spy on `AgentHarness.prototype.prompt`); do not mock S3, DB, or media/transcode services.
- **Web App E2E Tests (`apps/web/e2e/**/*.spec.ts`)**: Run via `bun run test:e2e:app`. Use `owner`, `project`, and `file` fixtures for setup, and document every added, renamed, or removed spec in `apps/web/e2e/README.md`.
