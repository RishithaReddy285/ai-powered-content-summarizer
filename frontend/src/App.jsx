import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import './index.css';

function App() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = async () => {
    if (!code.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to summarize content');
      }

      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (err) {
      console.error(err);
      setError(\`Error: \${err.message}\`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header>
        <h1>Content Summarizer</h1>
        <p>AI-Powered Text & Article Summarizer</p>
      </header>

      <main>
        <section className="panel">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
            Source Content
          </h2>
          <textarea
            placeholder="Paste your text or article here..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            spellCheck="false"
          />
          <button onClick={handleAnalyze} disabled={loading || !code.trim()}>
            {loading ? (
              <>
                <div className="loader"></div>
                Summarizing...
              </>
            ) : (
              'Summarize Content'
            )}
          </button>
        </section>

        <section className="panel">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            Summary Results
          </h2>
          <div className="results-content">
            {error && (
              <div style={{ color: 'var(--danger-color)', padding: '1rem', background: 'rgba(248, 81, 73, 0.1)', borderRadius: '6px', border: '1px solid var(--danger-color)' }}>
                {error}
              </div>
            )}
            
            {!analysis && !loading && !error && (
              <div className="results-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                <p>Paste some text or an article and click Summarize Content to see the summary and key takeaways.</p>
              </div>
            )}

            {analysis && (
              <div className="markdown-body">
                <ReactMarkdown>{analysis}</ReactMarkdown>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
