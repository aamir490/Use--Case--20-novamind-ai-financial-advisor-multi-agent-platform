import { useState, useRef, useEffect, useCallback } from "react";
import Head from "next/head";
import ChatInput from "../src/components/ChatInput";
import ChatMessage from "../src/components/ChatMessage";
import LoginForm from "../src/components/LoginForm";
import { signIn, signOut, getCurrentSession, AuthTokens } from "../src/lib/auth";
import {
  sendMessage,
  generateSessionId,
  ChatMessage as ChatMessageType,
} from "../src/lib/agent";

const SUGGESTIONS = [
  "Create a monthly budget for $6,000 income",
  "Analyze AAPL and MSFT stock performance",
  "Build a conservative portfolio for $25K",
  "Compare NVDA, TSLA, and META over 6 months",
  "What's the 50/30/20 rule for budgeting?",
  "How should I allocate savings for insurance premiums?",
];

export default function Home() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [auth, setAuth] = useState<AuthTokens | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [sessionId] = useState(generateSessionId);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCurrentSession().then((session) => {
      if (session) setAuth(session);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleLogin = async (username: string, password: string) => {
    setAuthError(null);
    try {
      const tokens = await signIn(username, password);
      setAuth(tokens);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Authentication failed";
      setAuthError(errorMessage);
    }
  };

  const handleLogout = () => {
    signOut();
    setAuth(null);
    setMessages([]);
  };

  const handleSend = useCallback(
    (content: string) => {
      if (!auth) return;

      const userMessage: ChatMessageType = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2),
        role: "user",
        content,
        timestamp: new Date(),
      };

      const assistantMessage: ChatMessageType = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2) + "a",
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      sendMessage(
        content,
        auth.accessToken,
        sessionId,
        "default_user",
        (chunk) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: chunk,
              };
            }
            return updated;
          });
        },
        () => setIsStreaming(false),
        (error) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              updated[updated.length - 1] = {
                ...last,
                content: `❌ Error: ${error}`,
              };
            }
            return updated;
          });
          setIsStreaming(false);
        }
      );
    },
    [auth, sessionId]
  );

  if (!authChecked) {
    return (
      <div className="loading">
        <p>Loading...</p>
      </div>
    );
  }

  if (!auth) {
    return (
      <>
        <Head>
          <title>Sign In — NovaMind AI Financial Advisor</title>
        </Head>
        <LoginForm onLogin={handleLogin} error={authError} />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>NovaMind AI Financial Advisor</title>
      </Head>
      <div className="app-container">
        {/* Header */}
        <header className="header">
          <div className="header-brand">
            <div className="header-logo">NM</div>
            <div>
              <h1>NovaMind AI Financial Advisor</h1>
              <p>Budget planning &bull; Investment analysis &bull; Insurance guidance</p>
            </div>
          </div>
          <button onClick={handleLogout} className="signout-btn">
            Sign Out
          </button>
        </header>

        {/* Chat Area */}
        <main className="chat-area">
          {messages.length === 0 && (
            <div className="empty-state">
              <div className="icon">🧠</div>
              <h2>NovaMind AI Financial Advisor</h2>
              <p>
                Your intelligent multi-agent financial platform. Ask anything about budgeting,
                investments, stocks, or portfolio strategy.
              </p>

              {/* Feature Cards */}
              <div className="feature-cards">
                <div className="feature-card">
                  <div className="feature-icon">📊</div>
                  <div className="feature-title">Budget Planning</div>
                  <div className="feature-desc">50/30/20 rule, spending analysis, financial health score</div>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">📈</div>
                  <div className="feature-title">Stock Research</div>
                  <div className="feature-desc">Real-time data, 52-week range, YTD performance</div>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">💼</div>
                  <div className="feature-title">Portfolio Builder</div>
                  <div className="feature-desc">Conservative, moderate, or aggressive allocations</div>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">🔒</div>
                  <div className="feature-title">Safe & Guardrailed</div>
                  <div className="feature-desc">Bedrock Guardrails — responsible AI, no crypto advice</div>
                </div>
              </div>

              {/* Suggestions */}
              <div className="suggestions-label">Try asking:</div>
              <div className="suggestions">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {isStreaming && (
            <div className="streaming">
              <div className="dots">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
              Analyzing...
            </div>
          )}

          <div ref={chatEndRef} />
        </main>

        {/* Input Area */}
        <div className="input-area">
          <ChatInput onSend={handleSend} disabled={isStreaming} />
        </div>

        {/* Footer Branding */}
        <div className="footer-brand">
          <strong style={{ color: "#F0F4FF" }}>Built by Aamir</strong>
          <span className="footer-sep">•</span>
          <a href="https://github.com/aamir490" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <span className="footer-sep">•</span>
          <a href="https://www.linkedin.com/in/aamir-imran" target="_blank" rel="noopener noreferrer">
            LinkedIn
          </a>
          <span className="footer-sep">•</span>
          <a href="https://www.nextinsurance.com/" target="_blank" rel="noopener noreferrer">
            NEXT Insurance
          </a>
        </div>
      </div>
    </>
  );
}
