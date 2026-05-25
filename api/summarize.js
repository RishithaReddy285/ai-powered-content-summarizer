const Groq = require('groq-sdk');
const { traceable } = require('langsmith');

module.exports = exports = async (req, res) => {
  // Add CORS headers for local development testing
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY environment variable is not set.' });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Truncate to prevent Groq TPM rate limits on free tier
    const safeText = code.length > 25000 ? code.substring(0, 25000) + "\n...[Content Truncated]..." : code;

    const prompt = `
Please read the following text or article and provide a clear, concise summary. 
Also, provide any helpful suggestions or key takeaways derived from the text.
Do not analyze this as code.

Format the output cleanly in Markdown.

Input:
\`\`\`
${safeText}
\`\`\`
`;

    // Wrap the LLM call using LangSmith traceable helper
    const getCompletion = traceable(
      async (messages) => {
        return await groq.chat.completions.create({
          messages,
          model: "llama-3.1-8b-instant",
          temperature: 0.2,
          max_tokens: 1024,
        });
      },
      { name: "Groq Summarizer Chat", run_type: "llm" }
    );

    const chatCompletion = await getCompletion([
      {
        role: "system",
        content: "You are an expert AI content summarizer. You provide precise, insightful, and concise summaries."
      },
      {
        role: "user",
        content: prompt
      }
    ]);

    const analysis = chatCompletion.choices[0]?.message?.content || 'No summary generated.';

    res.status(200).json({ analysis });

  } catch (error) {
    console.error('Error summarizing content:', error);
    res.status(500).json({ error: error.message || 'Failed to summarize content' });
  }
};
