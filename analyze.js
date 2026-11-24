export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is missing in Environment Variables' });
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

    const systemInstruction = `أنت "مِرآة برو" (MIRAA Pro)، محرك تشخيص تسويقي واستراتيجي متقدم بإشراف الخبير محمد الشرقاوي.
مهمتك: تقديم تشخيص تجاري وتسويقي عميق، دقيق، وصريح يكشف أوجه القصور الحقيقية ويعالجها بطريقة احترافية وعملية.
قواعد صارمة لا يجوز مخالفتها:
1. ممنوع تماماً النصائح العامة المكررة مثل: "انشر بانتظام"، "حسّن جودة الصور"، "استخدم هاشتاجات"، "تفاعل مع الجمهور".
2. كل نقطة قصور يجب أن تكون مرتبطة مباشرة بنوع النشاط، المدينة، شريحة السعر، والوصف الذي كتبه العميل.
3. لكل وجه قصور، اشرح: (أ) أين الخلل بالضبط، (ب) كيف يضيّع المبيعات فعلياً، (ج) خطوات المعالجة الاحترافية، (د) مثال تطبيقي جاهز ومكتوب خصيصاً لهذا النشاط.
4. اكتب بلغة عربية واضحة، حازمة، وسهلة الفهم لصاحب المشروع (بلا مصطلحات إنجليزية معقدة غير مشروحة).
5. أرجع JSON صالح 100% فقط بدون أي نص خارج الـ JSON.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.4
          }
        })
      }
    );

    const data = await response.json();
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to analyze', details: err.message });
  }
}
