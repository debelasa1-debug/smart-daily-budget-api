module.exports = async function handler(req, res) {

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Parse body manually if Vercel did not auto-parse it
  let body = req.body;
  if (!body || typeof body === 'string') {
    try {
      body = JSON.parse(req.body || '{}');
    } catch (e) {
      body = {};
    }
  }

  const userPrompt = body.userPrompt;
  const financialContext = body.financialContext || '';

  if (!userPrompt) {
    return res.status(400).json({ error: 'userPrompt is required', received: JSON.stringify(body) });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not set on server' });
  }

  const fullPrompt = 'You are a friendly expert personal finance advisor in the Smart Daily Budget app.\n\n'
    + financialContext + '\n\n'
    + 'User question: ' + userPrompt + '\n\n'
    + 'Give concise personalized actionable advice. Be warm. Under 150 words. Max 2 emojis.';

  try {
    const geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          generationConfig: { maxOutputTokens: 350, temperature: 0.7 }
        })
      }
    );

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      return res.status(500).json({ error: data.error ? data.error.message : 'Gemini error ' + geminiRes.status });
    }

    const reply = data.candidates && data.candidates[0] &&
                  data.candidates[0].content && data.candidates[0].content.parts &&
                  data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;

    if (!reply) {
      return res.status(500).json({ error: 'Empty response from Gemini', raw: JSON.stringify(data) });
    }

    return res.status(200).json({ reply: reply });

  } catch (err) {
    return res.status(500).json({ error: 'Fetch failed: ' + err.message });
  }
}