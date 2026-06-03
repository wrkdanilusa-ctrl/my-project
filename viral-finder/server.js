const express = require('express');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const PROMPT = `Search cbsnews.com for the most recent emotionally powerful, surprising, or heartwarming news story published today or this week. The story must have high viral potential — similar to stories about: a loyal dog staying with a lost sheep, a janitor reporting a teacher for CSAM, a father celebrating his baby daughter's birth, a graduation student carrying his father's gas tank on stage.

Find ONE best story. Return ONLY valid JSON with these fields:
{
  "title": "story headline",
  "url": "direct URL to the article on cbsnews.com",
  "why": "one sentence explaining why this story is viral",
  "tags": ["tag1", "tag2", "tag3"]
}
No markdown, no explanation, just the JSON object.`;

app.post('/find-story', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set on server' });
  }

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: PROMPT }]
    });

    // Extract text blocks from response
    let text = '';
    for (const block of message.content) {
      if (block.type === 'text') text += block.text;
    }

    text = text.trim();

    // Strip markdown code fences if present
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    let story;
    try {
      story = JSON.parse(text);
    } catch {
      // Fallback: extract JSON object from text
      const match = text.match(/\{[\s\S]*\}/);
      if (match) story = JSON.parse(match[0]);
      else throw new Error('Could not parse JSON from response: ' + text);
    }

    res.json(story);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Viral Finder running at http://localhost:${PORT}`);
});
