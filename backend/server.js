const express = require('express');
const cors = require('cors');
require('dotenv').config();
const Groq = require('groq-sdk');
const { traceable } = require('langsmith');
const { ChromaClient } = require('chromadb');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const port = process.env.PORT || 5000;

// Local server ready

app.post('/api/summarize', async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY environment variable is not set.' });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    // Truncate to prevent Groq TPM rate limits on free tier
    const safeText = code.length > 25000 ? code.substring(0, 25000) + "\n...[Content Truncated due to API Limits]..." : code;

    // Prompt for Groq
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

    const analysis = chatCompletion.choices[0]?.message?.content || 'No analysis generated.';

    res.json({ analysis });

  } catch (error) {
    console.error('Error analyzing code:', error);
    res.status(500).json({ error: 'Failed to analyze code' });
  }
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
