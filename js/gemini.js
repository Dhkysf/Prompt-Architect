// Initialize Lucide icons
window.PA.initIcons();

// State management ('xml' is default per the Gemini blueprint image, 'markdown' is the consistent alternative)
let formatMode = 'xml';

// DOM Elements mapped in exact top-to-bottom order of the Gemini Anatomy image
const fields = {
    role: document.getElementById('field-role'),
    constraints: document.getElementById('field-constraints'),
    output: document.getElementById('field-output'),
    context: document.getElementById('field-context'),
    task: document.getElementById('field-task'),
    final: document.getElementById('field-final'),
};

const compiledOutputEl = document.getElementById('compiledOutput');
const charCountLabel = document.getElementById('charCountLabel');
const simplePromptInput = document.getElementById('simplePromptInput');
const generateBtn = document.getElementById('generateBtn');
const generateBtnText = document.getElementById('generateBtnText');

// Exact example from the user's reference image ("The Anatomy of a Gemini prompt")
const blueprintExample = {
    idea: "Build a 90-day launch plan for my AI task manager for founders with a 2-person team and lean budget.",
    role: "You are a senior go-to-market strategist for early-stage SaaS tools. You are precise, analytical, and prioritize traction speed over brand perfection.",
    constraints: "- Verbosity: medium. Tone: direct, founder-friendly.\n- Lean budget only: no paid ads above $500/month.\n- If critical info is missing, ask once. Otherwise state your assumptions.",
    output: "Weekly sprint plan. For each action:\nAction · Owner (Founder / Growth) · Risk addressed · Deliverable.\nEnd with a Launch Decision Gate (go / no-go criteria).",
    context: "Product: AI task manager for founders (25-40).\nTeam: 2 people (Founder + Growth marketer). 15-20 beta users.\nKey risks: Adoption, Retention, Positioning.\n[paste beta feedback, docs, or code here]",
    task: "Build a 90-day launch plan for this product. Validate the core messaging first, then get it launch-ready.",
    final: "Based on the context above: plan first, check every action against the constraints, then answer. Done when: 12 weeks, 3-4 actions per week, each linked to a risk."
};

// Populate the blueprint example on initial load
window.addEventListener('DOMContentLoaded', () => {
    window.PA.initApiSettings('gemini');
    loadExampleData(false);
});

function showStatus(message, type = 'info') {
    window.PA.showStatus(message, type, 'gemini');
}

function hideStatus() {
    window.PA.hideStatus();
}

function loadExampleData(showNotification = true) {
    simplePromptInput.value = blueprintExample.idea;
    fields.role.value = blueprintExample.role;
    fields.constraints.value = blueprintExample.constraints;
    fields.output.value = blueprintExample.output;
    fields.context.value = blueprintExample.context;
    fields.task.value = blueprintExample.task;
    fields.final.value = blueprintExample.final;
    updateCombinedPrompt();
    if (showNotification) {
        showStatus("Loaded the Gemini prompt blueprint example.", "info");
    }
}

function setQuickIdea(ideaText) {
    simplePromptInput.value = ideaText;
    simplePromptInput.focus();
}

function clearAllFields() {
    simplePromptInput.value = '';
    Object.values(fields).forEach(el => el.value = '');
    updateCombinedPrompt();
    showStatus("Cleared all prompt sections.", "info");
}

function setFormatMode(mode) {
    formatMode = mode;
    const xmlBtn = document.getElementById('formatXmlBtn');
    const mdBtn = document.getElementById('formatMdBtn');

    if (mode === 'xml') {
        xmlBtn.className = "text-xs px-2.5 py-1 rounded-md bg-gemini-surfaceHover text-gemini-text font-medium transition cursor-pointer";
        mdBtn.className = "text-xs px-2.5 py-1 rounded-md text-gemini-muted hover:text-gemini-text transition cursor-pointer";
    } else {
        mdBtn.className = "text-xs px-2.5 py-1 rounded-md bg-gemini-surfaceHover text-gemini-text font-medium transition cursor-pointer";
        xmlBtn.className = "text-xs px-2.5 py-1 rounded-md text-gemini-muted hover:text-gemini-text transition cursor-pointer";
    }
    updateCombinedPrompt();
}

function updateCombinedPrompt() {
    const role = fields.role.value.trim();
    const constraints = fields.constraints.value.trim();
    const output = fields.output.value.trim();
    const context = fields.context.value.trim();
    const task = fields.task.value.trim();
    const finalInst = fields.final.value.trim();

    if (!role && !constraints && !output && !context && !task && !finalInst) {
        compiledOutputEl.textContent = "Your architected Gemini prompt will appear here once generated or edited...";
        compiledOutputEl.classList.add('text-gemini-muted');
        compiledOutputEl.classList.remove('text-gemini-text');
        charCountLabel.textContent = "0 chars";
        return;
    }

    compiledOutputEl.classList.remove('text-gemini-muted');
    compiledOutputEl.classList.add('text-gemini-text');

    let compiled = "";

    // Enforce Gemini best practice: one consistent format (XML tags OR Markdown headings, never mixed)
    // Order: 1. Role -> 2. Constraints -> 3. Output Format -> 4. Context -> 5. Task -> 6. Final Instruction
    if (formatMode === 'xml') {
        const blocks = [];
        if (role) blocks.push(`<role>\n${role}\n</role>`);
        if (constraints) blocks.push(`<constraints>\n${constraints}\n</constraints>`);
        if (output) blocks.push(`<output_format>\n${output}\n</output_format>`);
        if (context) blocks.push(`<context>\n${context}\n</context>`);
        if (task) blocks.push(`<task>\n${task}\n</task>`);
        if (finalInst) blocks.push(`<final_instruction>\n${finalInst}\n</final_instruction>`);
        compiled = blocks.join("\n\n");
    } else {
        const blocks = [];
        if (role) blocks.push(`## Role\n${role}`);
        if (constraints) blocks.push(`## Constraints\n${constraints}`);
        if (output) blocks.push(`## Output Format\n${output}`);
        if (context) blocks.push(`## Context\n${context}`);
        if (task) blocks.push(`## Task\n${task}`);
        if (finalInst) blocks.push(`## Final Instruction\n${finalInst}`);
        compiled = blocks.join("\n\n");
    }

    compiledOutputEl.textContent = compiled;
    charCountLabel.textContent = `${compiled.length.toLocaleString()} chars`;
}

function copyMasterPrompt() {
    const textToCopy = compiledOutputEl.textContent;
    if (!textToCopy || textToCopy.startsWith("Your architected Gemini prompt")) {
        showStatus("Nothing to copy yet. Generate or enter a prompt first.", "info");
        return;
    }
    window.PA.copyText(textToCopy, "Gemini master prompt copied to clipboard!", "gemini");
}

async function architectPrompt() {
    const userIdea = simplePromptInput.value.trim();
    if (!userIdea) {
        showStatus("Please enter a short description or prompt idea first.", "error");
        simplePromptInput.focus();
        return;
    }

    // Set loading UI state
    hideStatus();
    generateBtn.disabled = true;
    generateBtnText.textContent = "Architecting...";
    Object.values(fields).forEach(el => el.classList.add('animate-pulse-subtle'));

    const systemPrompt = `You are a Principal Prompt Architect specializing in Google's official Gemini Prompt Design Strategies.
Your task is to convert a user's simple, brief prompt into an optimal 6-section Master Prompt specifically engineered for Gemini's attention and reasoning architecture:

ZONE 1: TOP — RULES THAT ANCHOR REASONING (or put in System Instruction)
1. "role": Short, specific persona definition ("You are a [expert role] for [domain]. You are precise, analytical, and prioritize [X] over [Y].").
2. "constraints": 3 crisp bullet points covering verbosity & tone, hard resource/technical boundaries, and gap handling ("If critical info is missing, ask once. Otherwise state your assumptions.").
3. "outputFormat": Exact structural shape of the answer (e.g. format type, exact per-item schema separated by middle dots '·', and a closing decision gate or summary).

ZONE 2: MIDDLE — DATA, NOT INSTRUCTIONS
4. "context": Clean, factual background assumptions and a bracketed placeholder for long user material (e.g., "Subject/Product: ...\nTeam/Scope: ...\nKey risks: ...\n[paste relevant docs, data, or code here]"). Pure data—do NOT put instructions here.

ZONE 3: BOTTOM — THE ASK
5. "task": One clear, concrete request referencing the context above (e.g., "Build a [deliverable] for this [subject]. Validate [core assumption] first, then get it ready to execute.").
6. "finalInstruction": MUST start with "Based on the context above:" followed by a reasoning anchor (plan first, check against constraints, then answer) and an explicit "Done when:" stop condition with measurable criteria.

Do NOT include XML tags or Markdown headers inside the JSON field values themselves—the application wraps them consistently. Keep the writing crisp, practical, and free of filler.`;

    try {
        const structured = await window.PA.generateStructuredPrompt({
            systemPrompt,
            userPrompt: `Architect a Gemini Master Prompt from this simple idea:\n\n"${userIdea}"`,
            fieldNames: ["role", "constraints", "outputFormat", "context", "task", "finalInstruction"],
            schemaName: "gemini_master_prompt",
            themePrefix: "gemini"
        });
        if (!structured) return;

        // Populate fields smoothly in top-to-bottom order
        fields.role.value = structured.role;
        fields.constraints.value = structured.constraints;
        fields.output.value = structured.outputFormat;
        fields.context.value = structured.context;
        fields.task.value = structured.task;
        fields.final.value = structured.finalInstruction;

        updateCombinedPrompt();
        showStatus("Gemini Master Prompt architected across all 3 structural zones!", "success");

    } catch (error) {
        console.error("Prompt generation error:", error.message);
        showStatus(`Could not generate prompt: ${error.message}. Please try again.`, "error");
    } finally {
        generateBtn.disabled = false;
        generateBtnText.textContent = "Architect Gemini Prompt";
        Object.values(fields).forEach(el => el.classList.remove('animate-pulse-subtle'));
    }
}

// Allow Cmd+Enter or Ctrl+Enter inside input box to trigger generation
simplePromptInput.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        architectPrompt();
    }
});
