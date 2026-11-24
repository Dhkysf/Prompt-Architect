# AGENTS.md

Rules for AI coding agents working in this repository. Read this file fully before every task. If this file and the code disagree, the code wins. Fix this file in the same change.

## 1. Project

**Prompt Architect** is a small static web app with no build step. You type a short idea, an AI model expands it into a structured "master prompt", and you can edit each part and copy the compiled result.

There are two pages with the same engine and a different prompt anatomy:

- `claude_master_prompt_architect.html`: Claude anatomy with 6 parts: Role, Task, Context, Reasoning, Stop Conditions, Output. Output format: Clean or XML.
- `gemini_master_prompt_architect.html`: Gemini anatomy: Role, Constraints, Output, Context, Task, Final. Output format: Markdown or XML.

Providers: Gemini API (default model `gemini-3-flash-preview`) and OpenRouter. You can set the key and model in `config.js` or in the "API settings" panel on the page.

Owner: a beginner on Windows who uses the app personally. The repo is **public** on GitHub.

### Layout

```
/
├─ claude_master_prompt_architect.html   markup + inline Tailwind config + <script src> tags
├─ gemini_master_prompt_architect.html   markup + inline Tailwind config + <script src> tags
├─ js/
│  ├─ common.js    shared: config/key loading, API settings panel, provider calls,
│  │               retry, JSON parsing, copy, status banner. Exposes window.PA
│  ├─ claude.js    Claude page: fields, example, compile, system prompt
│  └─ gemini.js    Gemini page: fields, example, compile, system prompt
├─ tests/
│  └─ parse_test.js  Node unit test for shared response parsing & validation
├─ config.example.js   committed template (placeholders only)
├─ config.js           git-ignored, holds the owner's real key. Never read it, print it or commit it
├─ .gitignore
├─ README.md
└─ AGENTS.md
```

Script load order in both HTML files: `config.js` → `js/common.js` → page script. Keep it.

## 2. Hard technical constraints

The app must work when the owner double-clicks the HTML file (`file://`):

- Use classic `<script src="...">` tags only. **No** `type="module"`, `import` or `export`. ES modules are blocked on `file://`.
- **No** `fetch()` of local files and no `.json` config, for the same reason. Config stays a `.js` file that sets `window.PA_CONFIG`.
- No build step, no npm, no bundler, no framework, no new CDN dependency unless the owner asks.
- A missing `config.js` must never crash the page (fresh clones and GitHub Pages do not have it). `common.js` falls back to defaults.
- Shared logic goes in `js/common.js` under `window.PA`. Page-specific logic goes in the page script. If you change shared UI (for example the API settings panel), update **both** pages so they stay in sync.
- Keep the UI language English. Keep each page's colors and layout.
- CDN versions are pinned (for example `lucide@1.79.0`). Do not switch back to `@latest`.

## 3. Secrets (public repo)

- Never ask the owner for an API key. Never print, log or echo one. Never put one in the URL, DOM text, error messages, commit messages or test files.
- Gemini sends the key in the `x-goog-api-key` header. OpenRouter uses `Authorization: Bearer`. Never use `?key=` in a URL.
- Never open, edit or `git add` `config.js`. Never use `git add -f`.
- Committed files contain placeholders only (for example `AIza...your-key...`). No local paths (`C:\`, `E:\`), emails or personal data.
- If you find a real key in tracked files or in git history: **stop**, do not commit or push, and tell the owner to revoke the key in Google AI Studio / OpenRouter. Deleting the commit is not enough.

## 4. Ponytail

The owner starts prompts with `/ponytail` (skill from `DietrichGebert/ponytail`). Apply its rules to **every** coding task in this repo, even if the prompt does not start with `/ponytail`:

- Before writing, check in this order: does it need to exist → already in this codebase (`window.PA`, existing helpers) → browser/platform feature → minimum code that works.
- Shortest *complete* diff: finish every caller and both pages. No speculative options, wrappers or "for later" code.
- Never cut validation, error handling, security (section 3) or accessibility.
- End your reply with 1–2 lines: what you skipped or did not check, and any risk the owner must know.
- If the `/ponytail-review` skill is installed, run it on your diff before committing non-trivial changes.

## 5. Codegraph

If codegraph tools (`codegraph_*` MCP tools) are available:

- Use them first to find symbols, callers and impact (for example everything that calls `PA.generateStructuredPrompt` or `getActiveSettings`) before reading whole files or grepping.
- Before renaming or changing a function in `js/common.js`, query its callers. Both page scripts depend on it.
- Re-index after you add, move or rename files.
- If codegraph creates an index folder inside the repo, make sure it is in `.gitignore`. Never commit it.

If codegraph is not available, fall back to reading the files. This repo is small (2 HTML files + 3 JS files). Do not invent codegraph output.

## 6. Verification (before every commit)

Run these and report the results in your reply:

1. `node --check js/common.js js/claude.js js/gemini.js`. If Node is not installed, skip it and say so.
2. `node tests/parse_test.js` (all cases must pass).
3. Secret scan on tracked files and staged changes. Both must print nothing:
   ```powershell
   git grep -nE "AIza[0-9A-Za-z_-]{35}|sk-or-v1-[0-9a-f]{20,}"
   git diff --cached | Select-String -Pattern "AIza[0-9A-Za-z_-]{35}|sk-or-v1-[0-9a-f]{20,}"
   ```
3. `git check-ignore -v config.js` must show the `.gitignore` rule. `git ls-files` must not list `config.js`.
4. Every local `<script src>` in both HTML files points to an existing file (`config.js` is allowed to be missing).
5. If you have a browser tool: open both pages via `file://`. Check for no console errors, that the example loads, that editing a field updates the compiled prompt, that the format toggle and Copy work, and that clicking Architect with no key shows the "add your API key" banner instead of sending a request.

Do not create throwaway test scripts inside the repo. Use a temp folder or delete them before committing.

## 7. Git and commits

Commit automatically when a task is finished **and** section 6 passes. Do not ask first. Do not commit half-done or failing work.

- **One logical change per commit.** Split unrelated changes into separate commits.
- Stage files explicitly by path (`git add js/common.js README.md`). Avoid `git add .` / `-A` so stray files never slip in. Check `git status` and `git diff --cached` before committing.
- **Never** `git push`, `git push --force`, `git commit --amend` on pushed commits, `git rebase` on pushed history, or `git reset --hard`. The owner pushes manually.
- Do not change git config (user.name, user.email, remotes).
- Run each Git command as a separate command. Do not combine them with `;`, `&&`, `Write-Host`, or `$LASTEXITCODE` on a single line.
- To search for text in the repo, use `git grep --no-index --exclude-standard ...` (run it in the sandbox and make sure to respect the .gitignore file).

### Conventional Commits

Format: `<type>(<optional scope>): <summary>`

- Summary: English, imperative mood, lowercase start, no trailing period, max 72 characters.
- Optional body after a blank line: explain *why*, wrapped at 72 characters.
- Breaking change: add `!` after the type/scope and a `BREAKING CHANGE:` footer. Example: a renamed `PA_CONFIG` field that breaks existing `config.js` files.

Types:

- `feat`: new user-visible feature
- `fix`: bug fix
- `refactor`: code change with no behaviour change
- `style`: formatting or CSS/visual tweak with no logic change
- `docs`: README, AGENTS.md, comments only
- `chore`: .gitignore, config template, housekeeping
- `perf`: faster or lighter with the same behaviour
- `test`: tests or self-checks only
- `revert`: revert an earlier commit

Scopes (optional, use when the change is limited to one area): `claude`, `gemini`, `common`, `config`, `readme`, `agents`.

Examples:

```
feat(common): add OpenAI-compatible provider for local gateways
fix(gemini): keep Markdown toggle state after loading the example
refactor(common): reuse OpenRouter request code for custom base URL
chore(config): add customModel to config.example.js
docs(readme): explain where to get a Gemini API key
docs(agents): document codegraph usage
```

## 8. Docs

- Every new config field goes in `config.example.js` (placeholder/default), in `README.md`, and gets a safe fallback in `common.js`. All in the same commit.
- Keep `README.md` beginner-friendly for Windows: one PowerShell block per step, with the expected result.
- Update the layout tree in this file when files are added, moved or removed.
- Do not add a LICENSE. The owner will choose one.

## 9. Talking to the owner

- Reply in **English**, simple and beginner-friendly. Explain technical terms briefly. Code, comments, commit messages, README and this file are English too.
- Report what changed, the verification results (section 6), the commit hash(es), and the Ponytail "skipped / risks" lines.
- If a request conflicts with this file (for example "just commit config.js"), explain the risk and ask before doing it.
