(function () {
    const STORAGE_KEY = "pa_api_settings_v1";
    const DEFAULT_CONFIG = {
        provider: "gemini",
        geminiApiKey: "",
        geminiModel: "gemini-3-flash-preview",
        openrouterApiKey: "",
        openrouterModel: ""
    };

    const uiState = {
        provider: null,
        geminiApiKey: "",
        geminiModel: "",
        openrouterApiKey: "",
        openrouterModel: ""
    };

    function getConfig() {
        return Object.assign({}, DEFAULT_CONFIG, window.PA_CONFIG || {});
    }

    function readSavedSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (_) {
            return {};
        }
    }

    function writeSavedSettings(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (_) {
            // Ignore storage errors in restricted environments
        }
    }

    function clearSavedSettings() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (_) {
            // Ignore storage errors
        }
    }

    function getActiveSettings() {
        const cfg = getConfig();
        const saved = readSavedSettings();
        const provider = uiState.provider || saved.provider || cfg.provider || "gemini";
        const isOpenRouter = provider === "openrouter";
        const keyField = isOpenRouter ? "openrouterApiKey" : "geminiApiKey";
        const modelField = isOpenRouter ? "openrouterModel" : "geminiModel";

        const apiKey = (uiState[keyField] || "").trim()
            || (saved[keyField] || "").trim()
            || (cfg[keyField] || "").trim();
        const model = (uiState[modelField] || "").trim()
            || (saved[modelField] || "").trim()
            || (cfg[modelField] || "").trim();

        return { provider, apiKey, model };
    }

    function initApiSettings(themePrefix = 'claude') {
        const providerEl = document.getElementById('pa-provider');
        const keyEl = document.getElementById('pa-api-key');
        const modelEl = document.getElementById('pa-model');
        const rememberEl = document.getElementById('pa-remember');
        const forgetBtn = document.getElementById('pa-forget-btn');
        const hintEl = document.getElementById('pa-settings-hint');
        if (!providerEl || !keyEl || !modelEl || !rememberEl || !forgetBtn) return;

        const cfg = getConfig();
        const saved = readSavedSettings();

        uiState.provider = saved.provider || cfg.provider || "gemini";
        uiState.geminiApiKey = saved.geminiApiKey || "";
        uiState.geminiModel = saved.geminiModel || "";
        uiState.openrouterApiKey = saved.openrouterApiKey || "";
        uiState.openrouterModel = saved.openrouterModel || "";

        rememberEl.checked = Boolean(saved.geminiApiKey || saved.openrouterApiKey);
        providerEl.value = uiState.provider;

        function syncInputsFromState() {
            const p = providerEl.value;
            const isOR = p === "openrouter";
            const keyField = isOR ? "openrouterApiKey" : "geminiApiKey";
            const modelField = isOR ? "openrouterModel" : "geminiModel";

            keyEl.value = uiState[keyField] || "";
            keyEl.placeholder = (!uiState[keyField] && (cfg[keyField] || "").trim())
                ? "Using key from config.js"
                : "Paste API key (or set in config.js)";

            modelEl.value = uiState[modelField] || cfg[modelField] || "";
            modelEl.placeholder = isOR ? "e.g. google/gemini-2.5-flash" : "gemini-3-flash-preview";

            if (hintEl) {
                hintEl.textContent = isOR ? "OpenRouter" : "Gemini";
            }
        }

        function persistIfRemembered() {
            if (rememberEl.checked) {
                writeSavedSettings({
                    provider: uiState.provider,
                    geminiApiKey: uiState.geminiApiKey,
                    geminiModel: uiState.geminiModel,
                    openrouterApiKey: uiState.openrouterApiKey,
                    openrouterModel: uiState.openrouterModel
                });
            }
        }

        providerEl.addEventListener('change', () => {
            uiState.provider = providerEl.value;
            syncInputsFromState();
            persistIfRemembered();
        });

        keyEl.addEventListener('input', () => {
            const keyField = providerEl.value === "openrouter" ? "openrouterApiKey" : "geminiApiKey";
            uiState[keyField] = keyEl.value;
            persistIfRemembered();
        });

        modelEl.addEventListener('input', () => {
            const modelField = providerEl.value === "openrouter" ? "openrouterModel" : "geminiModel";
            uiState[modelField] = modelEl.value;
            persistIfRemembered();
        });

        rememberEl.addEventListener('change', () => {
            if (rememberEl.checked) {
                persistIfRemembered();
            } else {
                clearSavedSettings();
            }
        });

        forgetBtn.addEventListener('click', () => {
            uiState.geminiApiKey = "";
            uiState.openrouterApiKey = "";
            keyEl.value = "";
            rememberEl.checked = false;
            clearSavedSettings();
            syncInputsFromState();
            showStatus("Saved API key removed from this browser.", "info", themePrefix);
        });

        syncInputsFromState();
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

    function parseJsonResponse(rawText) {
        const cleaned = rawText
            .trim()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
        try {
            return JSON.parse(cleaned);
        } catch (_) {
            const start = cleaned.indexOf('{');
            const end = cleaned.lastIndexOf('}');
            if (start !== -1 && end > start) {
                try {
                    return JSON.parse(cleaned.slice(start, end + 1));
                } catch (_) {
                    // Fall through to error
                }
            }
            throw new Error("Could not parse structured JSON from the model response. Try a model that supports structured outputs.");
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

    async function callOpenRouter({ apiKey, model, systemPrompt, userPrompt, fieldNames, schemaName }) {
        const properties = {};
        fieldNames.forEach((name) => {
            properties[name] = { type: "string" };
        });

        const payload = {
            model: model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: schemaName || "prompt_anatomy",
                    strict: true,
                    schema: {
                        type: "object",
                        properties: properties,
                        required: fieldNames,
                        additionalProperties: false
                    }
                }
            }
        };

        const result = await fetchWithRetry("https://openrouter.ai/api/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(payload)
        });

        const content = result?.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error("Received an empty response from OpenRouter.");
        }
        return parseJsonResponse(content);
    }

    async function generateStructuredPrompt({ systemPrompt, userPrompt, fieldNames, schemaName, themePrefix }) {
        const { provider, apiKey, model } = getActiveSettings();
        if (!apiKey) {
            showStatus("Add your API key in API settings or config.js", "error", themePrefix);
            return null;
        }

        if (provider === "openrouter") {
            if (!model) {
                showStatus("Please enter an OpenRouter model name in API settings or config.js.", "error", themePrefix);
                return null;
            }
            return await callOpenRouter({ apiKey, model, systemPrompt, userPrompt, fieldNames, schemaName });
        }

        const geminiModel = model || DEFAULT_CONFIG.geminiModel;
        return await callGemini({ apiKey, model: geminiModel, systemPrompt, userPrompt, fieldNames });
    }

    window.PA = {
        DEFAULT_CONFIG,
        getConfig,
        initApiSettings,
        initIcons,
        showStatus,
        hideStatus,
        copyText,
        generateStructuredPrompt
    };
})();
