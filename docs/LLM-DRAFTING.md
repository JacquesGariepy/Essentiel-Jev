# Assisted drafting with an LLM — API, local model, Claude Code, Codex or agy

English · French version: [LLM-DRAFTING.fr.md](LLM-DRAFTING.fr.md)

Essentiel separates **judging** from **writing**:

- **TypeSafe Jev judges.** It returns typed Choice / Score / Noul answers with probabilities and confidence, which local code validates. It is the only typed judge in the application.
- **An optional LLM writes.** It proposes an editable reply draft or a short summary of one message. It does not judge, approve, send or create anything.
- **You decide.** A draft goes into the normal composer. Saving it as a real mailbox draft still requires the exact preview and your explicit approval, followed by a read-back.

Drafting is off by default. Jev judgments and connected tools work without it. Every drafting call, like every Jev call, appears in the **AI log** with its exact prompts, arguments and raw output (see [below](#the-ai-log)).

## Choose an engine

Configure engines in the server `.env` file, then restart `npm start`. The browser never supplies a URL, key or command.

**Several engines at once.** `DRAFT_ENGINES=auto` offers every engine actually available: the Claude Code, Codex and agy executables found on `PATH` (resolved without a shell; `.cmd`/`.bat` wrappers are ignored) plus `openai` when `LLM_BASE_URL` and `LLM_MODEL` are set. `DRAFT_ENGINES=claude,codex,agy,openai` lists them explicitly, in order. The first configured engine is the default; the consent dialog lets you pick another for each draft, and each draft is labeled with the engine that wrote it. A single `DRAFT_ENGINE=…` keeps working.

| Engine | Id | Settings | Where the text goes |
|---|---|---|---|
| OpenAI-compatible API (OpenAI, OpenRouter, Mistral, Groq…) | `openai` | `LLM_BASE_URL` (https), `LLM_API_KEY`, `LLM_MODEL` | The configured provider |
| Local LLM (Ollama, LM Studio, llama.cpp, vLLM) | `openai` | `LLM_BASE_URL` on `127.0.0.1` / `localhost` / `[::1]`, `LLM_MODEL`, and usually no key | Stays on this computer |
| Claude Code CLI | `claude` | Optional: `CLAUDE_COMMAND`, `CLAUDE_MODEL`, `CLAUDE_MAX_BUDGET_USD` | Anthropic, through your Claude Code sign-in |
| Codex CLI | `codex` | Optional: `CODEX_COMMAND`, `CODEX_MODEL` | OpenAI, through your Codex sign-in |
| agy (Antigravity) CLI | `agy` | Optional: `AGY_COMMAND`, `AGY_MODEL` | Google, through your agy sign-in |

### OpenAI-compatible API or local LLM

The endpoint must implement `POST {LLM_BASE_URL}/chat/completions` and accept `response_format: {type: "json_schema"}` (structured output). Check your server's documentation. When the server ignores the schema, the reply is still validated locally and refused if it is not the expected JSON.

```ini
# Ollama (after: ollama pull llama3.2)
DRAFT_ENGINE=openai
LLM_BASE_URL=http://127.0.0.1:11434/v1
LLM_MODEL=llama3.2

# LM Studio: start its local server first
# LLM_BASE_URL=http://127.0.0.1:1234/v1
# llama.cpp llama-server: http://127.0.0.1:8080/v1
# vLLM (vllm serve): http://127.0.0.1:8000/v1

# Hosted API examples (use the provider's own key)
# LLM_BASE_URL=https://api.openai.com/v1
# LLM_BASE_URL=https://openrouter.ai/api/v1
# LLM_BASE_URL=https://api.mistral.ai/v1
# LLM_BASE_URL=https://api.groq.com/openai/v1
# LLM_API_KEY=...
```

Plain `http` is accepted only for loopback addresses. URLs containing credentials, a query or a fragment are refused. With no `LLM_API_KEY`, no `Authorization` header is sent. Redirects are refused.

### Claude Code

Install Claude Code and sign in once in a terminal (`claude`). Then:

```ini
DRAFT_ENGINE=claude
# CLAUDE_COMMAND=C:\Users\you\.local\bin\claude.exe   # default: claude.exe (Windows) / claude
# CLAUDE_MODEL=sonnet                                  # default: Claude Code's default model
# CLAUDE_MAX_BUDGET_USD=0.50                           # optional per-request cap (API-key billing)
```

Essentiel runs it as follows. The flags were checked against `claude --help` for Claude Code 2.1.278:

```text
claude -p --output-format json --json-schema <draft schema> --tools "" --restricted --safe-mode
       --strict-mcp-config --no-session-persistence --disable-slash-commands
       --permission-mode dontAsk --system-prompt <fixed drafting rules> [--model …] [--max-budget-usd …]
```

- `--tools ""` removes every built-in tool.
- `--restricted` ignores user, project and local settings files (and their hooks).
- `--safe-mode` disables customizations: your `CLAUDE.md` files, memory, skills, plugins, hooks, custom agents and output styles.
- `--strict-mcp-config` without `--mcp-config` loads no MCP server.
- The message text is sent on **stdin**, never as a command-line argument.
- Existing sign-in is reused through `CLAUDE_CONFIG_DIR` (when set) or the default location, and `ANTHROPIC_API_KEY` is passed if it is set.

### Codex

Install Codex and sign in once (`codex login`). Then:

```ini
DRAFT_ENGINE=codex
# CODEX_COMMAND=C:\path\to\codex.exe   # default: codex.exe (Windows) / codex
# CODEX_MODEL=gpt-5                   # default: Codex's default model
```

The flags were checked against `codex exec --help` and `codex features list` for codex-cli 0.154.0:

```text
codex exec --sandbox read-only --ephemeral --skip-git-repo-check --ignore-user-config --ignore-rules
      --disable shell_tool --disable multi_agent --disable plugins --disable hooks --disable apps
      --disable browser_use --disable computer_use --disable in_app_browser --disable image_generation
      --disable view_image -c web_search="disabled" --output-schema <tmp>/schema.json
      -o <tmp>/last-message.json -C <tmp> --json --color never [-m …] -
```

`--ignore-user-config` means your `config.toml` (default model, MCP servers, profiles) is not loaded. Authentication still uses `CODEX_HOME`. Set `CODEX_MODEL` when you need a specific model. `--dangerously-bypass-approvals-and-sandbox` is never used.

### agy (Antigravity)

Install agy and sign in once. Then add `agy` to `DRAFT_ENGINES` (or `DRAFT_ENGINE=agy`):

```ini
DRAFT_ENGINES=auto
# AGY_COMMAND=C:\Users\you\AppData\Local\agy\bin\agy.exe   # default: agy.exe (Windows) / agy, found on PATH
# AGY_MODEL=                                                  # default: agy's default model
```

The flags are the ones ORIGIN verified against agy 1.2.7:

```text
agy --input-format stream-json --output-format stream-json --json-schema <draft schema>
    --print-timeout 2m --sandbox [--model …]
```

The drafting rules and the message are sent as one stdin line, `{"event":"user","message":{"content":…}}`. The draft is read from the final `result` event (`status: "SUCCESS"`, `structured_output`). agy 1.2.7 delivers the schema output through its built-in terminal `finish` tool: exactly that step (tool name and tool info `finish`, no subagent) is accepted, and **any other tool or subagent event refuses the draft and stops the process**. `--dangerously-skip-permissions` is never used. Only `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GEMINI_API_KEY` and `GOOGLE_API_KEY` are added to the allowlisted environment.

## What is sent, exactly

After you click **Suggest a reply** or **Summarize** in a message, a preview shows the text that will be sent. You can remove anything from it. Nothing leaves the server until you tick the consent box. The request contains only:

1. the fixed drafting rules (the source is untrusted data, do not invent facts, return `{draft, notes}`);
2. the task line (reply or summary, French or English);
3. your optional instruction (at most 500 characters);
4. the edited excerpt (at most 8,000 characters), placed between `<<<SOURCE` and `SOURCE>>>`.

Essentiel adds no other message, attachment, calendar, task, OAuth token or Jev result.

**What the CLIs add on their own.** These are part of the CLI, not of Essentiel, and cannot be switched off while you use your subscription sign-in (Claude Code's `--bare` mode removes them but requires `ANTHROPIC_API_KEY`). They go only to the provider you are signed in to. Observed on this machine on 2026-09-19:

- **Claude Code** (even with `--safe-mode`): the signed-in account's **email address**, the operating system, the date, and the temporary working directory path, which contains your Windows user name.
- **Codex**: the temporary working directory path, the shell, the date and the time zone. No account or email address.

- **agy** (asked directly, 2026-09-19, agy 1.2.7): the operating system, the shell, the paths of its application-data and workspace folders (which contain your Windows user name), the local time with its time-zone offset, the model name, and a catalogue of about 57 tools (files, commands, subagents). ORIGIN and Essentiel accept no tool use from it except the terminal `finish` step.

Because a model could infer your name from that context, the drafting rules forbid adding a name or signature that is not in your instruction; the draft uses `[signature]` instead.

## What comes back

The engine must return `{"draft": string, "notes": string[]}`. The draft is limited to 6,000 characters. There are at most 5 notes, each at most 300 characters. Extra fields, a tool call or malformed JSON are refused, and nothing is substituted. The draft appears in the editable composer, labeled "Draft written by <engine>". The notes list points you should check. A summary is displayed beside the message and is never stored in a provider.

## Security model

- **Guards:** `POST /api/draft` has the same guards as the Jev routes: exact local Origin, `X-Essentiel-Request`, JSON, explicit `consent: true`. It shares the limits of 2 concurrent requests and 60 per minute.
- **No secrets to the browser:** configuration is read only from the server environment. `/api/config` exposes, for each offered engine, its id, model label, a loopback flag and whether it is configured, plus the default. It never exposes a key, URL or command path. `/api/draft` accepts only an engine that the server offers.
- **HTTP responses:** capped at 2 MB. Requests time out after 110 s, and the browser waits up to 125 s. Provider bodies and CLI stderr are never shown; errors use fixed messages and codes such as `DRAFT_PROVIDER_ERROR`, `DRAFT_INVALID` and `DRAFT_TOOL_USE`.
- **CLI children:**
  - They run with `shell: false` in a fresh, empty temporary directory that is removed afterwards.
  - The prompt goes on stdin.
  - The environment is allowlisted: system paths, profile, temp, locale, proxy variables, plus `CLAUDE_CONFIG_DIR` / `ANTHROPIC_API_KEY` for Claude Code, `CODEX_HOME` / `OPENAI_API_KEY` for Codex, or the Google/Gemini variables above for agy. `TYPESAFE_API_KEY`, OAuth secrets and `LLM_API_KEY` are not passed.
  - Output is capped, and a timeout kills the process.
  - A reported tool attempt refuses the draft: Claude Code permission denials, sub-agents or web requests, any Codex item other than a message or reasoning, or any agy tool/subagent step other than the terminal `finish`.
- **Honest boundary:** observing a reported tool event is not the same as preventing its first side effect. Claude Code receives no tools at all. For Codex, the shell tool is disabled and the sandbox is read-only. agy declares its tools to the model and runs with `--sandbox`; the draft is refused and the process stopped at the first reported tool step. Run the server under your own account on a machine you trust.

## The AI log

**AI log** in the connected tools lists every drafting call and every Jev call, newest first, live. For a draft it shows the engine, the exact system prompt and message, the HTTP request body or the CLI command name, arguments and stdin, CLI events, stdout/stderr, the raw output, the validated draft and notes, the rejection reason, latency, tokens and any cost the CLI reports, plus what that CLI adds on its own (above). The raw engine output that normal API errors never reflect is visible here, locally. The journal is held in server memory only (last 300 calls), never written to disk, cleared on vault lock or erase, on disconnect of the account the message came from, on **Clear journal**, and on restart. Keys and tokens are redacted before storage; absolute temporary paths are replaced by `<temp dir>`.

## Limits

- A draft can be wrong, incomplete, badly toned or confidently invent details. Read it before saving it. Placeholders such as `[to confirm]` mark missing information.
- Only one message is used, never the whole thread. Conversation threading of the saved draft is still not guaranteed for Outlook.
- The tests in this build use synthetic HTTP responses and stand-in child processes. The CLI flags were checked on this machine with trivial, non-personal prompts (Claude Code 2.1.278, codex-cli 0.154.0, agy 1.2.7). The OpenAI-compatible adapter was **not** run against a real server. No real message has been drafted in testing.
- Engine charges and terms are those of your provider or subscription. Essentiel adds none and measures none.
