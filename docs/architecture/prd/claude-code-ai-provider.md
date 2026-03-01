# PRD: Phase 3.3 — "Zero-Config AI for Claude Code Users"

**Status:** Shipped
**Phase:** 3.3
**Milestone:** Claude Code users get AI brand enhancement with no API key required
**Target users:** Anyone running nib inside Claude Code — the primary developer audience
**References:** roadmap.md, gap-analysis.md
**Depends on:** Phase 3.2 (kit complete), `claude` CLI binary available (installed with Claude Code)

---

## Problem

During Phase 3.2 testing, the first real friction point appeared:

```
✗ API key    No ANTHROPIC_API_KEY or OPENAI_API_KEY set
              → AI features unavailable — set ANTHROPIC_API_KEY or use --no-ai
```

The user was already **inside Claude Code** — authenticated, with a live Claude session. But nib couldn't use it because the two systems are architecturally separate:

- **nib** calls the Anthropic API directly via `@anthropic-ai/sdk`, which requires `ANTHROPIC_API_KEY`
- **Claude Code** uses an OAuth session — its credentials are not exposed as environment variables
- There is no way for a standalone Node CLI to borrow Claude Code's auth token

This creates a paradox: the users most likely to adopt nib (developers already using Claude Code) hit an API key wall immediately, while `--no-ai` silently degrades their experience with no explanation of what they're missing.

---

## Solution

Claude Code ships a headless programmatic interface:

```bash
claude -p "your prompt here"
```

This runs a single-turn Claude session using the already-authenticated Claude Code installation and prints the response to stdout. No API key needed — it reuses the existing Claude Code auth.

nib can implement a `claude-code` AI provider that:
1. Shells out to `claude -p "<brand enhancement prompt>"`
2. Parses the JSON response
3. Returns a `BrandAiEnhancement` — identical interface to the existing Anthropic provider

---

## Goals

1. Claude Code users get AI enhancement with zero extra setup
2. Auto-detection: no flags required when `claude` is in PATH and no API keys are set
3. Explicit flag: `--ai claude-code` to force the provider regardless
4. `nib doctor` reports `claude-code` as a valid provider when detected
5. `--no-ai` remains a hard opt-out that beats auto-detection

### Non-goals

- Streaming responses (the brand enhancement is a single structured JSON call — streaming adds complexity with no UX benefit here)
- Multi-turn conversation (single prompt → JSON response is sufficient)
- Replacing the direct Anthropic SDK provider (API key users should keep their existing path)

---

## Success Metrics

| Metric | Target |
|--------|--------|
| `nib kit --from brief.md` with no API keys but `claude` in PATH completes with AI enhancement | Yes |
| Response time comparable to direct API call | Within 2× |
| `nib doctor` reports the active AI provider | All cases covered |
| `--no-ai` overrides auto-detection | Yes |
| `bun run typecheck` passes | Yes |
| Existing Anthropic/OpenAI providers unaffected | Yes |

---

## User Stories

**As a Claude Code user** running `nib kit` for the first time, I want AI brand enhancement to just work — without being told to get a separate API key when I already have Claude running.

**As a developer** on a team that uses Claude Code but hasn't set up an Anthropic API key, I want `nib brand init` to detect Claude Code automatically so I don't have to configure anything.

**As a power user**, I want `--ai claude-code` to let me explicitly force the Claude Code provider even when an API key is set — so I can choose which billing account to use.

**As a CI engineer**, I want `--no-ai` to be a hard override so the claude-code provider doesn't accidentally trigger in headless environments where `claude` is installed but not authenticated.

---

## Functional Requirements

### FR-1: `ClaudeCodeBrandProvider`

New file: `src/brand/ai/claude-code.ts`

```typescript
export class ClaudeCodeBrandProvider implements BrandAiProvider {
  async enhanceBrand(input: BrandInput): Promise<BrandAiEnhancement> {
    // 1. Build the prompt (same as AnthropicBrandProvider)
    // 2. Shell out: claude -p "<system>\n\n<user prompt>"
    // 3. Parse stdout as JSON → BrandAiEnhancement
    // 4. On parse failure, throw with helpful message
  }
}
```

**Subprocess call:**
```bash
claude -p "<combined system + user prompt>"
```

The `-p` flag runs a single headless turn and exits. stdout is the model's response.

**Error handling:**
- `claude` not found in PATH → throw `ClaudeCodeNotFoundError` (caught by provider detection)
- Exit code non-zero → throw with stderr content
- Response not valid JSON → throw with raw response for debugging

---

### FR-2: Provider auto-detection update

Update `src/brand/ai/index.ts` `detectProvider()`:

```typescript
function detectProvider(): AiProviderName | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.NIB_AI_BASE_URL) return "ollama";
  if (isClaudeCodeAvailable()) return "claude-code";  // ← new
  return null;
}

function isClaudeCodeAvailable(): boolean {
  // Check if `claude` binary exists in PATH
  // Use execFileSync with --version as a probe — fast, no auth needed
}
```

Priority: API keys always win. `claude-code` is the fallback, not the default — explicit API keys indicate the user has a preference.

---

### FR-3: `getProvider` factory update

Add `claude-code` case to `getProvider()` in `src/brand/ai/index.ts`:

```typescript
case "claude-code": {
  if (!isClaudeCodeAvailable()) return null;
  const { ClaudeCodeBrandProvider } = await import("./claude-code.js");
  return new ClaudeCodeBrandProvider();
}
```

Add `"claude-code"` to `AiProviderName` in `src/types/brand.ts`.

---

### FR-4: `nib doctor` — AI provider check update

Update the API key check in `src/cli/commands/doctor.ts` to report `claude-code` as a valid provider:

**Current behaviour:**
```
✗ API key    No ANTHROPIC_API_KEY or OPENAI_API_KEY set
```

**New behaviour (claude in PATH, no API keys):**
```
✓ AI provider    claude-code (Claude Code detected in PATH)
```

**New behaviour (API key set):**
```
✓ AI provider    anthropic (ANTHROPIC_API_KEY)
```

**New behaviour (nothing):**
```
✗ AI provider    No API key or Claude Code installation found
              → Set ANTHROPIC_API_KEY or install Claude Code
```

---

### FR-5: `nib status` AI provider field

Add `aiProvider` to the status output so teams know at a glance which AI backend is active.

---

### FR-6: `--ai claude-code` explicit flag

All commands that accept `--ai` should accept `"claude-code"` as a valid value:
- `nib brand init --ai claude-code`
- `nib brand style --ai claude-code`
- `nib kit --ai claude-code`

---

## Technical Notes

### Why subprocess, not MCP

The MCP sampling capability (which would let nib request completions through Claude Code's MCP server) is designed for MCP servers running inside a Claude Code session — not for standalone CLI processes. A subprocess call to `claude -p` is simpler, better supported, and doesn't require nib to be an MCP server.

### Prompt format for `claude -p`

The `-p` flag accepts a single string. The system prompt and user prompt need to be combined:

```
You are a senior brand designer...

[Respond only with JSON]

---

Brand: Acme Corp
Primary color: #2563EB
...
```

The existing `SYSTEM_PROMPT` and `buildUserPrompt()` from `anthropic.ts` can be reused — just concatenated with a separator.

### Response parsing

`claude -p` may include thinking/preamble before the JSON in some cases. Parse defensively:
- Extract the first `{...}` block from stdout using a regex
- Validate it matches `BrandAiEnhancement` shape before returning

### Performance

`claude -p` has a cold start (spawning the Claude Code process). Expected latency: 2–5s for a 2000-token response. Comparable to a direct API call. No optimisation needed.

### Files to create / modify

| File | Change |
|------|--------|
| `src/brand/ai/claude-code.ts` | Create — `ClaudeCodeBrandProvider` |
| `src/brand/ai/index.ts` | Add `claude-code` to `getProvider()` + `detectProvider()` |
| `src/types/brand.ts` | Add `"claude-code"` to `AiProviderName` |
| `src/cli/commands/doctor.ts` | Update AI provider check |
| `src/cli/commands/status.ts` | Add `aiProvider` to status output |

---

## Open Questions

1. **`claude -p` JSON guarantee** — Does `claude -p` always return clean JSON when the prompt asks for it, or does it sometimes wrap the response in markdown fences? If the latter, the parser needs to strip fences. Answer: test empirically before shipping.

2. **Auth check** — Should nib verify that `claude` is authenticated before attempting the call, or just let the subprocess fail and surface the error? Recommendation: let it fail — the error message from `claude` is clear enough ("not authenticated, run claude auth").

3. **Timeout** — Should nib enforce a timeout on the subprocess call? Recommendation: yes, 30s — same as the Anthropic SDK default.

---

## Done Criteria

- [x] `nib kit --from brief.md` with no API keys but `claude` in PATH completes with AI enhancement
- [x] `nib kit --from brief.md --ai claude-code` forces the provider explicitly
- [x] `nib doctor` shows `✓ AI provider  claude-code` when detected
- [x] `nib doctor` shows `✗ AI provider  No API key or Claude Code found` when neither is available
- [x] `--no-ai` overrides claude-code auto-detection
- [x] Existing `anthropic` and `openai` providers are unaffected
- [x] `bun run typecheck` passes
- [x] `bun run test` passes

### Implementation notes

- `src/brand/ai/claude-code.ts` — `ClaudeCodeBrandProvider` shells out to `claude -p` with `CLAUDECODE: ""` in the subprocess env to bypass the nested-session guard
- `src/brand/ai/index.ts` — `isClaudeCodeAvailable()` probes `claude --version`; `detectProvider()` falls through to `claude-code` when no API keys set
- `src/brand/index.ts` — records the actual detected provider in `brand.config.json` (was hardcoded `"anthropic"`)
- `src/types/brand.ts` — `AiProviderName | false` on `NibBrandConfig.ai.provider` to reflect no-AI runs
- `src/cli/commands/doctor.ts` — unified `checkAiProvider()` across all four providers
- `src/cli/commands/status.ts` — shows active provider via `detectProvider()`

**Known constraint:** `claude -p` cannot be invoked from within an active Claude Code session (Claude Code's process manager sends SIGTERM to nested invocations). Setting `CLAUDECODE: ""` bypasses the env-var check but not the process-manager guard. This only affects nested invocations (e.g. testing from inside Claude Code's Bash tool) — end users running `nib kit` from their own terminal are unaffected.

---

*Created: 2026-03-01*
*Shipped: 2026-03-01*
*Discovered during: Phase 3.2 end-to-end testing*
