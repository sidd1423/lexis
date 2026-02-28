// ── MODES ────────────────────────────────────────────────────────────────
const MODES = {
  default: {
    label: "Default",
    desc: "Balanced, general-purpose assessment of clarity, tone, structure, and effectiveness — suitable for any writing context.",
    placeholder: "Paste any writing here for a general style assessment...",
    focus: "Apply a balanced, general-purpose analysis. Evaluate clarity, tone, structure, and effectiveness for a broad audience. Score formality relative to a general-audience standard.",
    labels: { clarity: "Clarity", formality: "Tone", coherence: "Coherence", lexical: "Vocabulary" },
  },
  academic: {
    label: "Academic",
    desc: "Evaluates against academic writing standards — formality, citation practice, argument structure, and scholarly register.",
    placeholder: "Paste your academic writing — essays, research papers, theses, journal articles...",
    focus: "Evaluate strictly against academic writing conventions. Penalize colloquialisms, vague claims, missing hedges, poor signposting, and lack of citation cues. Reward formal register, nuanced argumentation, and disciplinary vocabulary.",
    labels: { clarity: "Clarity", formality: "Formality", coherence: "Argument", lexical: "Lexical" },
  },
  creative: {
    label: "Creative",
    desc: "Focuses on voice, imagery, originality, pacing, and narrative craft. Ideal for fiction, poetry, and creative nonfiction.",
    placeholder: "Paste your creative writing — fiction, poetry, personal essays, narratives...",
    focus: "Evaluate as a creative writing editor. Assess voice distinctiveness, imagery richness, sentence rhythm and variety, show-vs-tell balance, pacing, and originality. Score formality as voice consistency — do not penalize informal register. Reward surprising word choices, vivid specificity, and narrative momentum.",
    labels: { clarity: "Clarity", formality: "Voice", coherence: "Pacing", lexical: "Imagery" },
  },
  personal: {
    label: "Personal",
    desc: "Assesses warmth, authenticity, and relatability. Best for emails, cover letters, personal statements, and blogs.",
    placeholder: "Paste your personal writing — cover letters, emails, blogs, personal statements...",
    focus: "Evaluate as a communications coach. Look for authenticity, warmth, appropriate self-disclosure, clear personal voice, and reader-friendly flow. Penalize over-formality or jargon. Reward genuine personality, clear intent, and relatable phrasing.",
    labels: { clarity: "Clarity", formality: "Warmth", coherence: "Flow", lexical: "Voice" },
  },
};

// ── DOM REFS ─────────────────────────────────────────────────────────────
const textarea      = document.getElementById("textInput");
const wordCountEl   = document.getElementById("wordCount");
const analyzeBtn    = document.getElementById("analyzeBtn");
const loadingEl     = document.getElementById("loading");
const loadingTextEl = document.getElementById("loadingText");
const resultsEl     = document.getElementById("results");
const errorBox      = document.getElementById("errorBox");

// ── STATE ───────────────────────────────────────────────────────────────
let currentMode = "default";

// ── MODE SWITCHER ────────────────────────────────────────────────────────
function setMode(mode) {
  currentMode = mode;
  document.querySelectorAll(".mode-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.mode === mode)
  );
  document.getElementById("modeDesc").textContent = MODES[mode].desc;
  textarea.placeholder = MODES[mode].placeholder;
}

// ── INIT ─────────────────────────────────────────────────────────────────
setMode("default");
analyzeBtn.disabled = true;

textarea.addEventListener("input", () => {
  const words = textarea.value.trim() ? textarea.value.trim().split(/\s+/).length : 0;
  wordCountEl.textContent = `${words} word${words !== 1 ? "s" : ""}`;
  analyzeBtn.disabled = words < 30;
});

// ── LOADING MESSAGES ─────────────────────────────────────────────────────
const loadingMessages = [
  "Parsing syntactic structures...",
  "Running transformer inference...",
  "Calibrating mode-specific rubric...",
  "Scoring lexical patterns...",
  "Composing AI summary...",
  "Generating feedback...",
];

// ── ANALYZE ─────────────────────────────────────────────────────────────
async function analyzeText() {
  const text = textarea.value.trim();
  if (!text) return;

  const mode = MODES[currentMode];

  analyzeBtn.disabled = true;
  errorBox.classList.remove("visible");
  resultsEl.classList.remove("visible");
  loadingEl.classList.add("visible");

  let msgIdx = 0;
  const msgInterval = setInterval(() => {
    msgIdx = (msgIdx + 1) % loadingMessages.length;
    loadingTextEl.textContent = loadingMessages[msgIdx];
  }, 1100);

  try {
    // FRONT-END now calls backend endpoint instead of Gemini API directly
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, mode: currentMode }),
    });

    clearInterval(msgInterval);
    loadingEl.classList.remove("visible");

    if (!response.ok) throw new Error(`API error ${response.status}`);

    const data  = await response.json();
    const raw   = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);
    renderResults(result, mode);

  } catch (err) {
    clearInterval(msgInterval);
    loadingEl.classList.remove("visible");
    errorBox.textContent = `Analysis failed: ${err.message}. Please try again.`;
    errorBox.classList.add("visible");
    analyzeBtn.disabled = false;
  }
}

// ── PROMPT BUILDER ────────────────────────────────────────────────────────────
function buildPrompt(mode) {
  return `You are Lexis, an NLP writing style analyzer. Output ONLY valid JSON — no markdown fences, no preamble.

CURRENT MODE: ${currentMode.toUpperCase()}
MODE FOCUS: ${mode.focus}

Score dimension labels for this mode:
  clarity   -> "${mode.labels.clarity}"
  formality -> "${mode.labels.formality}"
  coherence -> "${mode.labels.coherence}"
  lexical   -> "${mode.labels.lexical}"

Return EXACTLY this JSON structure:
{
  "ai_summary": {
    "headline": "<One punchy, specific verdict sentence — reference the actual text, not generic praise/criticism>",
    "narrative": "<3-4 sentences of detailed editorial prose. Act like a real editor. Name specific patterns, word choices, or structural habits you observe in this text. Be direct and useful.>",
    "verdict": "<One closing sentence: the single most important thing this writer should do next, tailored to ${currentMode} mode>"
  },
  "scores": {
    "clarity": <0-100 integer>,
    "formality": <0-100 integer>,
    "coherence": <0-100 integer>,
    "lexical": <0-100 integer>
  },
  "metrics": {
    "avg_sentence_length": "<N words>",
    "vocabulary_richness": "<0.00-1.00>",
    "passive_voice_pct": "<N%>",
    "hedging_density": "<low|medium|high>",
    "nominalization": "<low|medium|high>",
    "reading_level": "<e.g. Grade 10 / Undergraduate>"
  },
  "style_tags": ["<tag1>","<tag2>","<tag3>"],
  "strengths": [
    {"title":"...","detail":"..."},
    {"title":"...","detail":"..."}
  ],
  "issues": [
    {"title":"...","detail":"...","severity":"high|medium|low"},
    {"title":"...","detail":"...","severity":"high|medium|low"}
  ],
  "action_items": [
    {"title":"...","description":"...","priority":"high|medium|low"},
    {"title":"...","description":"...","priority":"high|medium|low"},
    {"title":"...","description":"...","priority":"high|medium|low"},
    {"title":"...","description":"...","priority":"high|medium|low"}
  ],
  "overall_profile": "<2 sentence style summary>"
}

Be specific to THIS text. Return ONLY the JSON object.`;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function scoreColor(s) {
  if (s >= 75) return "var(--green)";
  if (s >= 50) return "var(--accent)";
  return "var(--red)";
}

function scoreGrade(s) {
  if (s >= 85) return "Excellent";
  if (s >= 70) return "Strong";
  if (s >= 55) return "Adequate";
  if (s >= 40) return "Weak";
  return "Poor";
}

// ── RENDERER ──────────────────────────────────────────────────────────────────
function renderResults(r, mode) {
  const { ai_summary, scores, metrics, style_tags, strengths, issues, action_items, overall_profile } = r;
  const tagColors = ["#5b82b0","#8b6dac","#5a9e6e","#c8b560","#c4604a"];

  const scoreDefs = [
    { key: "clarity",   label: mode.labels.clarity   },
    { key: "formality", label: mode.labels.formality  },
    { key: "coherence", label: mode.labels.coherence  },
    { key: "lexical",   label: mode.labels.lexical    },
  ];

  // Mode badge icon (inline SVG strings)
  const modeIcons = {
    default:  `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6m0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8"/><path d="M9.5 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0"/></svg>`,
    academic: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M6 1h6v7a.5.5 0 0 1-.757.429L9 7.083 6.757 8.43A.5.5 0 0 1 6 8z"/><path d="M3 0h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-1h1v1a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v1H1V2a2 2 0 0 1 2-2"/><path d="M1 5v-.5a.5.5 0 0 1 1 0V5h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1zm0 3v-.5a.5.5 0 0 1 1 0V8h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1zm0 3v-.5a.5.5 0 0 1 1 0v.5h.5a.5.5 0 0 1 0 1h-2a.5.5 0 0 1 0-1z"/></svg>`,
    creative: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16"><path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.73 1.73 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.73 1.73 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.73 1.73 0 0 0 3.407 2.31z"/></svg>`,
    personal: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" viewBox="0 0 16 16"><path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6"/></svg>`,
  };

  const tagsHtml = (style_tags || []).map((t, i) => {
    const c = tagColors[i % tagColors.length];
    return `<span class="style-tag" style="color:${c};border-color:${c}40">${t}</span>`;
  }).join("");

  const metricItems = Object.entries(metrics).map(([k, v]) => {
    const label = k.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
    return `<div class="metric"><span class="metric-name">${label}</span><span class="metric-val">${v}</span></div>`;
  }).join("");

  const strengthsHtml = (strengths || []).map(s => `
    <div class="feedback-item positive">
      <span class="feedback-icon">✓</span>
      <div class="feedback-text"><strong>${s.title}</strong>${s.detail}</div>
    </div>`).join("");

  const issuesHtml = (issues || []).map(s => {
    const cls  = s.severity === "high" ? "negative" : s.severity === "medium" ? "warning" : "positive";
    const icon = s.severity === "high" ? "!"          : s.severity === "medium" ? "~"       : "·";
    return `
    <div class="feedback-item ${cls}">
      <span class="feedback-icon">${icon}</span>
      <div class="feedback-text"><strong>${s.title}</strong>${s.detail}</div>
    </div>`;
  }).join("");

  const actionsHtml = (action_items || []).map((a, i) => {
    const pcls = a.priority === "high" ? "priority-high" : a.priority === "medium" ? "priority-med" : "priority-low";
    return `
    <div class="action-item">
      <div class="action-num">${String(i + 1).padStart(2, "0")}</div>
      <div>
        <div class="action-title">${a.title}<span class="action-priority ${pcls}">${a.priority}</span></div>
        <div class="action-desc">${a.description}</div>
      </div>
    </div>`;
  }).join("");

  resultsEl.innerHTML = `
    <div class="result-mode-badge">
      ${modeIcons[currentMode]} &nbsp;${MODES[currentMode].label} Mode
    </div>

    <div class="ai-summary">
      <div class="ai-summary-label">✦ &nbsp;AI Summary</div>
      <div class="ai-summary-headline">"${ai_summary.headline}"</div>
      <div class="ai-summary-narrative">${ai_summary.narrative}</div>
      <div class="ai-summary-verdict"><strong>Next step →</strong> ${ai_summary.verdict}</div>
    </div>

    <div class="score-row">
      ${scoreDefs.map(d => `
        <div class="score-card">
          <div class="score-label">${d.label}</div>
          <div class="score-value" style="color:${scoreColor(scores[d.key])}">${scores[d.key]}</div>
          <div class="score-subtext">${scoreGrade(scores[d.key])}</div>
          <div class="score-bar">
            <div class="score-fill" id="fill-${d.key}" style="background:${scoreColor(scores[d.key])}"></div>
          </div>
        </div>`).join("")}
    </div>

    <div class="two-col">
      <div class="panel">
        <div class="section-title">Style Profile</div>
        <div class="style-tags">${tagsHtml}</div>
        <p style="font-size:0.86rem;line-height:1.75;color:var(--text-muted)">${overall_profile}</p>
      </div>
      <div class="panel">
        <div class="section-title">Metrics</div>
        <div class="metrics-grid">${metricItems}</div>
      </div>
    </div>

    <div class="two-col">
      <div class="panel">
        <div class="section-title">Strengths</div>
        <div class="feedback-list">${strengthsHtml}</div>
      </div>
      <div class="panel">
        <div class="section-title">Issues Detected</div>
        <div class="feedback-list">${issuesHtml}</div>
      </div>
    </div>

    <div class="actions-section">
      <div class="section-title">Actionable Recommendations</div>
      ${actionsHtml}
    </div>
  `;

  resultsEl.classList.add("visible");
  analyzeBtn.disabled = false;

  // Animate score bars
  requestAnimationFrame(() => {
    scoreDefs.forEach(d => {
      const el = document.getElementById(`fill-${d.key}`);
      if (el) setTimeout(() => el.style.width = scores[d.key] + "%", 80);
    });
  });

  // Scroll to results
  setTimeout(() => resultsEl.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
}