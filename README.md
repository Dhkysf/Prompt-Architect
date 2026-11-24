# Prompt Architect

A static, zero-build web app that turns a rough prompt idea into a structured Master Prompt using either Gemini or OpenRouter. It works directly from your disk (`file://`) with no Node.js, npm, or local server required:

- **`claude_master_prompt_architect.html`** — 6-part Claude prompt anatomy (`Role`, `Task`, `Context`, `Reasoning`, `Stop Conditions`, `Output`), compiled as Clean Text or XML Tags.
- **`gemini_master_prompt_architect.html`** — 3-zone / 6-part Gemini prompt anatomy (`Role`, `Constraints`, `Output Format`, `Context`, `Task`, `Final Instruction`), compiled as XML Tags or Markdown.

## Quick start (Windows)

1. Download or clone this repository.
2. Open PowerShell in the project folder and copy `config.example.js` to `config.js`:

   ```powershell
   Copy-Item config.example.js config.js
   ```

   Expected result: a new `config.js` file appears next to `config.example.js` (it is listed in `.gitignore` so git will not track it).

3. Open `config.js` in a text editor and paste your API key (for example, `geminiApiKey: "AIza...your-key..."`), then save.
4. Double-click `claude_master_prompt_architect.html` or `gemini_master_prompt_architect.html` to open it in your browser.

## Getting an API key

- **Google AI Studio (Gemini)**: A free tier is available for `gemini-3-flash-preview` with rate limits. Note that on the free tier, prompts may be used by Google to improve its products.
- **OpenRouter**: Set `provider: "openrouter"` in `config.js` (or select OpenRouter in **API settings**), add your `openrouterApiKey`, and set `openrouterModel` to a model that supports structured JSON outputs.

## Alternative: API settings panel

You can skip `config.js` and enter your key directly in the collapsible **API settings** panel at the top of either page:

- Choose **Gemini** or **OpenRouter**, paste your API key, and set the model name.
- Check **Remember on this browser** to save settings in `localStorage` (when unchecked, the key stays in memory only for the current tab).
- Click **Forget key** to clear any saved key from `localStorage`.
- Priority order: **UI input > `localStorage` > `config.js`**.

## Security

- `config.js` is listed in `.gitignore` so your local key is not committed.
- Any key placed in browser-side JavaScript is visible to anyone who can open that page—never deploy a page with your key baked in.
- If you host this on GitHub Pages, each visitor must enter their own key in the **API settings** panel.
- If you ever commit a key by mistake, revoke/rotate it immediately in your provider dashboard (deleting the commit is not enough).

## Project layout

```text
/
├─ claude_master_prompt_architect.html
├─ gemini_master_prompt_architect.html
├─ js/
│  ├─ common.js
│  ├─ claude.js
│  └─ gemini.js
├─ config.example.js
├─ .gitignore
└─ README.md
```
