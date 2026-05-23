const Groq = require('groq-sdk');
const { ChromaClient } = require('chromadb');

// Initialize Groq SDK
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Initialize ChromaDB Client
const chroma = new ChromaClient({ path: "http://localhost:8000" });

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
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const prompt = `
Please read the following text or article and provide a clear, concise summary. 
Also, provide any helpful suggestions or key takeaways derived from the text.
Do not analyze this as code.

Format the output cleanly in Markdown.

Input:
\`\`\`
${code}
\`\`\`
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are an expert AI content summarizer. You provide precise, insightful, and concise summaries."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.2,
      max_tokens: 1024,
    });

    const analysis = chatCompletion.choices[0]?.message?.content || 'No summary generated.';

    // Try to save to ChromaDB (non-blocking if it fails)
    try {
      const collection = await chroma.getOrCreateCollection({
        name: "content_summary_history"
      });
      await collection.add({
        documents: [code],
        metadatas: [{ analysis }],
        ids: [Date.now().toString()]
      });
    } catch (dbError) {
      console.warn("ChromaDB is not available. Skipping DB save. Error:", dbError.message);
    }

    res.status(200).json({ analysis });

  } catch (error) {
    console.error('Error summarizing content:', error);
    res.status(500).json({ error: 'Failed to summarize content' });
  }
};
