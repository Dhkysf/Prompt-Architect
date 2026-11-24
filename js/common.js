(function () {
    const DEFAULT_CONFIG = {
        provider: "gemini",
        geminiApiKey: "",
        geminiModel: "gemini-3-flash-preview",
        openrouterApiKey: "",
        openrouterModel: ""
    };

    function getConfig() {
        return Object.assign({}, DEFAULT_CONFIG, window.PA_CONFIG || {});
    }

    function initIcons() {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    function showStatus(message, type = 'info', themePrefix = 'claude') {
        const banner = document.getElementById('statusBanner');
        const msgEl = document.getElementById('statusMessage');
        const iconEl = document.getElementById('statusIcon');
        if (!banner || !msgEl || !iconEl) return;

        banner.classList.remove(
            'hidden',
            'bg-red-950/50', 'border-red-800/60', 'text-red-200',
            'bg-emerald-950/50', 'border-emerald-800/60', 'text-emerald-200',
            'bg-claude-surface', 'border-claude-border', 'text-claude-text',
            'bg-gemini-surface', 'border-gemini-border', 'text-gemini-text'
        );

        if (type === 'error') {
            banner.classList.add('bg-red-950/50', 'border-red-800/60', 'text-red-200');
            iconEl.setAttribute('data-lucide', 'alert-circle');
        } else if (type === 'success') {
            banner.classList.add('bg-emerald-950/50', 'border-emerald-800/60', 'text-emerald-200');
            iconEl.setAttribute('data-lucide', 'check-circle-2');
        } else {
            banner.classList.add(`bg-${themePrefix}-surface`, `border-${themePrefix}-border`, `text-${themePrefix}-text`);
            iconEl.setAttribute('data-lucide', 'info');
        }

        msgEl.textContent = message;
        initIcons();
    }

    function hideStatus() {
        const banner = document.getElementById('statusBanner');
        if (banner) banner.classList.add('hidden');
    }

    async function copyText(text, successMsg, themePrefix = 'claude') {
        let copied = false;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                copied = true;
            } catch (_) {
                // Fall back to textarea copy when clipboard API is blocked (e.g. file://)
            }
        }

        if (!copied) {
            const fallback = document.getElementById('clipboardFallback');
            if (fallback) {
                fallback.value = text;
                fallback.select();
                fallback.setSelectionRange(0, 99999);
                try {
                    copied = document.execCommand('copy');
                } catch (_) {
                    copied = false;
                }
            }
        }

        if (copied) {
            const copyBtnText = document.getElementById('copyBtnText');
            if (copyBtnText) {
                const originalText = copyBtnText.textContent;
                copyBtnText.textContent = "Copied!";
                setTimeout(() => {
                    copyBtnText.textContent = originalText;
                }, 2000);
            }
            showStatus(successMsg, "success", themePrefix);
        } else {
            showStatus("Unable to copy automatically. Please select the text and press Ctrl+C.", "error", themePrefix);
        }
    }

    async function fetchWithRetry(url, options, maxRetries = 3, baseDelay = 1000) {
        for (let i = 0; i <= maxRetries; i++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);
            try {
                const response = await fetch(url, Object.assign({}, options, { signal: controller.signal }));
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    const err = new Error(errorData.error?.message || errorData.message || `HTTP ${response.status}`);
                    err.retryable = (response.status === 429 || response.status >= 500);
                    throw err;
                }
                return await response.json();
            } catch (err) {
                if (err.name === 'AbortError') {
                    throw new Error("Request timed out after 60 seconds.");
                }
                if (err.retryable === false || i === maxRetries) {
                    throw err;
                }
                await new Promise(res => setTimeout(res, baseDelay * Math.pow(2, i)));
            } finally {
                clearTimeout(timeoutId);
            }
        }
    }

    async function callGemini({ apiKey, model, systemPrompt, userPrompt, fieldNames }) {
        const properties = {};
        fieldNames.forEach((name) => {
            properties[name] = { type: "STRING" };
        });

        const payload = {
            contents: [{
                parts: [{ text: userPrompt }]
            }],
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: properties,
                    required: fieldNames,
                    propertyOrdering: fieldNames
                }
            }
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
        const result = await fetchWithRetry(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify(payload)
        });

        const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) {
            throw new Error("Received an empty response from the AI model.");
        }
        return JSON.parse(rawText);
    }

    async function generateStructuredPrompt({ systemPrompt, userPrompt, fieldNames, themePrefix }) {
        const cfg = getConfig();
        const apiKey = (cfg.geminiApiKey || "").trim();
        if (!apiKey) {
            showStatus("Add your API key in API settings or config.js", "error", themePrefix);
            return null;
        }
        const model = (cfg.geminiModel || "").trim() || DEFAULT_CONFIG.geminiModel;
        return await callGemini({ apiKey, model, systemPrompt, userPrompt, fieldNames });
    }

    window.PA = {
        DEFAULT_CONFIG,
        getConfig,
        initIcons,
        showStatus,
        hideStatus,
        copyText,
        generateStructuredPrompt
    };
})();
