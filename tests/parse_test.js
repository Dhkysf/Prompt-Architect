const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const commonCode = fs.readFileSync(path.join(__dirname, "..", "js", "common.js"), "utf8");

let fetchCalls = 0;
let nextResponder = null;

const windowStub = {
    PA_CONFIG: {
        provider: "gemini",
        geminiApiKey: "test-fake-key",
        geminiModel: "gemini-3-flash-preview",
        openrouterApiKey: "test-fake-key",
        openrouterModel: "test/model",
        customBaseUrl: "http://localhost:20128/v1",
        customApiKey: "",
        customModel: "test-model"
    }
};
windowStub.window = windowStub;

const context = vm.createContext({
    window: windowStub,
    document: { getElementById: () => null },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async (url, options) => {
        fetchCalls += 1;
        return nextResponder(url, options);
    }
});

vm.runInContext(commonCode, context, { filename: "js/common.js" });

function geminiReply(parts, extra = {}) {
    return Object.assign({ candidates: [{ content: { parts } }] }, extra);
}

function openAiReply(content) {
    return { choices: [{ message: { content } }] };
}

async function callWith(provider, responseBody, fieldNames) {
    windowStub.PA_CONFIG.provider = provider;
    fetchCalls = 0;
    nextResponder = async () => ({
        ok: true,
        status: 200,
        async json() {
            return responseBody;
        }
    });
    return await windowStub.PA.generateStructuredPrompt({
        systemPrompt: "s",
        userPrompt: "u",
        fieldNames,
        schemaName: "test_schema",
        themePrefix: "claude"
    });
}

const cases = [
    ["plain JSON trims strings and drops extra keys", async () => {
        const res = await callWith("gemini", geminiReply([{ text: '{"role":" R ","task":" T ","extra":"ignored"}' }]), ["role", "task"]);
        assert.deepEqual(res, { role: "R", task: "T" });
        assert.strictEqual(fetchCalls, 1);
    }],
    ["```json fenced JSON", async () => {
        const res = await callWith("gemini", geminiReply([{ text: '```json\n{"role":"R","task":"T"}\n```' }]), ["role", "task"]);
        assert.deepEqual(res, { role: "R", task: "T" });
    }],
    ["text before and after JSON", async () => {
        const res = await callWith("gemini", geminiReply([{ text: 'Here is the JSON:\n{"role":"R","task":"T"}\nDone!' }]), ["role", "task"]);
        assert.deepEqual(res, { role: "R", task: "T" });
    }],
    ["Gemini thought part skipped and multiple text parts joined", async () => {
        const res = await callWith("gemini", geminiReply([
            { thought: true, text: "internal reasoning" },
            { text: '{"role":"R",' },
            { text: '"task":"T"}' }
        ]), ["role", "task"]);
        assert.deepEqual(res, { role: "R", task: "T" });
    }],
    ["null JSON throws and is not retried", async () => {
        await assert.rejects(
            () => callWith("gemini", geminiReply([{ text: "null" }]), ["role", "task"]),
            /The model returned null instead of an object/
        );
        assert.strictEqual(fetchCalls, 1);
    }],
    ["array JSON throws and is not retried", async () => {
        await assert.rejects(
            () => callWith("gemini", geminiReply([{ text: "[]" }]), ["role", "task"]),
            /The model returned an array instead of an object/
        );
        assert.strictEqual(fetchCalls, 1);
    }],
    ["empty object {} throws missing fields and is not retried", async () => {
        await assert.rejects(
            () => callWith("gemini", geminiReply([{ text: "{}" }]), ["role", "task"]),
            /The model reply is missing: role, task\. Your fields were not changed\./
        );
        assert.strictEqual(fetchCalls, 1);
    }],
    ["one missing field throws missing field name", async () => {
        await assert.rejects(
            () => callWith("gemini", geminiReply([{ text: '{"role":"R"}' }]), ["role", "task"]),
            /The model reply is missing: task\. Your fields were not changed\./
        );
        assert.strictEqual(fetchCalls, 1);
    }],
    ["array field joined with newline and number/boolean coerced", async () => {
        const res = await callWith("gemini", geminiReply([{ text: '{"role":["a","b",3],"task":42,"ok":true}' }]), ["role", "task", "ok"]);
        assert.deepEqual(res, { role: "a\nb\n3", task: "42", ok: "true" });
    }],
    ["object field treated as missing", async () => {
        await assert.rejects(
            () => callWith("gemini", geminiReply([{ text: '{"role":{"a":1},"task":"T"}' }]), ["role", "task"]),
            /The model reply is missing: role\. Your fields were not changed\./
        );
        assert.strictEqual(fetchCalls, 1);
    }],
    ["Gemini MAX_TOKENS with no text", async () => {
        await assert.rejects(
            () => callWith("gemini", { candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [] } }] }, ["role", "task"]),
            /The reply was cut off\. Try again or shorten your idea\./
        );
        assert.strictEqual(fetchCalls, 1);
    }],
    ["Gemini promptFeedback.blockReason with no text", async () => {
        await assert.rejects(
            () => callWith("gemini", { promptFeedback: { blockReason: "SAFETY" }, candidates: [] }, ["role", "task"]),
            /Blocked by Gemini safety filter \(SAFETY\)/
        );
        assert.strictEqual(fetchCalls, 1);
    }],
    ["Gemini finishReason SAFETY and RECITATION with no text", async () => {
        await assert.rejects(
            () => callWith("gemini", { candidates: [{ finishReason: "SAFETY", content: { parts: [] } }] }, ["role", "task"]),
            /Blocked by Gemini safety filter \(SAFETY\)/
        );
        await assert.rejects(
            () => callWith("gemini", { candidates: [{ finishReason: "RECITATION", content: { parts: [] } }] }, ["role", "task"]),
            /Blocked by Gemini safety filter \(RECITATION\)/
        );
    }],
    ["OpenRouter and custom providers use shared validator", async () => {
        await assert.rejects(
            () => callWith("openrouter", openAiReply("{}"), ["role", "task"]),
            /The model reply is missing: role, task\. Your fields were not changed\./
        );
        assert.strictEqual(fetchCalls, 1);

        const res = await callWith("custom", openAiReply('```json\n{"role":"R","task":"T"}\n```'), ["role", "task"]);
        assert.deepEqual(res, { role: "R", task: "T" });
        assert.strictEqual(fetchCalls, 1);
    }],
    ["unparseable text and invalid HTTP JSON body are not retried", async () => {
        await assert.rejects(
            () => callWith("gemini", geminiReply([{ text: "not json at all" }]), ["role", "task"]),
            /Could not parse structured JSON/
        );
        assert.strictEqual(fetchCalls, 1);

        windowStub.PA_CONFIG.provider = "gemini";
        fetchCalls = 0;
        nextResponder = async () => ({
            ok: true,
            status: 200,
            async json() {
                throw new SyntaxError("Unexpected token");
            }
        });
        await assert.rejects(
            () => windowStub.PA.generateStructuredPrompt({
                systemPrompt: "s",
                userPrompt: "u",
                fieldNames: ["role", "task"],
                schemaName: "test_schema",
                themePrefix: "claude"
            }),
            /did not return JSON/
        );
        assert.strictEqual(fetchCalls, 1);
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
