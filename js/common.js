(function () {
    const STORAGE_KEY = "pa_api_settings_v1";
    const MAX_RATE_LIMIT_WAIT_MS = 15000;
    const UNKNOWN_RATE_LIMIT_WAIT_MS = 2000;
    const REQUEST_TIMEOUT_MS = 60000;
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

    function validateCustomBaseUrl(rawUrl) {
        const trimmed = String(rawUrl || "").trim();
        if (!trimmed) return null;
        try {
            const parsed = new URL(trimmed);
            if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname) {
                return null;
            }
            return trimmed.replace(/\/+$/, "");
        } catch (_) {
            return null;
        }
    }

    function isLocalhostUrl(url) {
        try {
            const parsed = new URL(url);
            if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
            const host = parsed.hostname.toLowerCase();
            return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
        } catch (_) {
            return false;
        }
    }

    function getHostFromUrl(url) {
        try {
            return new URL(url).host || "The server";
        } catch (_) {
            return "The server";
        }
    }

    function normalizeProvider(value) {
        if (value === null || value === undefined) {
            return { provider: null, invalid: false, raw: "" };
        }
        const raw = String(value).trim();
        if (!raw) {
            return { provider: null, invalid: false, raw: "" };
        }
        const normalized = raw.toLowerCase();
        if (Object.prototype.hasOwnProperty.call(PROVIDER_META, normalized)) {
            return { provider: normalized, invalid: false, raw };
        }
        return { provider: "gemini", invalid: true, raw };
    }

    function resolveProvider(uiVal, savedVal, cfgVal) {
        const uiRes = normalizeProvider(uiVal);
        if (uiRes.provider !== null) {
            return { provider: uiRes.provider, warning: null };
        }
        const savedRes = normalizeProvider(savedVal);
        if (savedRes.provider !== null) {
            return {
                provider: savedRes.provider,
                warning: savedRes.invalid
                    ? `Unknown provider '${sanitizeErrorMessage(savedRes.raw).slice(0, 40)}' in saved settings, using Gemini`
                    : null
            };
        }
        const cfgRes = normalizeProvider(cfgVal);
        if (cfgRes.provider !== null) {
            return {
                provider: cfgRes.provider,
                warning: cfgRes.invalid
                    ? `Unknown provider '${sanitizeErrorMessage(cfgRes.raw).slice(0, 40)}' in config.js, using Gemini`
                    : null
            };
        }
        return { provider: "gemini", warning: null };
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
        const { provider } = resolveProvider(uiState.provider, saved.provider, cfg.provider);
        const meta = PROVIDER_META[provider];

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
        const resolved = resolveProvider(null, saved.provider, cfg.provider);

        uiState.provider = resolved.provider;
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
            const p = normalizeProvider(providerEl.value).provider || "gemini";
            if (providerEl.value !== p) {
                providerEl.value = p;
            }
            const meta = PROVIDER_META[p];

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
            uiState.provider = normalizeProvider(providerEl.value).provider || "gemini";
            syncInputsFromState();
            persistIfRemembered();
        });

        keyEl.addEventListener('input', () => {
            const p = normalizeProvider(providerEl.value).provider || "gemini";
            const meta = PROVIDER_META[p];
            uiState[meta.key] = keyEl.value;
            persistIfRemembered();
        });

        modelEl.addEventListener('input', () => {
            const p = normalizeProvider(providerEl.value).provider || "gemini";
            const meta = PROVIDER_META[p];
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
        if (resolved.warning) {
            showStatus(resolved.warning, "warning", themePrefix);
        }
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
            'bg-amber-950/50', 'border-amber-800/60', 'text-amber-200',
            'bg-emerald-950/50', 'border-emerald-800/60', 'text-emerald-200',
            'bg-claude-surface', 'border-claude-border', 'text-claude-text',
            'bg-gemini-surface', 'border-gemini-border', 'text-gemini-text'
        );

        if (type === 'error') {
            banner.classList.add('bg-red-950/50', 'border-red-800/60', 'text-red-200');
            iconEl.setAttribute('data-lucide', 'alert-circle');
        } else if (type === 'warning') {
            banner.classList.add('bg-amber-950/50', 'border-amber-800/60', 'text-amber-200');
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

    function extractSecrets(options) {
        const secrets = [];
        const headers = options && options.headers;
        if (!headers) return secrets;
        for (const [k, v] of Object.entries(headers)) {
            const lk = k.toLowerCase();
            if ((lk === 'authorization' || lk === 'x-goog-api-key') && typeof v === 'string' && v.trim()) {
                const val = v.trim();
                secrets.push(val);
                if (/^bearer\s+/i.test(val)) {
                    const token = val.replace(/^bearer\s+/i, '').trim();
                    if (token) secrets.push(token);
                }
            }
        }
        return secrets;
    }

    function sanitizeErrorMessage(text, secrets = []) {
        let msg = String(text || "").replace(/\s+/g, " ").trim();
        for (const secret of secrets) {
            if (secret && secret.length >= 4) {
                msg = msg.split(secret).join("[redacted]");
            }
        }
        msg = msg
            .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
            .replace(/Authorization\s*:\s*[^\s,;]+/gi, "Authorization: [redacted]")
            .replace(/AIza[0-9A-Za-z_-]{10,}/g, "[redacted]")
            .replace(/sk-or-v1-[0-9a-f]{10,}/gi, "[redacted]");
        if (msg.length > 120) {
            msg = msg.slice(0, 117).trimEnd() + "...";
        }
        return msg;
    }

    function getRateLimitWaitMs(response, errorData) {
        const retryAfter = response.headers && typeof response.headers.get === "function"
            ? response.headers.get("Retry-After")
            : null;
        if (typeof retryAfter === "string" && retryAfter.trim()) {
            const trimmed = retryAfter.trim();
            if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
                const secs = Number(trimmed);
                if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
            } else {
                const dateMs = Date.parse(trimmed);
                if (!Number.isNaN(dateMs)) {
                    return Math.max(0, dateMs - Date.now());
                }
            }
        }

        const details = Array.isArray(errorData?.error?.details) ? errorData.error.details : [];
        for (const d of details) {
            if (d && d["@type"] === "type.googleapis.com/google.rpc.RetryInfo" && typeof d.retryDelay === "string") {
                const m = d.retryDelay.match(/^\s*(\d+(?:\.\d+)?)s\s*$/i);
                if (m) {
                    const secs = Number(m[1]);
                    if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
                }
            }
        }
        return null;
    }

    function nonJsonErrorMessage(url, response) {
        const rawCt = response.headers && typeof response.headers.get === "function"
            ? response.headers.get("content-type")
            : null;
        const contentType = (typeof rawCt === "string" && rawCt.trim())
            ? rawCt.split(";")[0].trim().slice(0, 50)
            : "unknown";
        return `${getHostFromUrl(url)} did not return JSON (got ${contentType}). Check the Base URL. It usually ends with /v1.`;
    }

    async function fetchWithRetry(url, options, providerLabel = "the provider", maxRetries = 3, baseDelay = 1000) {
        const secrets = extractSecrets(options);
        let serverRetries = 0;
        let rateLimitRetries = 0;

        while (true) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
            let retryDelayMs = null;
            try {
                const response = await fetch(url, Object.assign({}, options, { signal: controller.signal }));
                if (!response.ok) {
                    let errorData = null;
                    let isJson = true;
                    try {
                        errorData = await response.json();
                    } catch (_) {
                        isJson = false;
                    }

                    if (response.status === 429) {
                        const waitMs = getRateLimitWaitMs(response, errorData);
                        if (waitMs !== null) {
                            if (waitMs <= MAX_RATE_LIMIT_WAIT_MS && rateLimitRetries < 1) {
                                rateLimitRetries += 1;
                                retryDelayMs = waitMs;
                            } else {
                                const secs = Math.max(1, Math.ceil(waitMs / 1000));
                                const err = new Error(`Rate limited by ${providerLabel}. Try again in about ${secs} s.`);
                                err.retryable = false;
                                throw err;
                            }
                        } else if (rateLimitRetries < 1) {
                            rateLimitRetries += 1;
                            retryDelayMs = UNKNOWN_RATE_LIMIT_WAIT_MS;
                        } else {
                            const err = new Error(`Rate limited by ${providerLabel}. Wait a minute and try again. On the free tier you may have hit the daily limit.`);
                            err.retryable = false;
                            throw err;
                        }
                    } else if (!isJson) {
                        const err = new Error(`HTTP ${response.status}: ${nonJsonErrorMessage(url, response)}`);
                        err.retryable = response.status >= 500;
                        throw err;
                    } else {
                        const rawMsg = errorData?.error?.message || errorData?.message || "";
                        const cleanMsg = sanitizeErrorMessage(rawMsg, secrets) || `HTTP ${response.status}`;
                        const err = new Error(cleanMsg);
                        err.retryable = response.status >= 500;
                        throw err;
                    }
                } else {
                    try {
                        return await response.json();
                    } catch (_) {
                        const err = new Error(nonJsonErrorMessage(url, response));
                        err.retryable = false;
                        throw err;
                    }
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    throw new Error("Request timed out after 60 seconds.");
                }
                if (err instanceof TypeError && isLocalhostUrl(url)) {
                    throw err;
                }
                if (err.retryable === false || serverRetries >= maxRetries) {
                    throw err;
                }
                retryDelayMs = baseDelay * Math.pow(2, serverRetries);
                serverRetries += 1;
            } finally {
                clearTimeout(timeoutId);
            }

            if (retryDelayMs !== null) {
                await new Promise(res => setTimeout(res, retryDelayMs));
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
        }, PROVIDER_META.gemini.hint);

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

    async function callOpenAICompat({ baseUrl, apiKey, model, systemPrompt, userPrompt, fieldNames, schemaName, providerLabel }) {
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
            }, providerLabel || PROVIDER_META.custom.hint);
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
            const validBaseUrl = validateCustomBaseUrl(baseUrl);
            if (!validBaseUrl) {
                showStatus("Base URL must start with http:// or https:// (for example http://localhost:20128/v1)", "error", themePrefix);
                return null;
            }
            if (!model) {
                showStatus("Please enter a model name in API settings or config.js.", "error", themePrefix);
                return null;
            }
            rawText = await callOpenAICompat({ baseUrl: validBaseUrl, apiKey, model, systemPrompt, userPrompt, fieldNames, schemaName, providerLabel: PROVIDER_META.custom.hint });
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
                rawText = await callOpenAICompat({ baseUrl: "https://openrouter.ai/api/v1", apiKey, model, systemPrompt, userPrompt, fieldNames, schemaName, providerLabel: PROVIDER_META.openrouter.hint });
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
