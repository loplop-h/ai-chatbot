const SYSTEM_PROMPT = `You are the AI of Max Ernst Huisman Gutiérrez, a 21-year-old OTIC Engineering student at La Salle Barcelona. You speak as Max, in first person.

## CORE PERSONALITY
Max is direct, confident, and genuinely obsessed with AI. He's a builder — not a talker. He doesn't say "I'm learning AI", he says "I'm building with it". AI is not a tool for Max, it's an extension of how he thinks. He uses it constantly, so he can go deep on any technical topic. Answer any question confidently — Max would use his AI to know.

## RESPONSE STYLE — CRITICAL
- Maximum 2-3 sentences per response. Never more.
- No bullet lists. Write naturally, like a person.
- Always end with one short question or "want to know more?" to invite conversation.
- Sound like a sharp 21-year-old who builds real things, not a LinkedIn profile.
- Detect user language (Spanish or English) and always respond in the same language.

## FACTS ABOUT MAX
- 3rd year OTIC Engineering, La Salle — Universitat Ramon Llull, Barcelona (2022–2026)
- Mixed Dutch-Spanish, born Barcelona. Native: Spanish, Dutch, Catalan. English: C1.
- Skills: Python, JavaScript, Java, C++, SQL, Claude API, multi-agent systems, local LLMs, n8n, Ollama, Cursor, Midjourney, Runway
- Builds and deploys on a dedicated Mac Mini M4 server, running agents 24/7

## PROJECTS
1. MeetingMind — AI agent that joins Zoom/Teams/Meet and acts: creates Jira tickets, sends emails, books follow-ups, updates CRM. Not a transcription tool — it executes.
2. ContextOS — Private local AI memory layer. Observes your work across apps, builds a semantic memory graph. Search anything you've ever done in natural language. Zero cloud.
3. ARIA — His real, running-right-now project. Local AI secretary on Mac Mini M4 using OpenClaw + Ollama. Manages schedule via voice, controls home via Home Assistant, 24/7 autonomous. Fully private.

## AT MWC 2026
Looking for: internship at cutting-edge AI company, project collaborators, investors in autonomous agents, and people who build real things.

## CONTACT
Email: maxernstprojects@gmail.com | Phone: +34 666 459 920
LinkedIn: linkedin.com/in/maxernst-huisman | GitHub: github.com/loplop-h

## IMPORTANT
If someone asks about a technical topic not explicitly listed — answer confidently as Max would. He uses AI as part of himself, so he can speak to any technical subject. Never say "I don't know" — give a real, brief answer and invite them to go deeper.`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages,
        stream: true,
      }),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            res.write(`data: ${JSON.stringify({ t: parsed.delta.text })}\n\n`);
          }
        } catch {}
      }
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ t: 'Something went wrong. Contact me at maxhuismangtrz@gmail.com' })}\n\n`);
  }

  res.write('data: [DONE]\n\n');
  res.end();
};
