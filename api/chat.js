export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'مفتاح GEMINI_API_KEY غير مضاف في إعدادات Vercel' });
  }

  try {
    const { messages, reportContext } = req.body || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    let contextText = '';
    if (reportContext && reportContext.name) {
      contextText = `
معلومات التقرير الذي أجراه العميل للتو على المنصة:
- اسم النشاط: ${reportContext.name}
- القطاع: ${reportContext.sector || ''}
- المدينة: ${reportContext.city || ''}
- النتيجة العامة: ${reportContext.overallScore || ''}/100
- الملخص التنفيذي: ${reportContext.summary || ''}
استخدم هذه المعلومات لتخصيص إجاباتك بدقة لمشروع العميل إذا سأل عن تقريره أو نشاطه.`;
    }

    const systemInstruction = `أنت المساعد الذكي الرسمي لبرنامج "مِرآة برو | MIRAA Pro"، بإشراف الخبير محمد الشرقاوي (خبير كتابة المحتوى والتسويق الرقمي).
مهمتك: الإجابة على جميع أسئلة العملاء باللغة العربية الفصحى البسيطة والواضحة (أو بلهجة مهنية قريبة ومريحة) بدقة واختصار مفيد.
مجالاتك:
1. شرح نتائج تقرير مِرآة 6D ومساعدة العميل على فهم أوجه القصور وكيفية تنفيذ التوصيات.
2. الإجابة على أسئلة التسويق الرقمي، كتابة المحتوى، السيو (SEO)، السوشيال ميديا، الإعلانات، وزيادة المبيعات لكافة الأنشطة التجارية.
3. تعريف العميل بخدمات وباقات مِرآة برو والخبير محمد الشرقاوي عند السؤال عنها، وتوجيهه للتواصل المباشر عبر واتساب على الرقم 00201005535574 إذا رغب في تنفيذ خطة محتوى أو تصاميم أو استشارة شخصية.
قواعد الرد:
- كن مباشراً، عملياً، وواضحاً بدون إطالة مملة (لأن العميل قد يستمع للرد صوتياً).
- تجنب الرموز المعقدة أو التنسيقات الطويلة غير الضرورية حتى يكون الرد سلساً عند القراءة الصوتية.
- لا تختلق معلومات غير موجودة.${contextText}`;

    const contents = messages.slice(-12).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: String(m.text || '') }]
    }));

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 600
          }
        })
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'Gemini API Error' });
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'عذراً، لم أتمكن من صياغة رد الآن. حاول مرة أخرى.';
    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: 'حدث خطأ أثناء الاتصال بالمساعد الذكي', details: err.message });
  }
}
