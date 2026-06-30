# OpenCode v1.17.11 Stop Guard

Task: update the custom OpenCode branch to the latest official release while preserving known local stability fixes and adding a guarded fix for premature clean loop exits.

Worktree and branch:
- Worktree: `/home/jeremy/tymemud/_agent_work/sisyphus/opencode-tool-output-context-cap`
- Branch: `sisyphus/opencode-v1.17.11-stop-guard-20260629`
- Base: official release tag `v1.17.11` at `67aec2212010d67775c35e696d8b8b54902eb338`

Scope boundaries:
- In scope: `packages/opencode/src/session/message-v2.ts`, `packages/opencode/src/session/compaction.ts`, `packages/opencode/src/bus/global.ts`, stop-loop handling in `packages/opencode/src/session/prompt.ts`, focused tests, and this ledger.
- Out of scope: broad session runner rewrites, UI changes, generated SDKs, unrelated app/build changes, process restarts, and replacing the already-pushed old branch.

Validation expectations:
- Failing-first stop-loop regression before the stop fix.
- Focused tests from `packages/opencode`: prompt, processor if needed, message-v2, compaction, and global bus tests.
- `bun run typecheck` from `packages/opencode`.
- `GIT_MASTER=1 git diff --check` from repo root.
- Optional single-target build if focused validation is clean.

Manual-test surfaces:
- Official-release-equivalent sessions should keep the known tool-output replay cap.
- Multiple global event consumers should not trip Node's default listener-count warning on `GlobalBus`.
- If an assistant returns `finish="stop"` while narrowly saying it is about to continue pending work, OpenCode should make one guarded continuation attempt instead of returning control immediately.
- Legitimate final answers must still stop.

## Phase 1: Preflight and release branch

Status: completed

What changed:
- Verified the official npm latest release is `1.17.11`.
- Verified upstream tag `v1.17.11` resolves to `67aec2212010d67775c35e696d8b8b54902eb338`.
- Confirmed old branch `sisyphus/tool-output-context-cap-20260524` was clean before switching.
- Created new branch `sisyphus/opencode-v1.17.11-stop-guard-20260629` from `v1.17.11` to avoid rewriting the existing pushed branch.

Files and anchors:
- `packages/opencode/package.json`: release base reports `"version": "1.17.11"`.

Why:
- The user wants to avoid stale custom builds but needs a custom build only if it tracks the current release and fixes the stop behavior.
- A new release-based branch avoids carrying stale branch history and avoids force-push risk.

User-visible behavior:
- No runtime behavior changed yet.

Validation:
- `npm view opencode-ai version dist-tags --json`: latest `1.17.11`.
- `GIT_MASTER=1 git ls-remote --tags origin 'v1.17.11'`: `67aec2212010d67775c35e696d8b8b54902eb338`.
- `GIT_MASTER=1 git status --short --branch`: clean before branch switch and clean after branch creation except this ledger directory.

Limitations / risks:
- Stop behavior is not fixed yet; the branch is only initialized.

## Phase 2: Preserved stability fixes

Status: completed

What changed:
- Restored the process-wide `GlobalBus` listener limit override from the previous custom branch.
- Promoted the tool-output replay cap to `MessageV2.TOOL_OUTPUT_MAX_CHARS` so normal history replay and compaction share the same cap.
- Added focused regressions for default tool-output truncation and high-fanout global event listeners.

Files and anchors:
- `packages/opencode/src/bus/global.ts`: `GlobalBus.setMaxListeners(0)` after emitter creation.
- `packages/opencode/src/session/message-v2.ts`: exported `TOOL_OUTPUT_MAX_CHARS = 2_000` and made it the default for `truncateToolOutput`.
- `packages/opencode/src/session/compaction.ts`: compaction now references `MessageV2.TOOL_OUTPUT_MAX_CHARS` instead of a private duplicate constant.
- `packages/opencode/test/bus/global.test.ts`: listener fanout regression.
- `packages/opencode/test/session/message-v2.test.ts`: default tool-output truncation regression.

Why:
- The old custom build prevented `MaxListenersExceededWarning` from process-wide event fanout and kept large tool outputs from replaying unbounded history into the model.
- The release branch must preserve those fixes while rebasing onto official `v1.17.11`.

User-visible behavior:
- Long sessions should continue to avoid replaying very large completed tool outputs by default.
- Multiple event consumers should not emit Node listener-count warnings solely because the app has many legitimate `GlobalBus` subscribers.

Validation:
- Red test before source patch: `bun test test/bus/global.test.ts test/session/message-v2.test.ts` failed `GlobalBus.getMaxListeners()` with received `10` and emitted `MaxListenersExceededWarning`.
- After local dependency-link repair for the worktree, `bun test test/bus/global.test.ts test/session/message-v2.test.ts`: `38 pass`, `0 fail`, `63 expect() calls`.

Limitations / risks:
- The stop-loop guard is not implemented yet.
- The worktree had stale ignored `node_modules` links after switching from the old branch to `v1.17.11`; repaired locally without tracked package or lockfile changes.

## Phase 3: Guarded clean-stop continuation

Status: completed

What changed:
- Added a targeted prompt-loop regression for a provider turn that returns `finish="stop"` while the assistant text explicitly says it will continue.
- Added a one-shot guard in `SessionPrompt.runLoop`: when a clean `stop` assistant has no tool calls/errors and its text promises continuation, the loop makes exactly one extra provider turn before honoring any later `stop`.
- Added a negative regression for benign final-answer commitment text so broad phrases like `I'll continue to follow that convention.` do not trigger an extra provider turn.
- Kept existing stop behavior for normal final answers and existing continuation behavior for tool-call turns.

Files and anchors:
- `packages/opencode/src/session/prompt.ts`: `promisesContinuation(...)` helper and `stopContinuationAttempted` guard inside `runLoop`.
- `packages/opencode/test/session/prompt.test.ts`: regression `loop makes one continuation attempt when stop text promises continuation`.

Why:
- Observed clean stops logged `message="exiting loop"` without overflow, compaction, or MaxListeners evidence. The immediate exit branch only considered finish reason, tool calls, and message ordering, so a provider could stop after writing continuation text and OpenCode would return control immediately.
- The guard is intentionally narrow and one-shot to avoid infinite loops and avoid forcing continuation after legitimate final answers.

User-visible behavior:
- If the model says it will continue but the provider marks the turn as `stop`, OpenCode gives it one extra turn to complete the promised work.
- If the second turn also stops, OpenCode exits normally instead of looping forever.

Validation:
- Red test before implementation: `bun test --timeout 15000 test/session/prompt.test.ts --test-name-pattern "loop makes one continuation attempt when stop text promises continuation"` failed with `Expected: 2`, `Received: 1` for `llm.calls`.
- Green focused regression: same command passed `1 pass`, `0 fail`, `5 expect() calls`.
- Adjacent prompt-loop validation: `bun test --timeout 30000 test/session/prompt.test.ts --test-name-pattern "loop exits immediately when last assistant has stop finish|loop continues when finish is tool-calls|loop makes one continuation attempt when stop text promises continuation|loop continues when finish is stop but assistant has tool parts"` passed `4 pass`, `0 fail`, `15 expect() calls`.
- Red negative regression before heuristic narrowing: `bun test --timeout 30000 test/session/prompt.test.ts --test-name-pattern "loop does not continue final commitment text"` failed with `Expected: 1`, `Received: 2` for `llm.calls`.
- Green positive/negative stop-phrase validation after narrowing: `bun test --timeout 30000 test/session/prompt.test.ts --test-name-pattern "loop does not continue final commitment text|loop makes one continuation attempt when stop text promises continuation"` passed `2 pass`, `0 fail`, `9 expect() calls`.
- Stability regressions still green after stop guard: `bun test test/bus/global.test.ts test/session/message-v2.test.ts` passed `38 pass`, `0 fail`, `63 expect() calls`.

Limitations / risks:
- The heuristic is intentionally explicit: it currently matches only narrow English pending-work phrases containing `next`, `remaining`, `follow-up`, or `rest`. Broader language detection is out of scope to avoid speculative auto-continuation.

## Phase 4: Validation and shipping prep

Status: completed

What changed:
- Ran focused and adjacent tests for the restored stability fixes, stop-loop guard, processor finish handling, and compaction behavior.
- Ran package typecheck and diff whitespace validation.
- Started the post-implementation review gate with read-only review lanes for goal compliance, code quality, security, QA execution, and missed context.
- Fixed the review-discovered broad continuation heuristic by adding a negative regression for legitimate final-answer commitment text and narrowing the match to explicit pending-work words.
- Completed the post-implementation review gate after the heuristic fix.
- Confirmed this repo does not carry a conventional checked-in `CHANGELOG.md`; OpenCode release notes are generated by `script/changelog.ts` / `script/raw-changelog.ts`, so no changelog file was updated for this branch-local custom build.

Files and anchors:
- `packages/opencode/test/bus/global.test.ts`: high-fanout GlobalBus regression.
- `packages/opencode/test/session/message-v2.test.ts`: default tool-output truncation regression.
- `packages/opencode/test/session/prompt.test.ts`: one-shot stop-continuation regression plus adjacent loop behavior coverage.
- `packages/opencode/test/session/processor-effect.test.ts`: processor finish/error handling validation surface.
- `packages/opencode/test/session/compaction.test.ts`: compaction summary/prune validation surface.

Why:
- The branch changes affect message replay, compaction input, global event fanout, and prompt-loop termination. These areas need focused tests plus adjacent regression coverage before commit/push.

User-visible behavior:
- No additional runtime behavior beyond Phases 2 and 3.

Validation:
- `bun test test/bus/global.test.ts test/session/message-v2.test.ts`: `38 pass`, `0 fail`, `63 expect() calls`.
- `bun test --timeout 30000 test/session/prompt.test.ts --test-name-pattern "loop exits immediately when last assistant has stop finish|loop continues when finish is tool-calls|loop makes one continuation attempt when stop text promises continuation|loop does not continue final commitment text|loop continues when finish is stop but assistant has tool parts"`: `5 pass`, `0 fail`, `19 expect() calls`.
- `bun test test/session/processor-effect.test.ts test/session/processor.test.ts`: `15 pass`, `0 fail`, `72 expect() calls`.
- `bun test test/session/compaction.test.ts`: `52 pass`, `1 skip` (`projects a compaction message to v2 (v2 projector disabled)`), `0 fail`, `148 expect() calls`.
- `bun run typecheck` from `packages/opencode`: passed (`tsgo --noEmit`).
- `GIT_MASTER=1 git diff --check`: clean.
- `bun run build --single --skip-install --skip-embed-web-ui` from `packages/opencode`: built `opencode-linux-x64` and smoke-tested `dist/opencode-linux-x64/bin/opencode --version` as `0.0.0-sisyphus/opencode-v1.17.11-stop-guard-20260629-202606300000`.
- Post-build `GIT_MASTER=1 git status --short --branch --untracked-files=all`: no tracked build artifacts were added; dirty set remained only the intended source, test, and ledger files.
- Code-quality review self-check: changed source/test files do not add `any`, type assertions, non-null assertions, `@ts-ignore`, `@ts-expect-error`, `enum`, or catch blocks.
- Post-implementation review gate:
  - Goal/constraint rerun after heuristic fix: PASS.
  - QA execution: PASS.
  - Code-quality review: PASS.
  - Security review: PASS.
  - Missed-context review: PASS.

Limitations / risks:
- Full repository test suite was not run; validation stayed focused on changed and adjacent package surfaces.
- The committed branch is a custom release-based build branch from `v1.17.11`, not an upstream release artifact.

## Phase 5: Ship status

Status: completed

What changed:
- Committed the source and test changes as three atomic code/test commits.
- Prepared this ledger as the final documentation commit for the branch.

Files and anchors:
- `674ce9ae5`: `fix(opencode): support high-fanout global bus`.
- `f6bdc170d`: `fix(opencode): cap tool output replay`.
- `7d3ddf0b`: `fix(opencode): retry promised stop continuations once`.
- `docs/implementation-ledgers/opencode-v1.17.11-stop-guard.md`: durable evidence and validation handoff.

Why:
- Atomic commits keep the preserved stability fixes, stop-loop fix, and durable handoff independently reviewable and revertable.

User-visible behavior:
- Users of this custom branch get the same behavior described in Phases 2 and 3.

Validation:
- Final pre-commit validation remained green after review-driven heuristic narrowing and ledger updates.
- Commit/push status is finalized in the session handoff after the ledger commit is created and the branch is pushed.

Limitations / risks:
- Full repository test suite was not run; focused package tests, typecheck, review lanes, and single-platform build smoke were used as the ship gate.
- Recommended user validation: build or install from pushed branch `sisyphus/opencode-v1.17.11-stop-guard-20260629`, then exercise a session that previously stopped after promising continuation.
