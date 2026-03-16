/**
 * Unified AI client — wraps Anthropic Claude and Google Gemini
 * behind a single interface.
 */

const SUPPORTED_MODELS = {
  'claude-opus-4-5':      'anthropic',
  'claude-sonnet-4-6':    'anthropic',
  'claude-haiku-4-5':     'anthropic',
  'gemini-2.5-flash':     'gemini',
  'gemini-2.5-flash-lite': 'gemini',
};

function getProvider(model) {
  return SUPPORTED_MODELS[model] || 'anthropic';
}

// Max output tokens each model actually supports
const MODEL_MAX_TOKENS = {
  'claude-opus-4-5':       16000,
  'claude-sonnet-4-6':     16000,
  'claude-haiku-4-5':      8192,
  'gemini-2.5-flash':      65536,  // Gemini 2.5 Flash supports up to 65k output tokens
  'gemini-2.5-flash-lite': 8192,
};

function createAIClient(model = 'claude-opus-4-5') {
  const provider = getProvider(model);
  const modelMax = MODEL_MAX_TOKENS[model] || 8192;

  return {
    model,
    provider,
    modelMax,

    async complete(system, user, maxTokens, options = {}) {
      // Always use the model's real max — never the old 4096 default
      const tokens = Math.min(maxTokens || modelMax, modelMax);
      if (provider === 'gemini') return callGemini(model, system, user, tokens, options);
      return callClaude(model, system, user, tokens, options);
    },
  };
}

// ── Anthropic ─────────────────────────────────────────────────────────────────

async function callClaude(model, system, user, maxTokens, options = {}) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const res = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });

  return res.content[0].text;
}

// ── Google Gemini ─────────────────────────────────────────────────────────────

async function callGemini(model, system, user, maxTokens, options = {}) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const isThinkingModel = model.startsWith('gemini-2.5');

  // Use model IDs exactly as provided — no remapping
  const genModel = genAI.getGenerativeModel({
    model,
    systemInstruction: system,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: options.isJson ? 0.2 : 0.4,
      // For JSON calls (tokenize step): disable thinking to avoid token waste + format issues
      // For code generation: allow thinking for better quality output
      ...(isThinkingModel && options.isJson
        ? { thinkingConfig: { thinkingBudget: 0 } }
        : {}),
      ...(options.isJson ? { responseMimeType: 'application/json' } : {}),
    },
  });

  const result = await genModel.generateContent(user);
  return result.response.text();
}

module.exports = { createAIClient, SUPPORTED_MODELS, getProvider };
