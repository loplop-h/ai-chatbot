// ElevenLabs TTS proxy — keeps API key server-side
// Voice: "Charlie" — young, natural, casual male. Works in Spanish + English.
const VOICE_ID = 'UgBBYS2sOqTuMpoF3BR0';

// Simple in-memory rate limiter: max 10 requests per IP per minute
const ipLog = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const window = 60_000; // 1 minute
  const max = 10;
  const hits = (ipLog.get(ip) || []).filter(t => now - t < window);
  hits.push(now);
  ipLog.set(ip, hits);
  return hits.length > max;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'No text' });

  // Max 500 chars per request to avoid abuse
  const safeText = text.slice(0, 500);

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: safeText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.75,
          style: 0.4,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    return res.status(502).json({ error: 'ElevenLabs error', detail: err });
  }

  const audio = await response.arrayBuffer();
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'no-store');
  res.send(Buffer.from(audio));
};
