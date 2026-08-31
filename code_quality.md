# Code Review: `feat/agent-chat-markup-attachments`

## Context

This change unifies the agent 1-to-1 chat input with the file-comment input and adds chat attachments, markup metadata, timestamps, inline message badges, and attachment previews. The review covers `main...feat/agent-chat-markup-attachments` (three commits, 26 files, +1,420/-351 lines).

## Findings

### FYI: Attachment inspection is intentionally tool-driven

The chat and comment flows expose attachment IDs and metadata in the message context rather than forcing every attachment into the initial model request. This is appropriate because attachments may be images, videos, PDFs, Markdown files, or other formats. The agent can choose `analyze_image`, `screenshot`, `read_pdf_pages`, or `download_asset` based on the attachment type and the task. The tool availability and behavior for unprocessed attachment assets should still be covered by tests (see the notes below).

### Required: A message can be discarded when the team ID is still loading

`ChatbotSidebar` returns early when `teamId` is unavailable in its `ChatInput.onSendMessage` callback (`packages/webui/components/chatbot-sidebar.tsx:806-809`). `ChatInput.handleSend` has already cleared the editor, upload list, and annotation state immediately after invoking that callback (`packages/webui/components/chat/message-input.tsx:575-589`). If the user submits during the initial `ensureTeamIdForProject` request, the UI silently loses the draft and uploaded attachments without creating a task.

Disable the send path until `teamId` is available, or make the send callback report whether it accepted the message and only reset `ChatInput` after acceptance. Add a test for submission while team resolution is pending.

### Required: Session deletion no longer asks for confirmation

The history delete handler changed from `confirm(m.delete_session_confirm())` to an unconditional `deleteSession` call (`packages/webui/components/chatbot-sidebar.tsx:706-712`), even though the localized confirmation message remains defined. A single accidental click now permanently deletes a chat session. Restore the confirmation flow or use an `AlertDialog`, and cover cancel/confirm behavior with a component test.

### Required: Mention keyboard navigation breaks when the Agents section is collapsed

The human mention items always add `filteredAgents.length` to their index (`packages/webui/components/chat/message-input.tsx:730-733`), while `filteredEntities` omits agents when `collapsedSections.bots` is true (`packages/webui/components/chat/message-input.tsx:234-238`). With two matching agents and the Agents section collapsed, the first visible human is rendered with index `2`; hovering it sets `highlightedIndex` to `2`, and pressing Enter calls `handleSelectEntity(filteredEntities[2])`, which is `undefined`. Use an offset based on whether the agents section is expanded, and add a keyboard test for the collapsed state.

### Required: New user-facing strings bypass Paraglide

The new sidebar contains hardcoded/fallback UI text despite the project's mandatory i18n rule, including `Back to Chat`, `Delete Session`, `Thinking...`, `No past chat sessions found`, `Chat Session`, `Page`, and fallback labels for attachments/assets/download (`packages/webui/components/chatbot-sidebar.tsx:633,681,719,750,320,336,390,405,658`). The existing localized keys should be used directly, and missing keys should be added to both locale files rather than supplied as English fallbacks. This also avoids English text appearing in the Chinese locale.

### Optional: Preserve the previous rendering behavior for `thinking_level_change`

The old sidebar rendered `thinking_level_change` entries through the custom/system-message branch. The refactor now routes `thinking_level_change` directly to `default` and returns `null` (`packages/webui/components/chatbot-sidebar.tsx:445-446`), so those entries disappear. If these entries are intentionally hidden, add a test documenting that decision; otherwise retain the previous rendering behavior.

### Optional: Make clickable message cards keyboard accessible

Markup/timestamp message cards and attachment rows use non-interactive `<div onClick>` elements (`packages/webui/components/chatbot-sidebar.tsx:301-307,346-361`). They work with a mouse but cannot be activated by keyboard users and do not expose an accessible name or role. Prefer semantic buttons/links where possible, or add focusability, keyboard handling, and appropriate ARIA semantics.

## Quality Checklist

- Correctness: **Request changes** due to silent draft loss, destructive deletion without confirmation, and broken mention navigation. The previously noted direct image-delivery concern is withdrawn because tool-driven attachment inspection is the intended design.
- Readability: The data flow is understandable, but `ChatbotSidebar` and `ChatInput` now contain substantial duplicated rendering and interaction logic that should be decomposed after the correctness fixes.
- Architecture: Reusing `getProxyType` would keep attachment classification consistent between the service and workflow. The shared input API is directionally appropriate.
- Security: Existing asset permission checks remain in `ChatService`; no new injection or authorization bypass was found.
- Performance: Attachment URL presigning is parallelized for comment attachments. The chat path still resolves multiple assets sequentially, but this is not a new unbounded query pattern.
- Tests: `bun run test` passed (147 files, 1,393 tests). The five changed-area test files passed (64 tests). The added tests do not cover tool selection/handling for fresh Markdown or video/PDF attachment assets, team-ID race handling, delete confirmation, or collapsed mention navigation.
- Static checks: `bun run lint`, `bun run typecheck`, `bun run format --check`, and `git diff --check` passed.
- E2E: `bun run test:e2e:workflow` passed (13 files, 56 tests), `bun run test:e2e:webui` passed (9 tests), and `bun run test:e2e:app` passed (38 tests) when run after the parallel port conflict was cleared.

## Verdict

**Request changes** — prevent draft loss while team context loads, restore deletion confirmation, repair collapsed mention navigation, and route all new user-facing text through Paraglide before merging.
