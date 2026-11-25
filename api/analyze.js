export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, meta, engine = 'auto', mode = 'full', targetUrl = '' } = req.body || {};
    if (!prompt && !targetUrl) {
      return res.status(400).json({ error: 'Prompt or URL is required' });
    }

    // Optional Google Sheets Lead Logging
    const sheetUrl = process.env.GOOGLE_SHEET_URL;
    if (sheetUrl && meta) {
      fetch(sheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...meta, mode, targetUrl, engine, date: new Date().toISOString() })
      }).catch(() => {});
    }

    let finalPrompt = prompt || '';

    // If URL-only mode, attempt a fast, safe metadata fetch (title + description + headings)
    if (mode === 'url' && targetUrl) {
      const scraped = await safeFetchPageMeta(targetUrl);
      finalPrompt = `المستخدم أدخل هذا الرابط فقط لتحليل موقعه أو حسابه على السوشيال ميديا:
الرابط: ${targetUrl}
المنصة المكتشفة: ${detectPlatform(targetUrl)}
${scraped ? `بيانات مستخرجة تلقائياً من الرابط:
${scraped}` : 'ملاحظة: تعذر قراءة الصفحة آلياً (غالباً بسبب حماية منصات التواصل)، قم بتحليل الرابط واسم الحساب والمنصة والسوق المستهدف بعمق استشاري دقيق.'}

المطلوب: تقديم تحليل شامل للحساب أو الموقع يشمل:
1. تقييم عام (0-100) وملخص تنفيذي مقنع.
2. تحليل SWOT كامل (نقاط القوة، نقاط الضعف، الفرص، التهديدات).
3. تحليل عميق للمحتوى (جودة الرسالة، الهوية البصرية/النصية، التفاعل، قوة الدعوة لاتخاذ إجراء CTA).
4. أوجه القصور الحرجة وكيفية علاجها.
5. خطة علاجية احترافية من 4 مراحل عملية لرفع المبيعات والانتشار.
6. رسالة تحفيزية قصيرة تشرح لماذا يحتاج العميل الآن للتواصل مع الخبير محمد الشرقاوي عبر واتساب لتنفيذ هذه الخطة باحترافية.

أرجع JSON صالح 100% فقط بهذه البنية:
{
  "brandName": "اسم الحساب أو الموقع المستنتج من الرابط",
  "platform": "المنصة (موقع إلكتروني / إنستغرام / تيك توك / فيسبوك / إكس / لينكدإن)",
  "overallScore": 64,
  "summary": "ملخص تنفيذي عميق في 4 أسطر يوضح الوضع الحالي وأكبر فرصة ضائعة",
  "swot": {
    "strengths": ["نقطة قوة 1", "نقطة قوة 2", "نقطة قوة 3"],
    "weaknesses": ["نقطة ضعف 1", "نقطة ضعف 2", "نقطة ضعف 3"],
    "opportunities": ["فرصة نمو 1", "فرصة نمو 2", "فرصة نمو 3"],
    "threats": ["تهديد سوقي 1", "تهديد سوقي 2", "تهديد سوقي 3"]
  },
  "contentAnalysis": {
    "clarityScore": 58,
    "engagementScore": 52,
    "conversionScore": 45,
    "diagnosis": "تحليل عميق لأسلوب المحتوى الحالي ونقاط الخلل في الإقناع وجذب العملاء",
    "contentPillars": ["محور محتوى مقترح 1", "محور محتوى مقترح 2", "محور محتوى مقترح 3"]
  },
  "criticalGaps": [
    {"gap": "وجه القصور 1", "impact": "أثره المباشر على خسارة العملاء", "fix": "الحل العملي السريع"},
    {"gap": "وجه القصور 2", "impact": "أثره المباشر على خسارة العملاء", "fix": "الحل العملي السريع"},
    {"gap": "وجه القصور 3", "impact": "أثره المباشر على خسارة العملاء", "fix": "الحل العملي السريع"}
  ],
  "treatmentPlan": [
    {"phase": "المرحلة 1 (الأيام 1-7): الإصلاح الفوري", "actions": "خطوات عملية محددة لإصلاح الواجهة والرسالة"},
    {"phase": "المرحلة 2 (الأيام 8-14): هندسة المحتوى", "actions": "إعادة بناء المحتوى البيعي والقصصي"},
    {"phase": "المرحلة 3 (الأيام 15-21): الجذب والتحويل", "actions": "تفعيل مسارات التحويل لواتساب والحملات"},
    {"phase": "المرحلة 4 (الأيام 22-30): التوسع والمضاعفة", "actions": "قياس النتائج ومضاعفة الأداء"}
  ],
  "expertCta": "رسالة مقنعة ومخصصة تشجع صاحب هذا الرابط على التواصل الفوري مع الخبير محمد الشرقاوي عبر واتساب لتحويل هذا التشخيص إلى مبيعات حقيقية"
}`;
    }

    const systemInstruction = mode === 'url'
      ? `أنت "مِرآة برو V6"، خبير تدقيق رقمي وتحليل حسابات ومواقع وتحليل SWOT بإشراف الخبير محمد الشرقاوي.
قواعد صارمة:
1. قدم تحليلاً مهنياً عميقاً ومقنعاً باللغة العربية الفصحى السلسة، وتجنب الكلام العام المكرر.
2. أبرز الفجوة بين الوضع الحالي للرابط وبين ما يمكن تحقيقه مع إدارة محتوى وتسويق احترافية.
3. أرجع JSON صالح 100% فقط بدون أي نص خارجي أو علامات markdown.`
      : `أنت "مِرآة برو V6" (MIRAA Pro)، محرك ذكاء تسويقي وتشخيصي متقدم بإشراف الخبير محمد الشرقاوي.
مهمتك: تقديم تشخيص تجاري وتسويقي عميق + دراسة تحليلية دقيقة للمنافسين في نفس السوق والقطاع.
قواعد صارمة:
1. ممنوع تماماً النصائح العامة المكررة.
2. اربط كل جملة باسم النشاط، مدينته، قطاعه، شريحة أسعاره، وميزته التنافسية.
3. أرجع JSON صالح 100% فقط بدون أي نص خارجي أو علامات markdown.`;

    const providers = buildProviderQueue(engine);
    if (providers.length === 0) {
      return res.status(500).json({
        error: 'لم يتم العثور على أي مفتاح API في Vercel. أضف GEMINI_API_KEY أو GROQ_API_KEY أو OPENAI_API_KEY.'
      });
    }

    let lastError = 'تعذر الاتصال بنماذج الذكاء الاصطناعي حالياً.';

    for (const p of providers) {
      try {
        const resultText = await callProviderJSON(p, systemInstruction, finalPrompt);
        if (resultText) {
          return res.status(200).json({ text: resultText, usedModel: p.label });
        }
      } catch (err) {
        lastError = err.message || lastError;
      }
    }

    return res.status(503).json({
      error: `ضغط مؤقت على النماذج المتاحة (${lastError}). حاول مرة أخرى بعد ثوانٍ.`
    });
  } catch (err) {
    return res.status(500).json({ error: 'حدث خطأ داخلي في الخادم', details: err.message });
  }
}

function detectPlatform(url) {
  const u = url.toLowerCase();
  if (u.includes('instagram.com')) return 'إنستغرام (Instagram)';
  if (u.includes('tiktok.com')) return 'تيك توك (TikTok)';
  if (u.includes('facebook.com') || u.includes('fb.com')) return 'فيسبوك (Facebook)';
  if (u.includes('x.com') || u.includes('twitter.com')) return 'إكس (X / Twitter)';
  if (u.includes('linkedin.com')) return 'لينكدإن (LinkedIn)';
  if (u.includes('snapchat.com')) return 'سناب شات (Snapchat)';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'يوتيوب (YouTube)';
  return 'موقع إلكتروني / متجر رقمي';
}

async function safeFetchPageMeta(rawUrl) {
  try {
    const cleanUrl = rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(cleanUrl, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MiraaProBot/6.0)' }
    });
    clearTimeout(timer);
    if (!r.ok) return '';
    const html = (await r.text()).slice(0, 35000);
    const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || '';
    const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                  html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';
    const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]?.replace(/<[^>]+>/g, '').trim() || '';
    const parts = [];
    if (title) parts.push(`العنوان: ${title.trim()}`);
    if (desc) parts.push(`الوصف: ${desc.trim()}`);
    if (h1) parts.push(`العنوان الرئيسي: ${h1.slice(0, 140)}`);
    return parts.join('\n');
  } catch {
    return '';
  }
}

function buildProviderQueue(engine) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  const all = [];
  if (geminiKey) {
    all.push({ type: 'gemini', model: 'gemini-3.8-flash', key: geminiKey, label: 'Gemini 3.8 Flash' });
    all.push({ type: 'gemini', model: 'gemini-3.5-flash-lite', key: geminiKey, label: 'Gemini 3.5 Flash Lite' });
  }
  if (groqKey) {
    all.push({ type: 'groq', model: 'llama-3.3-70b-versatile', key: groqKey, label: 'Groq Llama 3.3 70B' });
  }
  if (openaiKey) {
    all.push({ type: 'openai', model: 'gpt-4o-mini', key: openaiKey, label: 'OpenAI GPT-4o Mini' });
  }

  if (engine === 'openai' && openaiKey) {
    return [{ type: 'openai', model: 'gpt-4o-mini', key: openaiKey, label: 'OpenAI GPT-4o Mini' }, ...all.filter(x => x.type !== 'openai')];
  }
  if (engine === 'groq' && groqKey) {
    return [{ type: 'groq', model: 'llama-3.3-70b-versatile', key: groqKey, label: 'Groq Llama 3.3 70B' }, ...all.filter(x => x.type !== 'groq')];
  }
  if (engine === 'gemini-lite' && geminiKey) {
    return [{ type: 'gemini', model: 'gemini-3.5-flash-lite', key: geminiKey, label: 'Gemini 3.5 Flash Lite' }, ...all.filter(x => x.model !== 'gemini-3.5-flash-lite')];
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
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${p.key}` },
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
