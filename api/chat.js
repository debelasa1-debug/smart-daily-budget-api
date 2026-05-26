/**
 * Vercel Serverless Function — Gemini 2.5 Flash Proxy
 * File location: api/chat.js
 *
 * DEPLOY STEPS:
 * 1. Upload this folder to GitHub
 * 2. Go to vercel.com → Import repo
 * 3. Add environment variable:
 *      Name:  GEMINI_API_KEY
 *      Value: AIzaSyXXXXXXXX  (from aistudio.google.com/app/apikey)
 * 4. Deploy → get URL like https://smart-daily-budget-api.vercel.app
 * 5. Paste URL into super_index.html where it says YOUR-VERCEL-URL
 */

export default async function handler(req, res) {

  // CORS — required for Android WebView
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userPrompt, financialContext } = req.body;

  if (!userPrompt || typeof userPrompt !== 'string') {
    return res.status(400).json({ error: 'userPrompt is required' });
  }
  if (userPrompt.length > 1000) {
    return res.status(400).json({ error: 'Message too long' });
  }

  // API key from Vercel environment — never inside the app
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server not configured. Contact support.' });
  }

  // Full prompt with user financial context
  const fullPrompt = `You are a friendly expert personal finance advisor in the Smart Daily Budget mobile app.

${financialContext || ''}

User question: ${userPrompt}

Give concise, personalized, actionable financial advice. Be warm and encouraging. Under 150 words. Use 1-2 emojis max. Reference their actual numbers when helpful.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          generationConfig: {
            maxOutputTokens: 350,
            temperature: 0.7,
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('[Gemini Error]', response.status, JSON.stringify(data));
      return res.status(500).json({ error: data.error?.message || 'AI error. Try again.' });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) {
      console.error('[Gemini Empty]', JSON.stringify(data));
      return res.status(500).json({ error: 'Empty AI response. Try again.' });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('[Proxy Error]', error);
    return res.status(500).json({ error: 'Connection failed: ' + error.message });
  }
}