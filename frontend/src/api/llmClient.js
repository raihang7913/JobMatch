/**
 * LLM Client for CV Optimization
 * Dual-mode: Direct Cloud API (OpenAI/Gemini/Claude) + 9Router Local Gateway
 * Both modes use OpenAI-compatible /v1/chat/completions format.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin

// ── Direct Cloud Provider Config ──────────────────────────────────────────

const DIRECT_PROVIDERS = {
  OPENAI: 'openai',
  GEMINI: 'gemini',
  CLAUDE: 'claude',
};

// All direct providers now go through their OpenAI-compatible endpoint
const DIRECT_ENDPOINTS = {
  [DIRECT_PROVIDERS.OPENAI]: 'https://api.openai.com',
  [DIRECT_PROVIDERS.GEMINI]: 'https://generativelanguage.googleapis.com/v1beta/openai',
  [DIRECT_PROVIDERS.CLAUDE]: 'https://api.anthropic.com',
};

const DIRECT_MODELS = {
  [DIRECT_PROVIDERS.OPENAI]: 'gpt-3.5-turbo',
  [DIRECT_PROVIDERS.GEMINI]: 'gemini-2.0-flash',
  [DIRECT_PROVIDERS.CLAUDE]: 'claude-3-haiku-20240307',
};

// ── System Prompt (Hardened Boundaries) ───────────────────────────────────

const SYSTEM_PROMPT = `You are GaweAI CV Optimizer. Your job is to IMPROVE the TEXT CONTENT of the CV — NOT change its structure, layout, or template.

## CRITICAL RULES
1. ONLY improve wording, phrasing, and impact of existing text
2. DO NOT change the CV template, layout, section order, or formatting
3. DO NOT add new sections that don't exist in the original CV
4. DO NOT remove sections from the original CV
5. DO NOT reorder skills — keep them in the original order
6. DO NOT change factual information (names, dates, companies, roles)
7. ONLY rewrite descriptions to be more impactful and specific
8. Match the language of the CV (if CV is Indonesian, respond in Indonesian)

## WHAT TO RETURN
For experience_improvements: provide IMPROVED TEXT only, same structure as original
For summary_suggestion: provide an IMPROVED version of the existing summary (don't create new)
For skills_improvements: just suggest keywords to add, DON'T reorder
For overall_tips: provide ACTIONABLE specific tips about the existing content

## WHAT NOT TO DO
- Don't say "use action verbs" — just USE them in the improved text
- Don't say "quantify achievements" — just QUANTIFY them
- Don't say "reorder skills" — keep original order
- Don't create a new template — improve the existing one

## OUTPUT FORMAT
Return ONLY a valid JSON object matching the schema. No markdown, no explanations.`;

// ── User Prompt Builder ───────────────────────────────────────────────────

function buildUserPrompt(cvData, jobDescription) {
  const experienceBlock = cvData.experience?.map((exp, idx) =>
    `Index ${idx}: ${exp.title || 'N/A'} di ${exp.company || 'N/A'}\n   Periode: ${exp.dates || 'N/A'}\n   Deskripsi: ${exp.description || 'N/A'}`
  ).join('\n') || 'N/A';

  const educationBlock = cvData.education?.map((edu) =>
    `${edu.degree || 'N/A'} - ${edu.institution || 'N/A'} (${edu.dates || 'N/A'})`
  ).join('\n') || 'N/A';

  return `Optimize this CV for the given job description.

RULES:
- Only improve wording, impact, and keyword alignment
- Do NOT fabricate experiences or skills the candidate doesn't have
- Do NOT change factual information (names, dates, companies)
- Quantify achievements where possible (percentages, metrics, numbers)
- Use keywords from the job description naturally
- Keep the same structure as the original CV
- Use the exact zero-based Index shown in CV DATA for experience_improvements.index

CV DATA:
Nama: ${cvData.personal_info?.name || 'N/A'}
Skills: ${cvData.skills?.join(', ') || 'N/A'}

Experience:
${experienceBlock}

Education:
${educationBlock}

TARGET JOB:
${jobDescription}

Return ONLY this JSON schema:
{
  "experience_improvements": [
    {
      "index": 0,
      "original": "exact original text",
      "suggestion": "improved text",
      "reasoning": "why this improves the CV for this job"
    }
  ],
  "skills_improvements": {
    "skills_to_add": ["skill1"],
    "skills_to_prioritize": ["skill1"],
    "reasoning": "why these skills matter for this job"
  },
  "summary_suggestion": {
    "suggestion": "improved professional summary",
    "reasoning": "why this summary fits the job"
  },
  "overall_tips": ["tip1"]
}`;
}

// ── Unified LLM Call ──────────────────────────────────────────────────────

async function callLLM(systemPrompt, userPrompt) {
  const config = getStoredConfig();
  if (!config) throw new Error('AI backend belum dikonfigurasi.');

  let baseUrl, apiKey, model;

  if (config.mode === 'direct') {
    baseUrl = DIRECT_ENDPOINTS[config.direct.provider];
    apiKey = config.direct.apiKey;
    model = DIRECT_MODELS[config.direct.provider];
  } else {
    baseUrl = config.ninerouter.baseUrl.replace(/\/+$/, '');
    apiKey = config.ninerouter.apiKey;
    model = config.ninerouter.model;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  let data;
  if (config.mode === 'ninerouter') {
    // ponytail: call 9Router directly from browser (it has CORS headers)
    const url = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 2000, stream: false }),
    });
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      const err = new Error(errBody.error?.message || `LLM API error ${resp.status}`);
      err.status = resp.status;
      throw err;
    }
    data = await resp.json();
  } else {
    // Direct cloud API — use backend proxy to avoid CORS
    const proxyUrl = API_BASE_URL + '/api/llm-proxy';
    const resp = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_url: baseUrl, api_key: apiKey, model, messages }),
    });
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      const err = new Error(errBody.detail || errBody.error?.message || `LLM proxy error ${resp.status}`);
      err.status = resp.status;
      throw err;
    }
    data = await resp.json();
  }

  const msg = data.choices[0].message;
  return msg.content || msg.reasoning || JSON.stringify(msg);
}

// ── JSON Parser ───────────────────────────────────────────────────────────

function parseJsonResponse(rawContent) {
  try {
    // Handle SSE format: "data: {...}" 
    if (rawContent.includes('data:')) {
      const lines = rawContent.split('\n').filter(line => line.trim());
      for (const line of lines) {
        if (line.startsWith('data:')) {
          const jsonStr = line.substring(5).trim();
          if (jsonStr && jsonStr !== '[DONE]') {
            try { return JSON.parse(jsonStr); } catch { continue; }
          }
        }
      }
    }
    
    // Handle markdown code blocks: ```json ... ```
    const codeBlockMatch = rawContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) return JSON.parse(codeBlockMatch[1].trim());
    
    // Try direct JSON parse
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(rawContent);
  } catch {
    throw new Error('AI mengembalikan response yang tidak valid. Coba lagi.');
  }
}

// ── Output Validation & Sanitization ──────────────────────────────────────

function sanitize(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/<[^>]*>/g, '').trim();
}

export function validateOptimizationResult(result) {
  if (typeof result !== 'object' || result === null) return null;
  if (result.error) return null;

  if (Array.isArray(result.experience_improvements)) {
    result.experience_improvements = result.experience_improvements
      .filter((imp) => imp && typeof imp.index === 'number' && imp.suggestion)
      .map((imp) => ({
        ...imp,
        original: sanitize(imp.original),
        suggestion: sanitize(imp.suggestion),
        reasoning: sanitize(imp.reasoning),
      }));
  }

  if (result.skills_improvements) {
    result.skills_improvements.skills_to_add =
      (result.skills_improvements.skills_to_add || []).map(sanitize);
    result.skills_improvements.skills_to_prioritize =
      (result.skills_improvements.skills_to_prioritize || []).map(sanitize);
    result.skills_improvements.reasoning =
      sanitize(result.skills_improvements.reasoning);
  }

  if (result.summary_suggestion) {
    result.summary_suggestion.suggestion = sanitize(result.summary_suggestion.suggestion);
    result.summary_suggestion.reasoning = sanitize(result.summary_suggestion.reasoning);
  }

  if (Array.isArray(result.overall_tips)) {
    result.overall_tips = result.overall_tips.map(sanitize);
  }

  return result;
}

// ── Public API ────────────────────────────────────────────────────────────

export async function optimizeCV(cvData, jobDescription) {
  const userPrompt = buildUserPrompt(cvData, jobDescription);

  try {
    const raw = await callLLM(SYSTEM_PROMPT, userPrompt);
    const parsed = parseJsonResponse(raw);
    return validateOptimizationResult(parsed);
  } catch (error) {
    if (error.status === 401) throw new Error('API key tidak valid. Silakan cek kembali.');
    if (error.status === 429) throw new Error('Terlalu banyak request. Coba lagi sebentar.');
    if (error.status === 403) throw new Error('API key tidak memiliki akses. Cek quota atau billing.');
    throw new Error(error.message || 'Gagal mengoptimasi CV.');
  }
}

// ── Connection Test ───────────────────────────────────────────────────────

export async function testConnection() {
  const config = getStoredConfig();
  if (!config) return { valid: false, error: 'Belum dikonfigurasi.' };

  try {
    if (config.mode === 'direct') {
      return await testDirectConnection(config.direct);
    }
    return await test9RouterConnection(config.ninerouter);
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

async function testDirectConnection({ provider, apiKey }) {
  const baseUrl = DIRECT_ENDPOINTS[provider];

  if (provider === DIRECT_PROVIDERS.CLAUDE) {
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: DIRECT_MODELS[provider],
        max_tokens: 5,
        messages: [{ role: 'user', content: 'Test' }],
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `HTTP ${response.status}`);
    }
    return { valid: true };
  }

  // OpenAI and Gemini use OpenAI-compatible chat/completions
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: DIRECT_MODELS[provider],
      messages: [{ role: 'user', content: 'Test' }],
      max_tokens: 5,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }
  return { valid: true };
}

async function test9RouterConnection({ baseUrl, apiKey }) {
  // ponytail: call 9Router directly from browser (it has CORS headers)
  const url = baseUrl.replace(/\/+$/, '');
  const endpoint = url.endsWith('/v1') ? `${url}/chat/completions` : `${url}/v1/chat/completions`;
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'oc/mimo-v2.5-free',
      messages: [{ role: 'user', content: 'Reply with OK' }],
      max_tokens: 5,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }
  
  return { valid: true };
}

// ── Storage (Dual-Mode) ───────────────────────────────────────────────────

export function getStoredConfig() {
  // Migrate away from old schema
  const oldKey = localStorage.getItem('cv_optimizer_api_key');
  if (oldKey) {
    localStorage.removeItem('cv_optimizer_api_key');
    localStorage.removeItem('cv_optimizer_provider');
    localStorage.removeItem('cv_optimizer_key_valid');
    return null;
  }

  const mode = localStorage.getItem('llm_config_mode');
  if (!mode) return null;

  if (mode === 'direct') {
    const provider = localStorage.getItem('llm_direct_provider');
    const apiKey = localStorage.getItem('llm_direct_api_key');
    if (!provider || !apiKey) return null;
    return { mode: 'direct', direct: { provider, apiKey } };
  }

  if (mode === 'ninerouter') {
    const baseUrl = localStorage.getItem('llm_ninerouter_url');
    const apiKey = localStorage.getItem('llm_ninerouter_api_key');
    const model = localStorage.getItem('llm_ninerouter_model');
    if (!baseUrl) return null;
    return { mode: 'ninerouter', ninerouter: { baseUrl, apiKey: apiKey || '', model: model || 'vip' } };
  }

  return null;
}

export function saveDirectConfig(provider, apiKey) {
  localStorage.setItem('llm_config_mode', 'direct');
  localStorage.setItem('llm_direct_provider', provider);
  localStorage.setItem('llm_direct_api_key', apiKey);
  localStorage.removeItem('llm_ninerouter_url');
  localStorage.removeItem('llm_ninerouter_api_key');
  localStorage.removeItem('llm_ninerouter_model');
}

export function save9RouterConfig(baseUrl, apiKey, model) {
  localStorage.setItem('llm_config_mode', 'ninerouter');
  localStorage.setItem('llm_ninerouter_url', baseUrl.replace(/\/+$/, ''));
  localStorage.setItem('llm_ninerouter_api_key', apiKey);
  localStorage.setItem('llm_ninerouter_model', model || 'vip');
  localStorage.removeItem('llm_direct_provider');
  localStorage.removeItem('llm_direct_api_key');
}

export function clearConfig() {
  localStorage.removeItem('llm_config_mode');
  localStorage.removeItem('llm_direct_provider');
  localStorage.removeItem('llm_direct_api_key');
  localStorage.removeItem('llm_ninerouter_url');
  localStorage.removeItem('llm_ninerouter_api_key');
  localStorage.removeItem('llm_ninerouter_model');
}

export function hasConfig() {
  return getStoredConfig() !== null;
}

export { DIRECT_PROVIDERS, DIRECT_ENDPOINTS, DIRECT_MODELS };
