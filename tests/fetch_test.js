const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const commonCode = fs.readFileSync(path.join(__dirname, "..", "js", "common.js"), "utf8");

function makeElement(initialValue = "") {
    const listeners = {};
    return {
        value: initialValue,
        textContent: "",
        placeholder: "",
        checked: false,
        classList: {
            _set: new Set(),
            add(...cls) { cls.forEach(c => this._set.add(c)); },
            remove(...cls) { cls.forEach(c => this._set.delete(c)); },
            toggle(c, force) {
                if (force === undefined) {
                    if (this._set.has(c)) this._set.delete(c);
                    else this._set.add(c);
                } else if (force) {
                    this._set.add(c);
                } else {
                    this._set.delete(c);
                }
            },
            contains(c) { return this._set.has(c); }
        },
        setAttribute() {},
        addEventListener(evt, fn) {
            listeners[evt] = listeners[evt] || [];
            listeners[evt].push(fn);
        },
        dispatch(evt) {
            for (const fn of listeners[evt] || []) fn();
        }
    };
}

function createHarness(configOverrides = {}, savedOverrides = null) {
    const elements = {
        "pa-provider": makeElement("gemini"),
        "pa-api-key": makeElement(""),
        "pa-model": makeElement(""),
        "pa-base-url-wrap": makeElement(""),
        "pa-base-url": makeElement(""),
        "pa-remember": makeElement(""),
        "pa-forget-btn": makeElement(""),
        "pa-settings-hint": makeElement(""),
        "statusBanner": makeElement(""),
        "statusMessage": makeElement(""),
        "statusIcon": makeElement("")
    };

    const storage = {};
    if (savedOverrides) {
        storage["pa_api_settings_v1"] = JSON.stringify(savedOverrides);
    }

    const recordedDelays = [];
    const fetchRequests = [];
    const activeTimeouts = new Map();
    let nextTimeoutId = 1;
    let nextResponder = async () => {
        throw new Error("Unexpected fetch call");
    };

    const windowStub = {
        PA_CONFIG: Object.assign({
            provider: "gemini",
            geminiApiKey: "test-gemini-key",
            geminiModel: "gemini-3-flash-preview",
            openrouterApiKey: "test-openrouter-key",
            openrouterModel: "test/model",
            customBaseUrl: "http://localhost:20128/v1",
            customApiKey: "",
            customModel: "test-model"
        }, configOverrides)
    };
    windowStub.window = windowStub;

    const context = vm.createContext({
        window: windowStub,
        document: {
            getElementById: (id) => elements[id] || null
        },
        localStorage: {
            getItem: (k) => (Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null),
            setItem: (k, v) => { storage[k] = String(v); },
            removeItem: (k) => { delete storage[k]; }
        },
        URL,
        AbortController,
        requestAnimationFrame: (fn) => { fn(); return 1; },
        cancelAnimationFrame: () => {},
        setTimeout: (fn, ms = 0) => {
            const id = nextTimeoutId++;
            if (ms >= 60000) {
                activeTimeouts.set(id, ms);
                return id;
            }
            assert.strictEqual(
                activeTimeouts.size,
                0,
                "60s AbortController timeout must be cleared before waiting to retry"
            );
            recordedDelays.push(ms);
            fn();
            return id;
        },
        clearTimeout: (id) => {
            activeTimeouts.delete(id);
        },
        fetch: async (url, options) => {
            fetchRequests.push({ url, options });
            return nextResponder(url, options, fetchRequests.length);
        }
    });

    vm.runInContext(commonCode, context, { filename: "js/common.js" });

    return {
        window: windowStub,
        elements,
        recordedDelays,
        fetchRequests,
        setResponder(fn) { nextResponder = fn; },
        async runGenerate() {
            return await windowStub.PA.generateStructuredPrompt({
                systemPrompt: "s",
                userPrompt: "u",
                fieldNames: ["role", "task"],
                schemaName: "test_schema",
                themePrefix: "claude"
            });
        }
    };
}

function makeResponse({ ok = true, status = 200, headers = {}, jsonBody = null, jsonError = null }) {
    const normalized = {};
    for (const [k, v] of Object.entries(headers)) {
        normalized[k.toLowerCase()] = v;
    }
    return {
        ok,
        status,
        headers: {
            get(name) {
                const key = String(name || "").toLowerCase();
                return Object.prototype.hasOwnProperty.call(normalized, key) ? normalized[key] : null;
            }
        },
        async json() {
            if (jsonError) throw jsonError;
            return jsonBody;
        }
    };
}

function geminiOk() {
    return makeResponse({
        ok: true,
        status: 200,
        jsonBody: { candidates: [{ content: { parts: [{ text: '{"role":"R","task":"T"}' }] } }] }
    });
}

const cases = [
    ["429 + Retry-After: 3 -> waits 3 s, 2 calls", async () => {
        const h = createHarness();
        h.setResponder(async (_url, _opts, callNum) => {
            if (callNum === 1) {
                return makeResponse({
                    ok: false,
                    status: 429,
                    headers: { "Retry-After": "3" },
                    jsonBody: { error: { message: "Too many requests" } }
                });
            }
            return geminiOk();
        });
        const res = await h.runGenerate();
        assert.deepEqual(res, { role: "R", task: "T" });
        assert.strictEqual(h.fetchRequests.length, 2);
        assert.deepEqual(h.recordedDelays, [3000]);

        const hDate = createHarness();
        const futureDate = new Date(Date.now() + 4000).toUTCString();
        hDate.setResponder(async (_url, _opts, callNum) => {
            if (callNum === 1) {
                return makeResponse({
                    ok: false,
                    status: 429,
                    headers: { "Retry-After": futureDate },
                    jsonBody: { error: { message: "Too many requests" } }
                });
            }
            return geminiOk();
        });
        const resDate = await hDate.runGenerate();
        assert.deepEqual(resDate, { role: "R", task: "T" });
        assert.strictEqual(hDate.fetchRequests.length, 2);
        assert.strictEqual(hDate.recordedDelays.length, 1);
        assert.ok(hDate.recordedDelays[0] > 0 && hDate.recordedDelays[0] <= 15000);
    }],
    ["429 + Gemini retryDelay '5s' -> waits 5 s, 2 calls", async () => {
        const h = createHarness();
        h.setResponder(async (_url, _opts, callNum) => {
            if (callNum === 1) {
                return makeResponse({
                    ok: false,
                    status: 429,
                    jsonBody: {
                        error: {
                            message: "Quota exceeded",
                            details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "5s" }]
                        }
                    }
                });
            }
            return geminiOk();
        });
        const res = await h.runGenerate();
        assert.deepEqual(res, { role: "R", task: "T" });
        assert.strictEqual(h.fetchRequests.length, 2);
        assert.deepEqual(h.recordedDelays, [5000]);
    }],
    ["429 + retryDelay '40s' -> 1 call, 'about 40 s' in message", async () => {
        const h = createHarness();
        h.setResponder(async () => makeResponse({
            ok: false,
            status: 429,
            jsonBody: {
                error: {
                    message: "Quota exceeded",
                    details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "40s" }]
                }
            }
        }));
        await assert.rejects(
            () => h.runGenerate(),
            /Rate limited by Gemini\. Try again in about 40 s\./
        );
        assert.strictEqual(h.fetchRequests.length, 1);
        assert.deepEqual(h.recordedDelays, []);

        const h404 = createHarness({ provider: "custom" });
        h404.setResponder(async () => makeResponse({
            ok: false,
            status: 404,
            headers: { "content-type": "text/html" },
            jsonError: new SyntaxError("Unexpected token '<'")
        }));
        await assert.rejects(
            () => h404.runGenerate(),
            /HTTP 404: .*did not return JSON/
        );
        assert.strictEqual(h404.fetchRequests.length, 1);
        assert.deepEqual(h404.recordedDelays, []);
    }],
    ["429 with no info -> 2 calls, then daily-limit message", async () => {
        const h = createHarness();
        h.setResponder(async () => makeResponse({
            ok: false,
            status: 429,
            jsonBody: { error: { message: "Resource exhausted" } }
        }));
        await assert.rejects(
            () => h.runGenerate(),
            /Rate limited by Gemini\. Wait a minute and try again\. On the free tier you may have hit the daily limit\./
        );
        assert.strictEqual(h.fetchRequests.length, 2);
        assert.deepEqual(h.recordedDelays, [2000]);
    }],
    ["503 -> backoff up to max", async () => {
        const h = createHarness();
        h.setResponder(async () => makeResponse({
            ok: false,
            status: 503,
            jsonBody: { error: { message: "Service unavailable" } }
        }));
        await assert.rejects(
            () => h.runGenerate(),
            /Service unavailable/
        );
        assert.strictEqual(h.fetchRequests.length, 4);
        assert.deepEqual(h.recordedDelays, [1000, 2000, 4000]);
    }],
    ["200 OK text/html -> 1 call, 'did not return JSON'", async () => {
        const h = createHarness({ provider: "custom" });
        h.setResponder(async () => makeResponse({
            ok: true,
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
            jsonError: new SyntaxError("Unexpected token '<'")
        }));
        await assert.rejects(
            () => h.runGenerate(),
            /localhost:20128 did not return JSON \(got text\/html\)\. Check the Base URL\. It usually ends with \/v1\./
        );
        assert.strictEqual(h.fetchRequests.length, 1);
        assert.deepEqual(h.recordedDelays, []);

        const h404 = createHarness({ provider: "custom" });
        h404.setResponder(async () => makeResponse({
            ok: false,
            status: 404,
            headers: { "content-type": "text/html" },
            jsonError: new SyntaxError("Unexpected token '<'")
        }));
        await assert.rejects(
            () => h404.runGenerate(),
            /HTTP 404: .*did not return JSON/
        );
        assert.strictEqual(h404.fetchRequests.length, 1);
        assert.deepEqual(h404.recordedDelays, []);
    }],
    ["401 -> 1 call and never leaks API key", async () => {
        const secretKey = "sk-test-1234567890abcdef";
        const h = createHarness({ provider: "openrouter", openrouterApiKey: secretKey });
        h.setResponder(async () => makeResponse({
            ok: false,
            status: 401,
            jsonBody: { error: { message: `Invalid key Bearer ${secretKey}` } }
        }));
        let caught = null;
        try {
            await h.runGenerate();
        } catch (err) {
            caught = err;
        }
        assert.ok(caught, "Expected 401 to throw");
        assert.strictEqual(caught.message.includes(secretKey), false);
        assert.strictEqual(h.fetchRequests.length, 1);
        assert.deepEqual(h.recordedDelays, []);

        const h404 = createHarness({ provider: "custom" });
        h404.setResponder(async () => makeResponse({
            ok: false,
            status: 404,
            headers: { "content-type": "text/html" },
            jsonError: new SyntaxError("Unexpected token '<'")
        }));
        await assert.rejects(
            () => h404.runGenerate(),
            /HTTP 404: .*did not return JSON/
        );
        assert.strictEqual(h404.fetchRequests.length, 1);
        assert.deepEqual(h404.recordedDelays, []);
    }],
    ["bad base URLs 'localhost:20128/v1' and 'ftp://x' -> 0 calls, banner", async () => {
        for (const badUrl of ["localhost:20128/v1", "ftp://x"]) {
            const h = createHarness({ provider: "custom", customBaseUrl: badUrl });
            const res = await h.runGenerate();
            assert.strictEqual(res, null);
            assert.strictEqual(h.fetchRequests.length, 0);
            assert.match(
                h.elements.statusMessage.textContent,
                /Base URL must start with http:\/\/ or https:\/\/ \(for example http:\/\/localhost:20128\/v1\)/
            );
        }

        const hTrim = createHarness({ provider: "custom", customBaseUrl: "  http://localhost:20128/v1///  " });
        hTrim.setResponder(async () => makeResponse({
            ok: true,
            status: 200,
            jsonBody: { choices: [{ message: { content: '{"role":"R","task":"T"}' } }] }
        }));
        const resTrim = await hTrim.runGenerate();
        assert.deepEqual(resTrim, { role: "R", task: "T" });
        assert.strictEqual(hTrim.fetchRequests[0].url, "http://localhost:20128/v1/chat/completions");
    }],
    ["provider 'OpenRouter' -> openrouter", async () => {
        const h = createHarness({
            provider: "OpenRouter",
            geminiApiKey: "test-gemini-only",
            openrouterApiKey: "test-openrouter-only"
        });
        h.window.PA.initApiSettings("claude");
        assert.strictEqual(h.elements["pa-provider"].value, "openrouter");
        assert.strictEqual(h.elements.statusMessage.textContent, "");

        h.setResponder(async () => makeResponse({
            ok: true,
            status: 200,
            jsonBody: { choices: [{ message: { content: '{"role":"R","task":"T"}' } }] }
        }));
        const res = await h.runGenerate();
        assert.deepEqual(res, { role: "R", task: "T" });
        assert.strictEqual(h.fetchRequests[0].url, "https://openrouter.ai/api/v1/chat/completions");
        assert.strictEqual(h.fetchRequests[0].options.headers.Authorization, "Bearer test-openrouter-only");
    }],
    ["provider 'foo' -> gemini + warning", async () => {
        const h = createHarness({
            provider: "foo",
            geminiApiKey: "test-gemini-only",
            openrouterApiKey: "test-openrouter-only"
        });
        h.window.PA.initApiSettings("claude");
        assert.strictEqual(h.elements["pa-provider"].value, "gemini");
        assert.strictEqual(
            h.elements.statusMessage.textContent,
            "Unknown provider 'foo' in config.js, using Gemini"
        );

        h.setResponder(async () => geminiOk());
        const res = await h.runGenerate();
        assert.deepEqual(res, { role: "R", task: "T" });
        assert.match(h.fetchRequests[0].url, /^https:\/\/generativelanguage\.googleapis\.com\//);
        assert.strictEqual(h.fetchRequests[0].options.headers["x-goog-api-key"], "test-gemini-only");
    }]
];

(async () => {
    let failed = 0;
    for (const [name, fn] of cases) {
        try {
            await fn();
            console.log(`PASS ${name}`);
        } catch (err) {
            failed += 1;
            console.error(`FAIL ${name}: ${err.message}`);
        }
    }
    if (failed > 0) {
        process.exit(1);
    }
})();
