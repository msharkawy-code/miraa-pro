export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, reportContext, engine = 'auto' } = req.body || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    let contextText = '';
    if (reportContext && reportContext.name) {
      contextText = `
بيانات تقرير العميل الحالي:
- النشاط/الرابط: ${reportContext.name}
- التقييم: ${reportContext.overallScore || ''}/100
- الملخص: ${reportContext.summary || ''}`;
    }

    const systemInstruction = `أنت "مِرآة برو"، المساعد التسويقي الذكي السريع بإشراف الخبير محمد الشرقاوي.
أجب باللغة العربية الواضحة والمباشرة بإيجاز ذكي (3 إلى 5 أسطر) لتكون الإجابة سريعة القراءة والاستماع الصوتي.
ساعد العميل في فهم تقريره، تحليل SWOT، تحليل منافسيه، وزيادة مبيعاته، ووجهه لواتساب الخبير (00201005535574) عند طلب تنفيذ أو باقات.${contextText}`;

    const providers = buildChatQueue(engine);
    if (providers.length === 0) {
      return res.status(500).json({ error: 'لم يتم إضافة أي مفتاح API في Vercel.' });
    }

    for (const p of providers) {
      try {
        const reply = await callChatProvider(p, systemInstruction, messages.slice(-8));
        if (reply) {
          return res.status(200).json({ reply, usedModel: p.label });
        }
      } catch {}
    }

    return res.status(503).json({
      error: 'يوجد ضغط مؤقت على خوادم الذكاء الاصطناعي، أعد إرسال سؤالك بعد ثوانٍ.'
    });
  } catch {
    return res.status(500).json({ error: 'تعذر الاتصال بالمساعد الذكي حالياً.' });
  }
}

function buildChatQueue(engine) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const all = [];
  if (groqKey) all.push({ type: 'groq', model: 'llama-3.3-70b-versatile', key: groqKey, label: 'Groq Fast' });
  if (geminiKey) {
    all.push({ type: 'gemini', model: 'gemini-3.8-flash', key: geminiKey, label: 'Gemini 3.8 Flash' });
    all.push({ type: 'gemini', model: 'gemini-3.5-flash-lite', key: geminiKey, label: 'Gemini 3.5 Lite' });
  }
  if (openaiKey) all.push({ type: 'openai', model: 'gpt-4o-mini', key: openaiKey, label: 'GPT-4o Mini' });

  if (engine === 'openai' && openaiKey) {
    return [{ type: 'openai', model: 'gpt-4o-mini', key: openaiKey, label: 'GPT-4o Mini' }, ...all.filter(x => x.type !== 'openai')];
  }
  if (engine === 'gemini-lite' && geminiKey) {
    return [{ type: 'gemini', model: 'gemini-3.5-flash-lite', key: geminiKey, label: 'Gemini 3.5 Lite' }, ...all.filter(x => x.model !== 'gemini-3.5-flash-lite')];
  }
  return all;
}

async function callChatProvider(p, systemInstruction, msgs) {
  if (p.type === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${p.model}:generateContent?key=${p.key}`;
    const contents = msgs.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: String(m.text || '') }]
    }));
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: { temperature: 0.6, maxOutputTokens: 420 }
      })
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) return d?.candidates?.[0]?.content?.parts?.[0]?.text;
    throw new Error(d?.error?.message || `Gemini ${r.status}`);
  }

  const endpoint = p.type === 'openai'
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://api.groq.com/openai/v1/chat/completions';
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p.key}` },
    body: JSON.stringify({
      model: p.model,
      temperature: 0.6,
      max_tokens: 420,
      messages: [
        { role: 'system', content: systemInstruction },
        ...msgs.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.text || '') }))
      ]
    })
  });
  const d = await r.json().catch(() => ({}));
  if (r.ok) return d?.choices?.[0]?.message?.content;
  throw new Error(d?.error?.message || `${p.type} ${r.status}`);
}
