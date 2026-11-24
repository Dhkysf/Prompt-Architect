(function () {
    const STORAGE_KEY = "pa_api_settings_v1";
    const DEFAULT_CONFIG = {
        provider: "gemini",
        geminiApiKey: "",
        geminiModel: "gemini-3-flash-preview",
        openrouterApiKey: "",
        openrouterModel: "",
        customBaseUrl: "http://localhost:20128/v1",
        customApiKey: "",
        customModel: ""
    };

    const PROVIDER_META = {
        gemini: { key: "geminiApiKey", model: "geminiModel", hint: "Gemini", modelPlaceholder: "gemini-3-flash-preview" },
        openrouter: { key: "openrouterApiKey", model: "openrouterModel", hint: "OpenRouter", modelPlaceholder: "e.g. google/gemini-2.5-flash" },
        custom: { key: "customApiKey", model: "customModel", hint: "OpenAI-compatible", modelPlaceholder: "e.g. model name from 9router" }
    };

    const uiState = {
        provider: null,
        geminiApiKey: "",
        geminiModel: "",
        openrouterApiKey: "",
        openrouterModel: "",
        customBaseUrl: "",
        customApiKey: "",
        customModel: ""
    };

    function isLocalhostUrl(url) {
        return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/|$)/i.test(url);
    }

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
        const meta = PROVIDER_META[provider] || PROVIDER_META.gemini;

        const apiKey = (uiState[meta.key] || "").trim()
            || (saved[meta.key] || "").trim()
            || (cfg[meta.key] || "").trim();
        const model = (uiState[meta.model] || "").trim()
            || (saved[meta.model] || "").trim()
            || (cfg[meta.model] || "").trim();
        const baseUrl = (uiState.customBaseUrl || "").trim()
            || (saved.customBaseUrl || "").trim()
            || (cfg.customBaseUrl || "").trim()
            || DEFAULT_CONFIG.customBaseUrl;

        return { provider, apiKey, model, baseUrl };
    }

    function initApiSettings(themePrefix = 'claude') {
        const providerEl = document.getElementById('pa-provider');
        const keyEl = document.getElementById('pa-api-key');
        const modelEl = document.getElementById('pa-model');
        const baseUrlWrap = document.getElementById('pa-base-url-wrap');
        const baseUrlEl = document.getElementById('pa-base-url');
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
        uiState.customBaseUrl = saved.customBaseUrl || "";
        uiState.customApiKey = saved.customApiKey || "";
        uiState.customModel = saved.customModel || "";

        rememberEl.checked = Object.keys(saved).length > 0;
        providerEl.value = uiState.provider;

        function syncInputsFromState() {
            const p = providerEl.value;
            const meta = PROVIDER_META[p] || PROVIDER_META.gemini;

            keyEl.value = uiState[meta.key] || "";
            keyEl.placeholder = (!uiState[meta.key] && (cfg[meta.key] || "").trim())
                ? "Using key from config.js"
                : (p === "custom" ? "API key (optional for local gateways)" : "Paste API key (or set in config.js)");

            modelEl.value = uiState[meta.model] || cfg[meta.model] || "";
            modelEl.placeholder = meta.modelPlaceholder;

            if (baseUrlWrap && baseUrlEl) {
                baseUrlWrap.classList.toggle('hidden', p !== "custom");
                baseUrlEl.value = uiState.customBaseUrl || cfg.customBaseUrl || DEFAULT_CONFIG.customBaseUrl;
            }

            if (hintEl) {
                hintEl.textContent = meta.hint;
            }
        }

        function persistIfRemembered() {
            if (rememberEl.checked) {
                writeSavedSettings({
                    provider: uiState.provider,
                    geminiApiKey: uiState.geminiApiKey,
                    geminiModel: uiState.geminiModel,
                    openrouterApiKey: uiState.openrouterApiKey,
                    openrouterModel: uiState.openrouterModel,
                    customBaseUrl: uiState.customBaseUrl,
                    customApiKey: uiState.customApiKey,
                    customModel: uiState.customModel
                });
            }
        }

        providerEl.addEventListener('change', () => {
            uiState.provider = providerEl.value;
            syncInputsFromState();
            persistIfRemembered();
        });

        keyEl.addEventListener('input', () => {
            const meta = PROVIDER_META[providerEl.value] || PROVIDER_META.gemini;
            uiState[meta.key] = keyEl.value;
            persistIfRemembered();
        });

        modelEl.addEventListener('input', () => {
            const meta = PROVIDER_META[providerEl.value] || PROVIDER_META.gemini;
            uiState[meta.model] = modelEl.value;
            persistIfRemembered();
        });

        if (baseUrlEl) {
            baseUrlEl.addEventListener('input', () => {
                uiState.customBaseUrl = baseUrlEl.value;
                persistIfRemembered();
            });
        }

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
            uiState.customApiKey = "";
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

    let statusFrameId = null;

    function showStatus(message, type = 'info', themePrefix = 'claude') {
        const banner = document.getElementById('statusBanner');
        const msgEl = document.getElementById('statusMessage');
        const iconEl = document.getElementById('statusIcon');
        if (!banner || !msgEl || !iconEl) return;

        if (statusFrameId !== null) {
            cancelAnimationFrame(statusFrameId);
            statusFrameId = null;
        }

        msgEl.textContent = '';

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

        initIcons();
        statusFrameId = requestAnimationFrame(() => {
            statusFrameId = null;
            msgEl.textContent = message;
        });
    }

    function hideStatus() {
        if (statusFrameId !== null) {
            cancelAnimationFrame(statusFrameId);
            statusFrameId = null;
        }
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
                const prevFocus = document.activeElement;
                fallback.value = text;
                fallback.select();
                fallback.setSelectionRange(0, 99999);
                try {
                    copied = document.execCommand('copy');
                } catch (_) {
                    copied = false;
                } finally {
                    if (prevFocus && typeof prevFocus.focus === 'function' && prevFocus !== fallback) {
                        prevFocus.focus({ preventScroll: true });
                    }
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
                try {
                    return await response.json();
                } catch (_) {
                    const err = new Error("Could not parse JSON from the API response.");
                    err.retryable = false;
                    throw err;
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    throw new Error("Request timed out after 60 seconds.");
                }
                if (err instanceof TypeError && isLocalhostUrl(url)) {
                    throw err;
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
        if (typeof rawText !== "string") {
            throw new Error("Could not parse structured JSON from the model response. Try a model that supports structured outputs.");
        }
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

    function coerceFieldValue(value) {
        if (typeof value === "string") return value.trim();
        if (typeof value === "number" || typeof value === "boolean") return String(value);
        if (Array.isArray(value) && value.every(v => typeof v === "string" || typeof v === "number")) {
            return value.join("\n").trim();
        }
        return "";
    }

    function validateStructuredResponse(rawText, fieldNames) {
        const parsed = parseJsonResponse(rawText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            const actual = parsed === null ? "null" : Array.isArray(parsed) ? "an array" : typeof parsed;
            throw new Error(`The model returned ${actual} instead of an object`);
        }

        const result = {};
        const missing = [];
        for (const name of fieldNames) {
            const raw = Object.prototype.hasOwnProperty.call(parsed, name) ? parsed[name] : undefined;
            const value = coerceFieldValue(raw);
            if (!value) {
                missing.push(name);
            } else {
                result[name] = value;
            }
        }

        if (missing.length > 0) {
            throw new Error(`The model reply is missing: ${missing.join(", ")}. Your fields were not changed.`);
        }
        return result;
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

        const candidate = result?.candidates?.[0];
        const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
        const rawText = parts
            .filter(p => p && !p.thought && typeof p.text === "string")
            .map(p => p.text)
            .join("");

        if (!rawText.trim()) {
            const blockReason = result?.promptFeedback?.blockReason;
            if (blockReason) {
                throw new Error(`Blocked by Gemini safety filter (${blockReason})`);
            }
            const finishReason = candidate?.finishReason;
            if (finishReason === "SAFETY" || finishReason === "RECITATION") {
                throw new Error(`Blocked by Gemini safety filter (${finishReason})`);
            }
            if (finishReason === "MAX_TOKENS") {
                throw new Error("The reply was cut off. Try again or shorten your idea.");
            }
            throw new Error("Received an empty response from the AI model.");
        }
        return rawText;
    }

    async function callOpenAICompat({ baseUrl, apiKey, model, systemPrompt, userPrompt, fieldNames, schemaName }) {
        const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
        const properties = {};
        fieldNames.forEach((name) => {
            properties[name] = { type: "string" };
        });

        const payload = {
            model: model,
            stream: false,
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

        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        let result;
        try {
            result = await fetchWithRetry(`${cleanBaseUrl}/chat/completions`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });
        } catch (err) {
            if (err instanceof TypeError && isLocalhostUrl(cleanBaseUrl)) {
                throw new Error(`Cannot reach ${cleanBaseUrl}. Is 9router running? Check the dashboard at http://localhost:20128/dashboard`);
            }
            throw err;
        }

        const content = result?.choices?.[0]?.message?.content;
        if (typeof content !== "string" || !content.trim()) {
            throw new Error("Received an empty response from the AI model.");
        }
        return content;
    }

    async function generateStructuredPrompt({ systemPrompt, userPrompt, fieldNames, schemaName, themePrefix }) {
        const { provider, apiKey, model, baseUrl } = getActiveSettings();
        let rawText;

        if (provider === "custom") {
            if (!model) {
                showStatus("Please enter a model name in API settings or config.js.", "error", themePrefix);
                return null;
            }
            rawText = await callOpenAICompat({ baseUrl, apiKey, model, systemPrompt, userPrompt, fieldNames, schemaName });
        } else {
            if (!apiKey) {
                showStatus("Add your API key in API settings or config.js", "error", themePrefix);
                return null;
            }

            if (provider === "openrouter") {
                if (!model) {
                    showStatus("Please enter an OpenRouter model name in API settings or config.js.", "error", themePrefix);
                    return null;
                }
                rawText = await callOpenAICompat({ baseUrl: "https://openrouter.ai/api/v1", apiKey, model, systemPrompt, userPrompt, fieldNames, schemaName });
            } else {
                const geminiModel = model || DEFAULT_CONFIG.geminiModel;
                rawText = await callGemini({ apiKey, model: geminiModel, systemPrompt, userPrompt, fieldNames });
            }
        }

        return validateStructuredResponse(rawText, fieldNames);
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
