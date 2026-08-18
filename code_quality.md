# Code Quality Review: Quota Usage Dashboard

## Context

The change moves quota usage monitoring from the settings rule-card dialog to an owner-only dashboard section, adds collapsible rule/record display, and adds an audited manual record reset operation.

## Review

### Correctness

- The reset service validates team ownership, scope mode, membership, role filters, and selected-member membership.
- Reset and first-use record creation are serialized with a quota-rule row lock.
- Reset starts a new window at the current time and clears consumption.
- API and service tests cover shared records, member records, invalid targets, cross-team access, request validation, and audit logging.
- The application E2E test covers the settings/dashboard flow and verifies the persisted reset.

### Readability and architecture

- Business logic remains in `QuotaService`; the API only validates, authorizes, invokes the service, and maps the audit action.
- The dashboard owns usage presentation, while quota formatting metadata is shared between dashboard and settings.
- The removed usage dialog and obsolete translation messages are not referenced after the refactor.

### Security

- The reset endpoint retains owner-level team authorization.
- Request input is validated with Zod.
- SQL uses Prisma tagged-template parameters and does not interpolate raw user input.

### Performance

- Usage records are queried only after a rule is expanded.
- Expanded rules refresh every ten seconds, matching the previous usage dialog behavior.
- Quota rules retain the existing bounded list endpoint and descending ID ordering.

## Verification

- `bun run lint` passed.
- `bun run format` passed.
- `bun run typecheck` passed.
- `bun run test` passed: 124 files, 1190 tests.
- Quota API/core tests passed: 2 files, 30 tests.
- Quota application E2E passed.
- WebUI harness E2E passed: 9 tests.
- Workflow E2E passed: 14 files, 58 tests.
- `git diff --check` passed.

## Verdict

Approve. No critical or required findings remain.
