export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'مفتاح GEMINI_API_KEY غير مضاف في إعدادات Vercel' });
  }

  try {
    const { prompt, meta } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const sheetUrl = process.env.GOOGLE_SHEET_URL;
    if (sheetUrl && meta) {
      try {
        await fetch(sheetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(meta)
        });
      } catch (e) {
        console.error('Sheet log error:', e);
      }
    }

    const systemInstruction = `أنت "مِرآة برو" (MIRAA Pro)، محرك ذكاء تسويقي وتشخيصي متقدم بإشراف الخبير محمد الشرقاوي.
مهمتك: تقديم تشخيص تجاري وتسويقي عميق، دقيق، ومفصل يجمع بين قوة التقرير الاستشاري الاحترافي والوضوح التام لصاحب المشروع.
قواعد صارمة:
1. ممنوع تماماً النصائح العامة المكررة مثل: "انشر بانتظام"، "حسّن جودة الصور"، "استخدم هاشتاجات".
2. اربط كل جملة في التقرير مباشرة باسم النشاط، مدينته، قطاعه، شريحة أسعاره، وميزته أو مشكلته التي ذكرها.
3. في الأبعاد الستة (MIRAA 6D)، اذكر لكل بُعد: الدرجة الدقيقة (0-100)، التشخيص (ممتاز / جيد / متوسط / ضعيف)، الدليل المرصود (مبني على وصف العميل وطبيعة السوق)، والتوصية العملية المحددة.
4. في أوجه القصور الحرجة، اذكر لكل قصور: الخلل، أثره على المبيعات، خطوات المعالجة، ومثال تطبيقي مكتوب وجاهز للنسخ باسم النشاط.
5. أرجع JSON صالح 100% فقط بدون أي نص خارجي أو علامات markdown.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.45
      }
    });

    let response;
    let data;

    // إعادة المحاولة تلقائياً حتى 3 مرات عند وجود ضغط مؤقت (503 أو 429)
    for (let attempt = 1; attempt <= 3; attempt++) {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      data = await response.json().catch(() => ({}));

      if (response.ok) {
        return res.status(200).json(data);
      }
      if ((response.status === 503 || response.status === 429) && attempt < 3) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      break;
    }

    const isBusy = response?.status === 503 || response?.status === 429;
    return res.status(response?.status || 500).json({
      error: isBusy
        ? 'يوجد ضغط مؤقت على خادم الذكاء الاصطناعي حالياً، يرجى الضغط على زر الفحص مرة أخرى بعد ثوانٍ.'
        : (data?.error?.message || 'حدث خطأ أثناء الاتصال بخدمة التحليل')
    });
  } catch (err) {
    return res.status(500).json({ error: 'تعذر إتمام التحليل حالياً، حاول مرة أخرى.', details: err.message });
  }
}
