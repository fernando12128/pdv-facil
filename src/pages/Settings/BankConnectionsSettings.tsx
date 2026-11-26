import { useEffect, useState } from "react";
import { bankingService, type BankAccount } from "../../services/bankingService";

export default function BankConnectionsSettings() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [form, setForm] = useState({ name: "", bankName: "", accountType: "CHECKING", lastFour: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    const data = await bankingService.accounts();
    setAccounts(data.accounts);
  }
  useEffect(() => { void load().catch(e => setError(e instanceof Error ? e.message : "Falha ao carregar contas.")); }, []);
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      await bankingService.createAccount(form);
      setForm({ name: "", bankName: "", accountType: "CHECKING", lastFour: "" });
      await load();
      setMessage("Conta cadastrada para importação de extratos.");
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao cadastrar conta."); }
    finally { setBusy(false); }
  }
  return <>
    <section className="card">
      <div className="card-header"><h2>Contas bancárias</h2></div>
      <div className="card-body" style={{ display: "grid", gap: 14 }}>
        <p>Cadastre suas contas para associar extratos importados no Financeiro. Nenhuma conexão bancária será ativada.</p>
        {accounts.map(a => <div className="setting-card" key={a.id}><div><strong>{a.name}</strong><p>{a.bankName} • {a.accountType}{a.lastFour ? ` • ****${a.lastFour}` : ""}</p></div></div>)}
        <div className="grid-2">
          <div className="field"><label>Apelido da conta</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Conta principal" /></div>
          <div className="field"><label>Banco / instituição</label><input value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} placeholder="Banco de teste" /></div>
          <div className="field"><label>Tipo</label><select value={form.accountType} onChange={e => setForm({ ...form, accountType: e.target.value })}><option value="CHECKING">Conta corrente</option><option value="SAVINGS">Poupança</option><option value="PAYMENT">Conta de pagamento</option></select></div>
          <div className="field"><label>Últimos 4 dígitos (opcional)</label><input maxLength={4} value={form.lastFour} onChange={e => setForm({ ...form, lastFour: e.target.value.replace(/\D/g, "") })} /></div>
        </div>
        {error && <p className="feedback-error">{error}</p>}
        {message && <p className="feedback-success">{message}</p>}
        <button className="primary-button" disabled={busy} onClick={() => void save()}>{busy ? "Salvando..." : "Cadastrar conta"}</button>
      </div>
    </section>
    <section className="card">
      <div className="card-header"><h2>Conexões financeiras (futuro)</h2></div>
      <div className="card-body" style={{ display: "grid", gap: 12 }}>
        <p>Integração bancária via Open Finance: <strong>não configurada</strong>. Acesso por API, autorização do cliente e sincronização automática ficarão disponíveis em uma etapa posterior.</p>
        <p>Integração com adquirentes e maquininhas: <strong>não configurada</strong>. O PDV Fácil ainda não consulta taxas e recebimentos automaticamente.</p>
        <div className="info-box">Modo de testes: importação manual de arquivos CSV/OFX. Não informe senha bancária, token de produção ou credenciais neste painel.</div>
      </div>
    </section>
  </>;
}
