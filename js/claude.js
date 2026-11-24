// Initialize Lucide icons
window.PA.initIcons();

// State management
let formatMode = 'clean'; // 'clean' or 'xml'

// DOM Elements
const fields = {
    role: document.getElementById('field-role'),
    task: document.getElementById('field-task'),
    context: document.getElementById('field-context'),
    reasoning: document.getElementById('field-reasoning'),
    stop: document.getElementById('field-stop'),
    output: document.getElementById('field-output'),
};

const compiledOutputEl = document.getElementById('compiledOutput');
const charCountLabel = document.getElementById('charCountLabel');
const simplePromptInput = document.getElementById('simplePromptInput');
const generateBtn = document.getElementById('generateBtn');
const generateBtnText = document.getElementById('generateBtnText');

// Exact example from the user's reference image ("The Anatomy of a Claude prompt")
const blueprintExample = {
    idea: "Build a 90-day launch plan for my new AI task manager for founders with a 2-person team and lean budget.",
    role: "Act as a senior go-to-market strategist with deep expertise launching early-stage SaaS tools. Prioritize traction speed over brand perfection.",
    task: "Build a 90-day launch plan for a new AI productivity tool for founders. Validate the core messaging, end with a launch-ready brief.",
    context: "Here’s what I know:\n-Product: AI task manager for founders (25-40).\n-Team: 2-person (Founder + Growth marketer).\n-Resources: Lean budget, 15-20 beta users.\n-Key Risks: Adoption, Retention, Positioning.",
    reasoning: "The goal is a crisp, launch-ready strategy. By locking in ICP clarity upfront and asking you to defend each step, the output will be truly actionable and founder-grade.",
    stop: "Only stop when:\n-A 12-week roadmap with 3-4 actions/week.\n-Every action links to the risk it addresses.\n-Plan ends with a final Launch Decision Gate.",
    output: "Present as a weekly sprint plan. For each action:\n-Action: The specific task to complete.\n-Owner: Founder, Growth lead, or Designer.\n-Risk: Adoption, Retention, or Positioning.\n-Rationale + Output: reasoning, deliverable."
};

// Load the example into the UI on initial visit so user sees the structure immediately
window.addEventListener('DOMContentLoaded', () => {
    window.PA.initApiSettings('claude');
    loadExampleData(false);
});

function showStatus(message, type = 'info') {
    window.PA.showStatus(message, type, 'claude');
}

function hideStatus() {
    window.PA.hideStatus();
}

function loadExampleData(showNotification = true) {
    simplePromptInput.value = blueprintExample.idea;
    fields.role.value = blueprintExample.role;
    fields.task.value = blueprintExample.task;
    fields.context.value = blueprintExample.context;
    fields.reasoning.value = blueprintExample.reasoning;
    fields.stop.value = blueprintExample.stop;
    fields.output.value = blueprintExample.output;
    updateCombinedPrompt();
    if (showNotification) {
        showStatus("Loaded the reference blueprint example.", "info");
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
    const cleanBtn = document.getElementById('formatCleanBtn');
    const xmlBtn = document.getElementById('formatXmlBtn');

    if (mode === 'clean') {
        cleanBtn.className = "text-xs px-2.5 py-1 rounded-md bg-claude-surfaceHover text-claude-text font-medium transition";
        xmlBtn.className = "text-xs px-2.5 py-1 rounded-md text-claude-muted hover:text-claude-text transition";
    } else {
        xmlBtn.className = "text-xs px-2.5 py-1 rounded-md bg-claude-surfaceHover text-claude-text font-medium transition";
        cleanBtn.className = "text-xs px-2.5 py-1 rounded-md text-claude-muted hover:text-claude-text transition";
    }
    updateCombinedPrompt();
}

function updateCombinedPrompt() {
    const r = fields.role.value.trim();
    const t = fields.task.value.trim();
    const c = fields.context.value.trim();
    const re = fields.reasoning.value.trim();
    const s = fields.stop.value.trim();
    const o = fields.output.value.trim();

    if (!r && !t && !c && !re && !s && !o) {
        compiledOutputEl.textContent = "Your architected master prompt will appear here once generated or edited...";
        compiledOutputEl.classList.add('text-claude-muted');
        compiledOutputEl.classList.remove('text-claude-text');
        charCountLabel.textContent = "0 chars";
        return;
    }

    compiledOutputEl.classList.remove('text-claude-muted');
    compiledOutputEl.classList.add('text-claude-text');

    let compiled = "";

    if (formatMode === 'clean') {
        const parts = [r, t, c, re, s, o].filter(Boolean);
        compiled = parts.join("\n\n");
    } else {
        const xmlParts = [];
        if (r) xmlParts.push(`<role>\n${r}\n</role>`);
        if (t) xmlParts.push(`<task>\n${t}\n</task>`);
        if (c) xmlParts.push(`<context>\n${c}\n</context>`);
        if (re) xmlParts.push(`<reasoning>\n${re}\n</reasoning>`);
        if (s) xmlParts.push(`<stop_conditions>\n${s}\n</stop_conditions>`);
        if (o) xmlParts.push(`<output_format>\n${o}\n</output_format>`);
        compiled = xmlParts.join("\n\n");
    }

    compiledOutputEl.textContent = compiled;
    charCountLabel.textContent = `${compiled.length.toLocaleString()} chars`;
}

function copyMasterPrompt() {
    const textToCopy = compiledOutputEl.textContent;
    if (!textToCopy || textToCopy.startsWith("Your architected master prompt")) {
        showStatus("Nothing to copy yet. Generate or enter a prompt first.", "info");
        return;
    }
    window.PA.copyText(textToCopy, "Master prompt copied to clipboard!", "claude");
}

async function architectPrompt() {
    if (generateBtn.disabled) return;
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

    const systemPrompt = `You are an elite Prompt Engineer specializing in Claude's structured prompt anatomy. 
Your job is to take a user's simple, brief prompt idea and expand it into a comprehensive, high-leverage Master Prompt strictly following these 6 distinct components:

1. "role": Define the expert persona, deep domain expertise, and a clear guiding trade-off/priority (e.g., "Act as a senior [role] with deep expertise in [domain]. Prioritize [X] over [Y].").
2. "task": State the exact concrete deliverable, target audience, core validation requirement, and final closing artifact (e.g., "Build a [deliverable] for [audience]. Validate [core element], end with a [final brief/summary].").
3. "context": Extrapolate realistic, high-signal background assumptions if the user didn't provide them, formatted cleanly starting with "Here's what I know:" followed by 4 concise bullet points (-Product/Subject, -Team/Scope, -Resources/Constraints, -Key Risks).
4. "reasoning": Define the quality bar and strategic thinking rule (e.g., "The goal is a crisp, [quality]-ready output. By locking in [key clarity] upfront and asking you to defend each step, the output will be truly actionable and [expert]-grade.").
5. "stopConditions": Define strict completion guardrails starting with "Only stop when:" followed by 3 specific, measurable completion criteria and a final verification gate.
6. "output": Define the exact structural format for every item/section starting with "Present as [format]. For each [unit]:" followed by 4 structured bullet points specifying exact fields (e.g., -Action/Element, -Owner/Category, -Risk/Criteria, -Rationale + Output).

Keep the tone sharp, executive, practical, and free of fluff. Every section should seamlessly connect to the others as one cohesive master prompt.`;

    try {
        const structured = await window.PA.generateStructuredPrompt({
            systemPrompt,
            userPrompt: `Transform this simple user request into a 6-part structured Master Prompt:\n\n"${userIdea}"`,
            fieldNames: ["role", "task", "context", "reasoning", "stopConditions", "output"],
            schemaName: "claude_master_prompt",
            themePrefix: "claude"
        });
        if (!structured) return;

        // Populate fields smoothly
        fields.role.value = structured.role;
        fields.task.value = structured.task;
        fields.context.value = structured.context;
        fields.reasoning.value = structured.reasoning;
        fields.stop.value = structured.stopConditions;
        fields.output.value = structured.output;

        updateCombinedPrompt();
        showStatus("Master prompt architected across all 6 structural layers!", "success");

    } catch (error) {
        console.error("Prompt generation error:", error.message);
        showStatus(`Could not generate prompt: ${error.message}. Please try again.`, "error");
    } finally {
        generateBtn.disabled = false;
        generateBtnText.textContent = "Architect Master Prompt";
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
