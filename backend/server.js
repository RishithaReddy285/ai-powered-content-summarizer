const express = require('express');
const cors = require('cors');
require('dotenv').config();
const Groq = require('groq-sdk');
const { ChromaClient } = require('chromadb');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const port = process.env.PORT || 5000;

// Initialize Groq SDK
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Initialize ChromaDB Client (assuming it's running locally on port 8000 if available)
const chroma = new ChromaClient({ path: "http://localhost:8000" });

app.post('/api/analyze', async (req, res) => {
  try {
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
      model: "llama-3.1-8b-instant", // Using Llama 3.1 8B for fast inference
      temperature: 0.2,
      max_tokens: 1024,
    });

    const analysis = chatCompletion.choices[0]?.message?.content || 'No analysis generated.';

    // Try to save to ChromaDB (non-blocking if it fails)
    try {
      const collection = await chroma.getOrCreateCollection({
        name: "code_analysis_history"
      });
      await collection.add({
        documents: [code],
        metadatas: [{ analysis }],
        ids: [Date.now().toString()]
      });
      console.log("Successfully saved to ChromaDB.");
    } catch (dbError) {
      console.warn("ChromaDB is not available. Skipping DB save. Error:", dbError.message);
    }

    res.json({ analysis });

  } catch (error) {
    console.error('Error analyzing code:', error);
    res.status(500).json({ error: 'Failed to analyze code' });
  }
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});
