import { useState } from "react";
import { loginRequest, registerRequest } from "../../services/authService";
import "./AuthPage.css";
import type { UserRole } from "../../lib/accessControl";

type AuthMode = "login" | "register";

type AuthPageProps = {
  onLogin: (token: string, role: UserRole) => void;
};

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>("login");

  const [marketName, setMarketName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLogin = mode === "login";
  const isRegister = mode === "register";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      if (isLogin) {
        const response = await loginRequest(email, password);
        onLogin(response.token, response.user.role as UserRole);
        return;
      }

      await registerRequest(marketName, email, password);
      setSuccessMessage("Conta criada! Você já pode entrar.");
      setMode("login");
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Erro inesperado.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleChangeMode(newMode: AuthMode) {
    setMode(newMode);
    setErrorMessage("");
    setSuccessMessage("");
  }

  return (
    <main className="auth-screen">
      <section className={`auth-card ${isRegister ? "auth-card-register" : ""}`}>
        <div className="auth-icon">
          <StoreIcon />
        </div>

        <h1>PDV Fácil</h1>

        <p className="auth-subtitle">Sistema de vendas para o seu negócio</p>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${isLogin ? "active" : ""}`}
            onClick={() => handleChangeMode("login")}
          >
            Entrar
          </button>

          <button
            type="button"
            className={`auth-tab ${isRegister ? "active" : ""}`}
            onClick={() => handleChangeMode("register")}
          >
            Criar conta
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label htmlFor="marketName">Nome do mercado</label>
              <input
                id="marketName"
                type="text"
                value={marketName}
                onChange={(event) => setMarketName(event.target.value)}
                autoComplete="organization"
                placeholder="Mercado do João"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
          </div>

          {errorMessage && <p className="auth-error">{errorMessage}</p>}
          {successMessage && <p className="auth-success">{successMessage}</p>}

          <button type="submit" className="submit-button" disabled={isSubmitting}>
            {isSubmitting ? "Carregando..." : isLogin ? "Entrar" : "Criar conta"}
          </button>
        </form>
      </section>
    </main>
  );
}

function StoreIcon() {
  return (
    <svg
      width="31"
      height="31"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 10.5V20H20V10.5"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M6.2 4H17.8L20 9.2C20.15 9.56 19.9 10 19.5 10H4.5C4.1 10 3.85 9.56 4 9.2L6.2 4Z"
        stroke="white"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      <path
        d="M9 20V14H15V20"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M8 10V12"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      <path
        d="M12 10V12"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      <path
        d="M16 10V12"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
