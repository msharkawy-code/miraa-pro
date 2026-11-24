export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, meta, engine = 'auto' } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Optional Google Sheets Lead Logging
    const sheetUrl = process.env.GOOGLE_SHEET_URL;
    if (sheetUrl && meta) {
      fetch(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...meta, engine, date: new Date().toISOString() })
      }).catch(() => {});
    }

    const systemInstruction = `أنت "مِرآة برو V5" (MIRAA Pro)، محرك ذكاء تسويقي وتشخيصي متقدم بإشراف الخبير محمد الشرقاوي.
مهمتك: تقديم تشخيص تجاري وتسويقي عميق + دراسة تحليلية دقيقة للمنافسين في نفس السوق والقطاع.
قواعد صارمة:
1. ممنوع تماماً النصائح العامة المكررة مثل: "انشر بانتظام" أو "حسّن الصور".
2. اربط كل جملة باسم النشاط، مدينته، قطاعه، شريحة أسعاره، وميزته التنافسية.
3. في دراسة المنافسين (competitorAnalysis): حلل 3 فئات/نماذج منافسين حقيقيين في نفس المدينة والقطاع، واذكر نقطة قوة كل منافس، نقطة ضعفه، وكيف يتفوق عليه العميل بذكاء، بالإضافة إلى فجوة السوق الذهبية (marketGap).
4. في الأبعاد الستة (MIRAA 6D): اذكر الدرجة (0-100)، التشخيص، الدليل المرصود، والتوصية العملية المحددة.
5. أرجع JSON صالح 100% فقط بدون أي نص خارجي أو علامات markdown.`;

    const providers = buildProviderQueue(engine);
    if (providers.length === 0) {
      return res.status(500).json({
        error: 'لم يتم العثور على أي مفتاح API في Vercel. أضف GEMINI_API_KEY أو OPENAI_API_KEY أو GROQ_API_KEY.'
      });
    }

    let lastError = 'تعذر الاتصال بنماذج الذكاء الاصطناعي حالياً.';

    for (const p of providers) {
      try {
        const resultText = await callProviderJSON(p, systemInstruction, prompt);
        if (resultText) {
          return res.status(200).json({
            text: resultText,
            usedModel: p.label
          });
        }
      } catch (err) {
        lastError = err.message || lastError;
      }
    }

    return res.status(503).json({
      error: `ضغط مؤقت على جميع النماذج المتاحة (${lastError}). حاول مرة أخرى بعد ثوانٍ.`
    });
  } catch (err) {
    return res.status(500).json({ error: 'حدث خطأ داخلي في الخادم', details: err.message });
  }
}

function buildProviderQueue(engine) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  const all = [];
  if (geminiKey) {
    all.push({ type: 'gemini', model: 'gemini-3.8-flash', key: geminiKey, label: 'Gemini 3.8 Flash' });
    all.push({ type: 'gemini', model: 'gemini-3.5-flash-lite', key: geminiKey, label: 'gemini-3.5-flash-lite' });
  }
  if (groqKey) {
    all.push({ type: 'groq', model: 'llama-3.3-70b-versatile', key: groqKey, label: 'Groq Llama 3.3 70B' });
  }
  if (openaiKey) {
    all.push({ type: 'openai', model: 'gpt-4o-mini', key: openaiKey, label: 'OpenAI GPT-4o Mini' });
  }

  if (engine === 'openai' && openaiKey) {
    return [
      { type: 'openai', model: 'gpt-4o-mini', key: openaiKey, label: 'OpenAI GPT-4o Mini' },
      ...all.filter(x => x.type !== 'openai')
    ];
  }
  if (engine === 'groq' && groqKey) {
    return [
      { type: 'groq', model: 'llama-3.3-70b-versatile', key: groqKey, label: 'Groq Llama 3.3 70B' },
      ...all.filter(x => x.type !== 'groq')
    ];
  }
  if (engine === 'gemini-lite' && geminiKey) {
    return [
      { type: 'gemini', model: 'gemini-2.5-flash-lite', key: geminiKey, label: 'Gemini 2.5 Flash Lite' },
      ...all.filter(x => x.model !== 'gemini-2.5-flash-lite')
    ];
  }
  return all;
}

async function callProviderJSON(p, systemInstruction, prompt) {
  if (p.type === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${p.model}:generateContent?key=${p.key}`;
    for (let i = 0; i < 2; i++) {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.45 }
        })
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (txt) return txt;
      }
      if ((r.status === 503 || r.status === 429) && i === 0) {
        await new Promise(res => setTimeout(res, 1200));
        continue;
      }
      throw new Error(d?.error?.message || `Gemini ${r.status}`);
    }
  }

  if (p.type === 'openai' || p.type === 'groq') {
    const endpoint = p.type === 'openai'
      ? 'https://api.openai.com/v1/chat/completions'
      : 'https://api.groq.com/openai/v1/chat/completions';
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${p.key}`
      },
      body: JSON.stringify({
        model: p.model,
        temperature: 0.45,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ]
      })
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      const txt = d?.choices?.[0]?.message?.content;
      if (txt) return txt;
    }
    throw new Error(d?.error?.message || `${p.type} ${r.status}`);
  }
  return null;
}
