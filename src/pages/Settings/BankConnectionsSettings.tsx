import { useEffect, useState } from "react";
import { bankingService, type BankAccount } from "../../services/bankingService";

export default function BankConnectionsSettings() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [form, setForm] = useState({ name: "", bankName: "", accountType: "CHECKING", lastFour: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cardRules, setCardRules] = useState<Array<{ id: string; paymentMethod: string; providerName: string; feeBps: number; settlementDays: number }>>([]);
  const [cardForm, setCardForm] = useState({ paymentMethod: "CREDIT" as "CREDIT" | "DEBIT", providerName: "", feePercent: "2,5", settlementDays: "30" });
  async function load() {
    const data = await bankingService.accounts();
    setAccounts(data.accounts);
    setCardRules((await bankingService.cardFees()).rules);
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
  async function saveCardFee() {
    setBusy(true); setError(""); setMessage("");
    try {
      const percentage = Number(cardForm.feePercent.replace(",", "."));
      await bankingService.saveCardFee({
        paymentMethod: cardForm.paymentMethod, providerName: cardForm.providerName,
        feePercent: percentage, settlementDays: Number(cardForm.settlementDays)
      });
      await load();
      setMessage("Regra de cartão registrada. Os valores serão usados somente em previsões.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao configurar taxa."); }
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
      <div className="card-header"><h2>Taxas de maquininhas (estimativa)</h2></div>
      <div className="card-body" style={{ display: "grid", gap: 14 }}>
        <p>Cadastre uma taxa para cada modalidade. O Financeiro exibirá previsões de recebíveis, nunca crédito bancário confirmado.</p>
        {cardRules.map(rule => <div key={rule.id} className="setting-card"><div><strong>{rule.paymentMethod === "CREDIT" ? "Crédito" : "Débito"} • {rule.providerName}</strong><p>{(rule.feeBps / 100).toLocaleString("pt-BR")}% • prazo estimado: {rule.settlementDays} dia(s)</p></div></div>)}
        <div className="grid-2">
          <div className="field"><label>Modalidade</label><select value={cardForm.paymentMethod} onChange={e => setCardForm({ ...cardForm, paymentMethod: e.target.value as "CREDIT" | "DEBIT" })}><option value="CREDIT">Crédito</option><option value="DEBIT">Débito</option></select></div>
          <div className="field"><label>Adquirente</label><input value={cardForm.providerName} onChange={e => setCardForm({ ...cardForm, providerName: e.target.value })} placeholder="Nome da maquininha" /></div>
          <div className="field"><label>Taxa (%)</label><input inputMode="decimal" value={cardForm.feePercent} onChange={e => setCardForm({ ...cardForm, feePercent: e.target.value })} placeholder="2,5" /></div>
          <div className="field"><label>Prazo de recebimento (dias)</label><input type="number" min={0} max={90} value={cardForm.settlementDays} onChange={e => setCardForm({ ...cardForm, settlementDays: e.target.value })} /></div>
        </div>
        <button className="primary-button" disabled={busy} onClick={() => void saveCardFee()}>Salvar taxa de cartão</button>
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
