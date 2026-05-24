# OpenCode Tool Output Context Cap Plan

## Goal

Prevent oversized stored tool outputs from entering later model context and causing context-window overflow.

Follow-up scope for the upstream-clean branch: also address the separate `MaxListenersExceededWarning` crash shown in `/home/jeremy/Pictures/OpenCode_crash_2026-05-24_08-52.png` when another OpenCode session was active.

## Evidence

- Session `ses_37ecd19bfffeirwKXGjPFl6J4i` repeatedly overflowed `openai/gpt-5.5` context.
- `/home/jeremy/.local/share/opencode/log/2026-05-22T185628.log` records `context_length_exceeded` around lines 3812 and 4374.
- The same log records compaction tail fallback around line 4395 with `budget=8000 size=34314 total=0 tail fallback`.
- The preceding shell tool saved a 1.12 GB full output at `/home/jeremy/.local/share/opencode/tool-output/tool_e510d52ca001HsMQQFsmLWffP4`.
- `packages/opencode/src/session/message-v2.ts` serialized completed tool output with `truncateToolOutput(part.state.output, options?.toolOutputMaxChars)`, so normal prompt assembly with no option preserved the full stored output.
- `packages/opencode/src/session/compaction.ts` already uses a `2_000` character cap for compaction prompts.
- Latest upstream `origin/dev` at `0cf99cf5f` still had `truncateToolOutput(text, maxChars?: number)` and no default cap.
- Screenshot `/home/jeremy/Pictures/OpenCode_crash_2026-05-24_08-52.png` shows `MaxListenersExceededWarning: Possible EventTarget memory leak detected. 11 event listeners added to [iz]` followed by `Trace/breakpoint trap`, not a context overflow.
- Upstream issue `#28492` reports the same warning/stack, and issue `#23798` plus PR `#23796` identify `GlobalBus` fanout over Node's default 10-listener threshold as a false leak warning during overlapping SSE/session consumers.

## Plan

1. Move the existing `2_000` tool-output cap into `MessageV2` as the shared default for model-message serialization.
2. Make completed tool output truncation use that default when no caller option is provided.
3. Keep compacted tool output placeholder behavior unchanged.
4. Reuse the shared cap in compaction code instead of keeping a private duplicate.
5. Add a focused `message-v2.test.ts` regression proving default serialization truncates long completed tool output.
6. Raise `GlobalBus`'s listener threshold to the upstream PR's documented `100` and add a focused bus regression test.
7. Validate from `packages/opencode` with focused session and bus tests, typecheck, and build if feasible.

## Scope Boundaries

- In scope: `message-v2.ts`, `compaction.ts`, `message-v2.test.ts`, `bus/global.ts`, `test/bus/global.test.ts`, this plan, and the implementation ledger.
- Out of scope: generated SDKs, broader compaction policy rewrites, provider APIs, TUI reconnect changes, server restarts, process killing.

## Validation

- `bun test test/session/message-v2.test.ts`
- `bun test test/session/compaction.test.ts`
- `bun typecheck`
- `GIT_MASTER=1 git diff --check`
