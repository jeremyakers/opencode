# OpenCode Tool Output Context Cap

Task: prevent oversized persisted tool outputs from being replayed into model context without a default cap.

Worktree and branch:
- Worktree: `/home/jeremy/coding/opencode`
- Branch: `jeremy/prompt-submit-hydration-23903`

Scope boundaries:
- In scope: `packages/opencode/src/session/message-v2.ts`, `packages/opencode/src/session/compaction.ts`, `packages/opencode/test/session/message-v2.test.ts`, this ledger, and the durable plan.
- Out of scope: generated SDKs, broad compaction selection rewrites, TUI reconnect work, app prompt-submit hydration work, server restarts, process killing.

Validation expectations:
- LSP diagnostics on touched TypeScript files.
- Focused `message-v2` and compaction tests from `/home/jeremy/coding/opencode/packages/opencode`.
- `bun typecheck` from `/home/jeremy/coding/opencode/packages/opencode`.
- `GIT_MASTER=1 git diff --check` from `/home/jeremy/coding/opencode`.

Manual-test surfaces:
- A session with a huge completed tool output should not replay that full output into a later model request.
- Compacted tool outputs should still replay as `[Old tool result content cleared]`.

## Phase 1: Plan and evidence capture

Status: completed

What changed:
- Saved the implementation plan and initialized this ledger before source edits.

Files and anchors:
- `.sisyphus/plans/opencode-tool-output-context-cap.md`: evidence, scope, and validation plan.
- `docs/implementation-ledgers/opencode-tool-output-context-cap.md`: durable implementation ledger.

Why:
- The crash evidence points to unbounded completed tool output being serialized into model context when prompt assembly omits `toolOutputMaxChars`.

User-visible behavior:
- No runtime behavior changed in this phase.

Validation:
- Pending source validation after implementation.

Limitations / risks:
- The existing OpenCode checkout already had unrelated dirty TUI reconnect files and untracked ledgers/plans; this work avoids modifying them.

## Phase 2: Default model-context tool output cap

Status: completed

What changed:
- Exported the existing `2_000` character tool-output cap from `MessageV2`.
- Made completed tool result serialization use that cap by default when callers do not pass `toolOutputMaxChars`.
- Reused the exported cap from compaction instead of keeping a private duplicate.
- Added a regression test proving default `MessageV2.toModelMessages` truncates a completed tool output that exceeds the cap by one character.

Files and anchors:
- `packages/opencode/src/session/message-v2.ts`: `TOOL_OUTPUT_MAX_CHARS` export and `truncateToolOutput` default parameter.
- `packages/opencode/src/session/compaction.ts`: compaction prompt conversion now references `MessageV2.TOOL_OUTPUT_MAX_CHARS`.
- `packages/opencode/test/session/message-v2.test.ts`: `truncates completed tool output by default`.

Why:
- Normal prompt assembly called `MessageV2.toModelMessagesEffect` without `toolOutputMaxChars`, so completed tool outputs were not capped before being replayed into model context.
- The cap value is reused from existing compaction behavior rather than newly tuned.

User-visible behavior:
- Long completed tool outputs are replayed to future model calls as a capped prefix plus the existing truncation marker instead of the full stored text.
- Already compacted tool outputs still replay as `[Old tool result content cleared]`.

Validation:
- LSP diagnostics on `message-v2.ts`, `compaction.ts`, and `message-v2.test.ts`: no diagnostics.
- `/home/jeremy/.bun/bin/bun test test/session/message-v2.test.ts`: `35 pass`, `0 fail`, `52 expect() calls`.
- `/home/jeremy/.bun/bin/bun test test/session/compaction.test.ts`: `50 pass`, `0 fail`, `146 expect() calls`.
- `/home/jeremy/.bun/bin/bun typecheck`: passed with `tsgo --noEmit`.
- Initial `bun` invocations failed because `bun` was not on the non-interactive shell `PATH`; reruns used `/home/jeremy/.bun/bin/bun`.
- First build attempt failed when the build script's postinstall called `bun` from a PATH that lacked `/home/jeremy/.bun/bin`; rerun with `PATH="/home/jeremy/.bun/bin:$PATH"` passed.
- `PATH="/home/jeremy/.bun/bin:$PATH" /home/jeremy/.bun/bin/bun run script/build.ts`: passed; smoke tests passed for `dist/opencode-linux-x64/bin/opencode --version` and `dist/opencode-linux-x64-baseline/bin/opencode --version`, both reporting `0.0.0-jeremy/prompt-submit-hydration-23903-202605240203`.
- `GIT_MASTER=1 git diff --check`: passed after implementation and ledger updates.
- Post-implementation review rerun synchronously after background review handles became unavailable:
  - Goal/constraint Oracle: PASS, high confidence; older timed-out exploration did not need retry because direct source inspection and validation confirmed the code path.
  - Code-quality Oracle: PASS, high confidence; explicit override behavior remains preserved and the shared constant is appropriately owned by `MessageV2`.
  - Security Oracle: PASS, severity none; the change reduces context leakage/overflow risk and adds no new attack surface.
  - Hands-on QA: PASS, high confidence; reran message-v2 and compaction focused tests successfully.
  - Context mining: PASS, high confidence; no blocking missed requirements found.

Limitations / risks:
- The build emits the repo's Vite chunk-size warning for large generated chunks; this warning is not from the touched session files.
- `packages/core/src/models-snapshot.js` was regenerated by the build and restored because it is unrelated generated output.
- No root `CHANGELOG.md` exists in this OpenCode checkout; no changelog update was made.

## Phase 3: Final status

Status: completed

What changed:
- Closed implementation and review evidence for the default tool-output context cap.

Files and anchors:
- `docs/implementation-ledgers/opencode-tool-output-context-cap.md`: final validation and review evidence.

Why:
- The final handoff needs durable evidence for source changes, validation, review status, and remaining repository state.

User-visible behavior:
- Future model requests receive capped completed tool output replay by default, avoiding the observed huge-output context overflow path.

Validation:
- Complete validation and review evidence is recorded in Phase 2.

Limitations / risks:
- The checkout still contains unrelated dirty TUI reconnect files and prior untracked plans/ledgers that predate this fix.
- Commit/push status is pending final git safety inspection.
