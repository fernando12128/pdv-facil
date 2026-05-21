import Sidebar from "../../components/Sidebar/Sidebar";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import "./SettingsPage.css";

type SettingsPageProps = {
  onLogout: () => void;
  onNavigate: (page: AppPage) => void;
};

export default function SettingsPage({
  onLogout,
  onNavigate,
}: SettingsPageProps) {
  return (
    <main className="settings-layout">
      <Sidebar
        activePage="settings"
        onNavigate={onNavigate}
        onLogout={onLogout}
      />

      <section className="settings-main">
        <header className="settings-topbar">
          <button className="settings-topbar-button">
            <PanelIcon />
          </button>
        </header>

        <div className="settings-content">
          <div className="settings-title-area">
            <h1>Configurações</h1>
            <p>Gerencie as informações do seu negócio</p>
          </div>

          <section className="settings-card">
            <h2>Dados do mercado</h2>

            <div className="settings-form">
              <div className="settings-form-group">
                <label>Nome do mercado</label>
                <input type="text" placeholder="Mercado do João" />
              </div>

              <div className="settings-form-group">
                <label>Email</label>
                <input type="email" placeholder="contato@mercado.com" />
              </div>

              <div className="settings-form-group">
                <label>Telefone</label>
                <input type="text" placeholder="(00) 00000-0000" />
              </div>

              <div className="settings-form-group">
                <label>Endereço</label>
                <input type="text" placeholder="Rua, número, bairro" />
              </div>

              <button className="save-settings-button">
                Salvar alterações
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function PanelIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M10 5V19" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}