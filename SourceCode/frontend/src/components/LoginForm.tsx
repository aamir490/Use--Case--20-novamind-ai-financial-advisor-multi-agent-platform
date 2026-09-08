import { useState } from "react";

interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<void>;
  error: string | null;
}

export default function LoginForm({ onLogin, error }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onLogin(username, password);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-badge">⚡ AI-Powered Platform</div>

          <div className="login-logo-wrap">
            <div className="login-logo">NM</div>
            <div className="login-app-name">NovaMind AI</div>
          </div>

          <p className="subtitle">
            Financial Advisor — Budget planning, investment analysis &amp; insurance guidance
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            required
            autoComplete="username"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            autoComplete="current-password"
          />

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? "Signing in..." : "Sign In →"}
          </button>
        </form>

        <hr className="login-divider" />

        <div className="login-footer">
          <span>
            <strong style={{ color: "#F0F4FF", fontWeight: 700 }}>Built by Aamir</strong>
          </span>
          <span className="login-footer-sep">|</span>
          <a
            href="https://github.com/aamir490"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <span className="login-footer-sep">|</span>
          <a
            href="https://www.linkedin.com/in/aamir-imran"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn
          </a>
          <span className="login-footer-sep">|</span>
          <a href="https://www.nextinsurance.com/" target="_blank" rel="noopener noreferrer">
            NEXT Insurance
          </a>
        </div>
      </div>
    </div>
  );
}
