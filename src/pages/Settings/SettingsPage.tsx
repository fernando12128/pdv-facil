import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import { managementService } from "../../services/managementService";

type Props = { onLogout: () => void; onNavigate: (page: AppPage) => void };

export default function SettingsPage({ onLogout, onNavigate }: Props) {
  const [form, setForm] = useState({ name: "", ownerName: "", phone: "", address: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    managementService.market.get().then(({ market }) => setForm({
      name: market.name,
      ownerName: market.owner.name,
      phone: market.phone || "",
      address: market.address || "",
      email: market.owner.email,
    })).catch((value) => setError(value instanceof Error ? value.message : "Erro ao carregar."));
  }, []);

  async function save() {
    try {
      setSaving(true);
      await managementService.market.update(form);
      setFeedback("Salvo.");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout activePage="settings" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="page-stack" style={{ maxWidth: 680 }}>
        <div className="page-heading"><div><h1>Configurações</h1><p>Dados do seu negócio</p></div></div>
        {error && <p className="feedback-error">{error}</p>}
        {feedback && <p className="feedback-success">{feedback}</p>}
        <section className="card">
          <div className="card-header"><h2>Loja</h2></div>
          <div className="card-body" style={{ display: "grid", gap: 16 }}>
            <div className="field"><label>Nome do mercado</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Responsável</label><input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} /></div>
            <div className="field"><label>Telefone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="field"><label>Endereço</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <button className="primary-button" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
          </div>
        </section>
        <section className="card">
          <div className="card-header"><h2>Conta</h2></div>
          <div className="card-body"><p style={{ color: "var(--muted-foreground)", fontSize: 13 }}>Email: {form.email}</p><button className="outline-button" onClick={onLogout}>Sair da conta</button></div>
        </section>
      </div>
    </AdminLayout>
  );
}
