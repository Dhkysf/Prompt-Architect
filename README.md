# Prompt Architect

A static, zero-build web app that turns a rough prompt idea into a structured Master Prompt using Gemini, OpenRouter, or any OpenAI-compatible gateway (such as 9router). It works directly from your disk (`file://`) with no Node.js, npm, or local server required:

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

- Choose **Gemini**, **OpenRouter**, or **OpenAI-compatible (custom)**, paste your API key (optional for local gateways), and set the model name.
- Check **Remember on this browser** to save settings in `localStorage` (when unchecked, the key stays in memory only for the current tab).
- Click **Forget key** to clear any saved key from `localStorage`.
- Priority order: **UI input > `localStorage` > `config.js`**.

## Using 9router (local)

1. Start 9router on your PC.
2. Open its dashboard (`http://localhost:20128/dashboard`) and copy the API key (if configured) and a model name.
3. In **API settings**, choose **OpenAI-compatible (custom)**, keep the default Base URL (`http://localhost:20128/v1`), and enter your key and model name.

Note: This works when the HTML file is opened from your own PC. A hosted page (such as GitHub Pages) may trigger the browser's local-network permission prompt, and other devices (such as a phone) cannot reach `localhost`.

## Troubleshooting

- **"Rate limited"**: You hit the provider's request or daily quota limit—wait the suggested seconds (or until the next day on a free tier) before clicking Architect again.
- **"did not return JSON"**: The server returned a web page or error page instead of API JSON—check **Base URL** in **API settings** (OpenAI-compatible gateways usually end with `/v1`).

## Security

- `config.js` is listed in `.gitignore` so your local key is not committed.
- Third-party scripts (Tailwind CSS and Lucide) are vendored and pinned in `vendor/`, so no external server can change code running alongside your API keys, and the pages work offline (except for Google Fonts, which fall back to system fonts).
- Any key placed in browser-side JavaScript is visible to anyone who can open that page—never deploy a page with your key baked in.
- If you host this on GitHub Pages, each visitor must enter their own key in the **API settings** panel.
- **GitHub Pages caveat:** all project sites under `<user>.github.io` share one browser origin, so an API key saved with **Remember on this browser** (`localStorage`, stored in plain text) can be read by any other page published on that same domain. Only tick **Remember on this browser** on your own PC, or click **Forget key** after use.
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
├─ vendor/
│  ├─ tailwindcss-play-3.4.17.js
│  ├─ lucide-1.79.0.min.js
│  └─ README.md
├─ config.example.js
├─ .gitattributes
├─ .gitignore
└─ README.md
```
