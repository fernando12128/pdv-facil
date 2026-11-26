import { useState } from "react";
import {
  confirmPasswordReset,
  loginRequest,
  registerRequest,
  requestPasswordReset,
  resendVerificationRequest,
  verifyEmailRequest,
} from "../../services/authService";
import "./AuthPage.css";

type AuthView = "login" | "register" | "verify-email" | "forgot-password" | "reset-password";

type AuthPageProps = {
  onLogin: (token: string) => void;
};

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [view, setView] = useState<AuthView>("login");
  const [marketName, setMarketName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [developmentToken, setDevelopmentToken] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLogin = view === "login";
  const isRegister = view === "register";
  const isVerification = view === "verify-email";
  const isForgotPassword = view === "forgot-password";
  const isResetPassword = view === "reset-password";
  const showsTabs = isLogin || isRegister;

  function clearFeedback() {
    setErrorMessage("");
    setSuccessMessage("");
  }

  function changeView(next: AuthView) {
    setView(next);
    clearFeedback();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();
    setIsSubmitting(true);

    try {
      if (isLogin) {
        const response = await loginRequest(email, password);
        onLogin(response.token);
        return;
      }

      if (isRegister) {
        const response = await registerRequest(marketName, email, password);
        setEmail(response.email || email);
        setDevelopmentToken(response.developmentToken || "");
        setToken("");
        setPassword("");
        setView("verify-email");
        setSuccessMessage("Conta criada. Confirme seu e-mail para liberar o acesso.");
        return;
      }

      if (isVerification) {
        const response = await verifyEmailRequest(email, token);
        setView("login");
        setPassword("");
        setToken("");
        setDevelopmentToken("");
        setSuccessMessage(response.message);
        return;
      }

      if (isForgotPassword) {
        const response = await requestPasswordReset(email);
        setSuccessMessage(response.message);
        if (response.developmentToken) {
          setDevelopmentToken(response.developmentToken);
          setToken(response.developmentToken);
          setView("reset-password");
        }
        return;
      }

      const response = await confirmPasswordReset(token, password);
      setView("login");
      setPassword("");
      setToken("");
      setDevelopmentToken("");
      setSuccessMessage(response.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resendVerification() {
    clearFeedback();
    setIsSubmitting(true);
    try {
      const response = await resendVerificationRequest(email);
      setSuccessMessage(response.message);
      if (response.developmentToken) setDevelopmentToken(response.developmentToken);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Não foi possível solicitar outro código.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className={`auth-card ${isRegister ? "auth-card-register" : ""}`}>
        <div className="auth-icon"><StoreIcon /></div>
        <h1>PDV Fácil</h1>
        <p className="auth-subtitle">Sistema de vendas para o seu negócio</p>

        {showsTabs ? (
          <div className="auth-tabs">
            <button type="button" className={`auth-tab ${isLogin ? "active" : ""}`} onClick={() => changeView("login")}>Entrar</button>
            <button type="button" className={`auth-tab ${isRegister ? "active" : ""}`} onClick={() => changeView("register")}>Criar conta</button>
          </div>
        ) : (
          <div className="auth-flow-heading">
            <h2>{isVerification ? "Confirme seu e-mail" : isForgotPassword ? "Recuperar senha" : "Criar nova senha"}</h2>
            <p>{isVerification ? "Use o código para confirmar o endereço da sua conta." : isForgotPassword ? "Informe o e-mail cadastrado para iniciar a recuperação." : "Escolha uma nova senha para sua conta."}</p>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && (
            <div className="form-group">
              <label htmlFor="marketName">Nome do mercado</label>
              <input id="marketName" type="text" value={marketName} onChange={(event) => setMarketName(event.target.value)} autoComplete="organization" placeholder="Mercado do João" required maxLength={120} />
            </div>
          )}

          {(isLogin || isRegister || isVerification || isForgotPassword) && (
            <div className="form-group">
              <label htmlFor="email">E-mail</label>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={254} />
            </div>
          )}

          {(isVerification || isResetPassword) && (
            <div className="form-group">
              <label htmlFor="token">Código de uso único</label>
              <input id="token" type="text" value={token} onChange={(event) => setToken(event.target.value.trim())} autoComplete="off" required minLength={32} maxLength={128} spellCheck={false} />
            </div>
          )}

          {(isLogin || isRegister || isResetPassword) && (
            <div className="form-group">
              <label htmlFor="password">{isResetPassword ? "Nova senha" : "Senha"}</label>
              <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isLogin ? "current-password" : "new-password"} required minLength={8} maxLength={128} />
              {!isLogin && <small className="auth-hint">Use pelo menos 8 caracteres.</small>}
            </div>
          )}

          {developmentToken && (isVerification || isResetPassword) && (
            <div className="auth-dev-token">
              <strong>Código de teste — não enviado por e-mail</strong>
              <code>{developmentToken}</code>
              <button type="button" className="auth-text-button" onClick={() => setToken(developmentToken)}>Usar este código</button>
            </div>
          )}

          {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
          {successMessage && <p className="auth-success" role="status">{successMessage}</p>}

          <button type="submit" className="submit-button" disabled={isSubmitting}>
            {isSubmitting ? "Carregando..." : isLogin ? "Entrar" : isRegister ? "Criar conta" : isVerification ? "Confirmar e-mail" : isForgotPassword ? "Solicitar recuperação" : "Redefinir senha"}
          </button>
        </form>

        {isLogin && <button type="button" className="auth-text-button auth-secondary-action" onClick={() => changeView("forgot-password")}>Esqueci minha senha</button>}
        {isVerification && <button type="button" className="auth-text-button auth-secondary-action" disabled={isSubmitting} onClick={resendVerification}>Solicitar novo código</button>}
        {!showsTabs && <button type="button" className="auth-text-button auth-back-button" onClick={() => changeView("login")}>Voltar para entrar</button>}
      </section>
    </main>
  );
}

function StoreIcon() {
  return (
    <svg width="31" height="31" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 10.5V20H20V10.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.2 4H17.8L20 9.2C20.15 9.56 19.9 10 19.5 10H4.5C4.1 10 3.85 9.56 4 9.2L6.2 4Z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 20V14H15V20" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 10V12M12 10V12M16 10V12" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
