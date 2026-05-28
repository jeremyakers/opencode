# OpenCode Tool Output Context Cap

Task: prevent oversized persisted tool outputs from being replayed into model context without a default cap.

Worktree and branch:
- Worktree: `/home/jeremy/tymemud/_agent_work/sisyphus/opencode-tool-output-context-cap`
- Branch: `sisyphus/tool-output-context-cap-20260524`
- Base: latest fetched `origin/dev` at `0cf99cf5f`.

Scope boundaries:
- In scope: `packages/opencode/src/session/message-v2.ts`, `packages/opencode/src/session/compaction.ts`, `packages/opencode/test/session/message-v2.test.ts`, `packages/opencode/src/bus/global.ts`, `packages/opencode/test/bus/global.test.ts`, this ledger, and the durable plan.
- Out of scope: generated SDKs, broad compaction selection rewrites, TUI reconnect work, app prompt-submit hydration work, server restarts, process killing.

Validation expectations:
- LSP diagnostics on touched TypeScript files.
- Focused `message-v2`, compaction, and global bus tests from `/home/jeremy/tymemud/_agent_work/sisyphus/opencode-tool-output-context-cap/packages/opencode`.
- `bun typecheck` from `/home/jeremy/tymemud/_agent_work/sisyphus/opencode-tool-output-context-cap/packages/opencode`.
- `GIT_MASTER=1 git diff --check` from `/home/jeremy/tymemud/_agent_work/sisyphus/opencode-tool-output-context-cap`.

Manual-test surfaces:
- A session with a huge completed tool output should not replay that full output into a later model request.
- Compacted tool outputs should still replay as `[Old tool result content cleared]`.
- Multiple concurrent OpenCode sessions or global event/SSE consumers should not trip Node's default 10-listener warning on the shared `GlobalBus`.

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
- This old status was from the original dirty checkout. The follow-up work moved to the clean upstream-based worktree named above.

## Phase 4: Clean upstream branch

Status: completed

What changed:
- Created clean worktree `/home/jeremy/tymemud/_agent_work/sisyphus/opencode-tool-output-context-cap`.
- Created branch `sisyphus/tool-output-context-cap-20260524` from latest `origin/dev` at `0cf99cf5f`.
- Cherry-picked the context-cap source commit and the evidence docs commit onto the clean branch:
  - `7314cd6b6 fix(session): cap tool output replay by default` from `455713da4`.
  - `caaa20393 docs: record tool output cap evidence` from `ae55e836e`.
- Deliberately did not carry old commit `c7729a035 docs: note tool output cap push blocker` because it documented the previous dirty-checkout push failure, not the clean branch state.

Why:
- Latest upstream still had `truncateToolOutput(text, maxChars?: number)` with no default cap, so the exact context-cap fix was still needed, but the dirty old checkout was 473 commits behind `origin/dev`.

Validation:
- `GIT_MASTER=1 git status --short --branch --untracked-files=all`: clean after cherry-picks and before the GlobalBus follow-up.

Limitations / risks:
- None for branch setup.

## Phase 5: GlobalBus listener warning follow-up

Status: completed

What changed:
- Raised `GlobalBus`'s listener threshold to `100`.
- Added `packages/opencode/test/bus/global.test.ts`, which attaches 25 event handlers, emits one event, verifies all handlers receive it, and verifies cleanup restores the original listener count.

Files and anchors:
- `packages/opencode/src/bus/global.ts`: `GlobalBus.setMaxListeners(100)` with local rationale comment.
- `packages/opencode/test/bus/global.test.ts`: focused fanout regression test.

Why:
- Screenshot `/home/jeremy/Pictures/OpenCode_crash_2026-05-24_08-52.png` shows `MaxListenersExceededWarning: Possible EventTarget memory leak detected. 11 event listeners added to [iz]` followed by `Trace/breakpoint trap`.
- The user confirmed another OpenCode session was active, which makes the shared global event fanout path plausible.
- Upstream issue `#28492` reports the same warning and stack after the web interface starts.
- Upstream issue `#23798` and PR `#23796` identify normal `GlobalBus` fanout over Node's default 10-listener threshold as the false warning path; the `100` threshold is copied from that upstream PR rather than locally invented.

Validation:
- `PATH="/home/jeremy/.bun/bin:$PATH" /home/jeremy/.bun/bin/bun install --frozen-lockfile --ignore-scripts`: passed after a normal install failed on missing `node-gyp` for `tree-sitter-powershell`.
- LSP diagnostics on `packages/opencode/src/bus/global.ts`, `packages/opencode/test/bus/global.test.ts`, `packages/opencode/src/session/message-v2.ts`, `packages/opencode/src/session/compaction.ts`, and `packages/opencode/test/session/message-v2.test.ts`: no diagnostics after current dependencies were installed.
- `PATH="/home/jeremy/.bun/bin:$PATH" /home/jeremy/.bun/bin/bun test test/bus/global.test.ts`: `1 pass`, `0 fail`, `3 expect() calls`.
- `PATH="/home/jeremy/.bun/bin:$PATH" /home/jeremy/.bun/bin/bun test test/session/message-v2.test.ts test/session/compaction.test.ts`: `88 pass`, `0 fail`, `208 expect() calls`.
- `PATH="/home/jeremy/.bun/bin:$PATH" /home/jeremy/.bun/bin/bun typecheck`: passed with `tsgo --noEmit`.
- `GIT_MASTER=1 git diff --check`: passed.
- Initial `PATH="/home/jeremy/.bun/bin:$PATH" /home/jeremy/.bun/bin/bun run script/build.ts`: blocked because upstream requires Bun `^1.3.14` and the host initially had Bun `1.3.13`.
- After Bun was upgraded to `1.3.14`, `PATH="/home/jeremy/.bun/bin:$PATH" /home/jeremy/.bun/bin/bun run script/build.ts`: passed.
- Binary smoke checks passed:
  - `./dist/opencode-linux-x64/bin/opencode --version`: `0.0.0-sisyphus/tool-output-context-cap-20260524-202605251618`.
  - `./dist/opencode-linux-x64-baseline/bin/opencode --version`: `0.0.0-sisyphus/tool-output-context-cap-20260524-202605251618`.
- `GIT_MASTER=1 git status --short --untracked-files=all`: clean after the build and smoke checks.

Limitations / risks:
- The screenshot warning was not present in the latest log files; it appears to be emitted to the terminal rather than the normal OpenCode log.
- This fixes the known false-positive listener warning path for shared `GlobalBus`; if another EventTarget accumulates listeners, additional evidence will be needed.
- Full build passed after upgrading/installing Bun `1.3.14` or newer.

## Phase 6: Shipping status

Status: completed; superseded by Phase 9 push success

What changed:
- Committed the clean upstream-based work on `sisyphus/tool-output-context-cap-20260524`.

Local commits on top of `origin/dev`:
- `7314cd6b6 fix(session): cap tool output replay by default`
- `caaa20393 docs: record tool output cap evidence`
- `c6cb6f09c fix(bus): raise global event listener threshold`
- `2176fde23 docs: update tool output cap clean-branch evidence`

Validation:
- Full validation status is recorded in Phase 5.

Push status:
- Attempted `GIT_MASTER=1 git push -u fork HEAD:refs/heads/sisyphus/tool-output-context-cap-20260524`.
- Push failed because GitHub credentials were unavailable to the non-interactive shell: `fatal: could not read Username for 'https://github.com': terminal prompts disabled`.

Remaining:
- Branch remains local until pushed from an authenticated environment.
- Full build is now validated after Bun was upgraded to `1.3.14`.

## Phase 7: Final review

Status: completed with external blockers

Review results:
- Goal/constraint Oracle: PASS. Implementation satisfies the context-cap goal and the GlobalBus warning/crash follow-up; build and push blockers are external.
- Code-quality Oracle: PASS. Default truncation preserves explicit overrides, and the GlobalBus cap is justified by upstream provenance.
- Security Oracle: PASS, severity none. The replay cap reduces context exposure, and the listener threshold change adds no auth, network, or file-write attack surface.
- Context mining: PASS. No material missed upstream context; related upstream issues and PRs are recorded.
- QA: originally failed only because full build validation could not run under Bun `1.3.13`; after Bun was upgraded to `1.3.14`, the full build and binary smoke checks passed.

Validation summary:
- Focused tests, typecheck, LSP diagnostics, and diff check passed as recorded above.
- Full build passed after the local Bun upgrade.
- Push remains blocked by unavailable HTTPS GitHub credentials in the non-interactive shell.

## Phase 8: Post-upgrade build validation

Status: completed

What changed:
- Re-ran full build after Bun was upgraded from `1.3.13` to `1.3.14`.

Validation:
- `/home/jeremy/.bun/bin/bun --version`: `1.3.14`.
- `PATH="/home/jeremy/.bun/bin:$PATH" /home/jeremy/.bun/bin/bun run script/build.ts`: passed.
- `./dist/opencode-linux-x64/bin/opencode --version`: `0.0.0-sisyphus/tool-output-context-cap-20260524-202605251618`.
- `./dist/opencode-linux-x64-baseline/bin/opencode --version`: `0.0.0-sisyphus/tool-output-context-cap-20260524-202605251618`.
- `GIT_MASTER=1 git status --short --untracked-files=all`: clean after build.

Remaining:
- Push still needed an SSH-authenticated GitHub credential path at this point.

## Phase 9: SSH push

Status: completed

What changed:
- Pushed the clean branch to the fork using the SSH URL directly, without changing git remote config.

Commands and results:
- Initial SSH push reached the pre-push hook but failed because the hook PATH did not include Bun: `.husky/pre-push: 5: bun: not found`.
- Retried with `PATH="/home/jeremy/.bun/bin:$PATH"` so the hook could run normally.
- Pre-push hook ran `bun turbo typecheck`.
- `GIT_MASTER=1 git ls-remote --heads git@github.com:jeremyakers/opencode.git sisyphus/tool-output-context-cap-20260524`: confirmed remote branch at `587fef2e4bcb3192737f0a8b357e1d44d5d3862a`.

Remaining:
- This ledger update itself still needs one final push after commit.

## Phase 10: Compiled TUI native asset packaging

Status: completed

What changed:
- Updated `packages/opencode/script/build.ts` to generate an `opencode-native-assets.gen.ts` entrypoint for each target.
- The generated entrypoint imports the target platform's OpenTUI native library with `{ type: "file" }`, forcing Bun compile to embed `libopentui.so`, `libopentui.dylib`, or `opentui.dll` in the compiled binary.
- Left `@parcel/watcher` native packaging unchanged after an attempted watcher asset import produced `$.subscribe is not a function`; the watcher load issue is nonfatal and separate from the TUI render failure.

Why:
- The compiled `dist/opencode-linux-x64/bin/opencode --mdns` failed before drawing the TUI with `Failed to initialize OpenTUI render library: Failed to open library "/$bunfs/root/libopentui-z1wz5djp.so": No such file or directory`.
- A minimal Bun compile experiment proved direct `{ type: "file" }` import of `libopentui.so` embeds the same hashed `/$bunfs/root/libopentui-z1wz5djp.so` path and makes `Bun.file(path).exists()` true.

Validation:
- LSP diagnostics on `packages/opencode/script/build.ts`: no diagnostics.
- `PATH="/home/jeremy/.bun/bin:$PATH" /home/jeremy/.bun/bin/bun typecheck`: passed with `tsgo --noEmit`.
- `PATH="/home/jeremy/.bun/bin:$PATH" /home/jeremy/.bun/bin/bun test test/bus/global.test.ts test/session/message-v2.test.ts test/session/compaction.test.ts`: `89 pass`, `0 fail`, `211 expect() calls`.
- `PATH="/home/jeremy/.bun/bin:$PATH" /home/jeremy/.bun/bin/bun run script/build.ts --single`: passed.
- `./dist/opencode-linux-x64/bin/opencode --version`: `0.0.0-sisyphus/tool-output-context-cap-20260524-202605280144` after the single-target build.
- Real TUI smoke with `timeout 8s script -qfec 'OPENCODE_DISABLE_CHANNEL_DB=1 ./dist/opencode-linux-x64/bin/opencode --port 0 --hostname 127.0.0.1 /home/jeremy/tymemud/tmp/opencode-tui-smoke' /tmp/opencode-tui-smoke.out`: produced OpenTUI terminal output and did not log the prior OpenTUI native-library error.
- `PATH="/home/jeremy/.bun/bin:$PATH" /home/jeremy/.bun/bin/bun run script/build.ts`: full multi-target build passed.
- Final binary smoke checks after full build:
  - `./dist/opencode-linux-x64/bin/opencode --version`: `0.0.0-sisyphus/tool-output-context-cap-20260524-202605280146`.
  - `./dist/opencode-linux-x64-baseline/bin/opencode --version`: `0.0.0-sisyphus/tool-output-context-cap-20260524-202605280146`.
- Final real TUI smoke with the full-build binary produced OpenTUI terminal output and the latest logs `2026-05-28T014800.log` / `2026-05-28T014801.log` contain no `Failed to initialize OpenTUI`, `Failed to open library`, `libopentui`, or watcher `$.subscribe` errors. The remaining smoke-log errors are expected local MCP config failures from running in `/home/jeremy/tymemud/tmp/opencode-tui-smoke`.

Limitations / risks:
- This fix addresses OpenTUI native library embedding for compiled binaries. It intentionally does not alter `@parcel/watcher` native loading because the first attempt changed runtime behavior and the watcher issue was nonfatal.

Review:
- Goal/code Oracle: PASS. The generated static file import directly addresses the compiled OpenTUI native asset packaging failure without watcher overreach.
- QA review: PASS. Real compiled TUI startup validation proves the native load error is gone.
- Security Oracle: PASS, severity none. Embedding already-installed OpenTUI native dependency artifacts adds no runtime network, auth, or file-write behavior.
