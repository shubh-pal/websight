/**
 * Unified AI client — wraps Anthropic Claude, Google Gemini,
 * OpenAI, Groq, and DeepSeek behind a single interface.
 */

const SUPPORTED_MODELS = {
  // Anthropic
  'claude-opus-4-5':        'anthropic',
  'claude-sonnet-4-6':      'anthropic',
  'claude-haiku-4-5':       'anthropic',
  // Google
  'gemini-2.5-pro':         'gemini',
  'gemini-2.5-flash':       'gemini',
  'gemini-2.5-flash-lite':  'gemini',
  // OpenAI
  'gpt-4o':                 'openai',
  'gpt-4o-mini':            'openai',
  // Groq (free tier — fastest inference)
  'llama-3.3-70b-versatile': 'groq',
  'llama-3.1-8b-instant':    'groq',
  // DeepSeek (cheapest, great code quality)
  'deepseek-chat':           'deepseek',
};

function getProvider(model) {
  return SUPPORTED_MODELS[model] || 'anthropic';
}

// Max output tokens each model actually supports
const MODEL_MAX_TOKENS = {
  'claude-opus-4-5':         16000,
  'claude-sonnet-4-6':       16000,
  'claude-haiku-4-5':        8192,
  'gemini-2.5-pro':          65536,
  'gemini-2.5-flash':        65536,
  'gemini-2.5-flash-lite':   8192,
  'gpt-4o':                  16384,
  'gpt-4o-mini':             16384,
  'llama-3.3-70b-versatile': 32768,
  'llama-3.1-8b-instant':    8192,
  'deepseek-chat':           8192,
};

function createAIClient(model = 'claude-opus-4-5') {
  const provider = getProvider(model);
  const modelMax = MODEL_MAX_TOKENS[model] || 8192;

  return {
    model,
    provider,
    modelMax,

    async complete(system, user, maxTokens, options = {}) {
      const tokens = Math.min(maxTokens || modelMax, modelMax);
      if (provider === 'gemini')   return callGemini(model, system, user, tokens, options);
      if (provider === 'openai')   return callOpenAICompat('openai',   model, system, user, tokens, options);
      if (provider === 'groq')     return callOpenAICompat('groq',     model, system, user, tokens, options);
      if (provider === 'deepseek') return callOpenAICompat('deepseek', model, system, user, tokens, options);
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

// ── OpenAI-compatible (OpenAI / Groq / DeepSeek) ─────────────────────────────

const OPENAI_COMPAT_CONFIG = {
  openai:   { baseURL: 'https://api.openai.com/v1',        envKey: 'OPENAI_API_KEY'   },
  groq:     { baseURL: 'https://api.groq.com/openai/v1',   envKey: 'GROQ_API_KEY'     },
  deepseek: { baseURL: 'https://api.deepseek.com',         envKey: 'DEEPSEEK_API_KEY' },
};

async function callOpenAICompat(provider, model, system, user, maxTokens, options = {}) {
  const { OpenAI } = require('openai');
  const { baseURL, envKey } = OPENAI_COMPAT_CONFIG[provider];
  const apiKey = process.env[envKey];
  if (!apiKey) throw new Error(`${envKey} is not set in environment`);

  const client = new OpenAI({ apiKey, baseURL });

  const res = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    temperature: options.isJson ? 0.2 : 0.4,
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user   },
    ],
    ...(options.isJson ? { response_format: { type: 'json_object' } } : {}),
  });

  return res.choices[0].message.content;
}

module.exports = { createAIClient, SUPPORTED_MODELS, getProvider };
