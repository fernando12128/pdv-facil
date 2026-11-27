import { useEffect, useState } from "react";
import { bankingService, type BankAccount, type TerminalRate } from "../../services/bankingService";

export default function BankConnectionsSettings() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [form, setForm] = useState({ name: "", bankName: "", accountType: "CHECKING", lastFour: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cardRules, setCardRules] = useState<TerminalRate[]>([]);
  const [estimatesEnabled, setEstimatesEnabled] = useState(true);
  const [cardForm, setCardForm] = useState({ paymentMethod: "CREDIT" as TerminalRate["paymentMethod"], providerName: "", feePercent: "2,5", settlementDays: "30", isDefault: true });
  async function load() {
    const data = await bankingService.accounts();
    setAccounts(data.accounts);
    const fees = await bankingService.cardFees();
    setCardRules(fees.rules);
    setEstimatesEnabled(fees.estimatesEnabled);
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
        feePercent: percentage, settlementDays: Number(cardForm.settlementDays), isDefault: cardForm.isDefault
      });
      await load();
      setMessage("Maquininha registrada. As taxas serão usadas apenas em estimativas quando a opção estiver ligada.");
    } catch (e) { setError(e instanceof Error ? e.message : "Falha ao configurar taxa."); }
    finally { setBusy(false); }
  }
  async function changeEstimates(enabled: boolean) {
    setBusy(true); setError(""); setMessage("");
    try {
      await bankingService.setCardEstimates(enabled);
      await load();
      setMessage(enabled ? "Estimativas de recebíveis ativadas." : "Estimativas de taxas desativadas para esta empresa.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível atualizar a configuração."); }
    finally { setBusy(false); }
  }
  async function changeTerminal(id: string, action: "default" | "status") {
    setBusy(true); setError(""); setMessage("");
    try {
      if (action === "default") await bankingService.setDefaultCardFee(id);
      else await bankingService.toggleCardFee(id);
      await load();
      setMessage("Configuração da maquininha atualizada.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível atualizar a maquininha."); }
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
      <div className="card-header"><h2>Maquininhas e estimativas de taxas</h2></div>
      <div className="card-body" style={{ display: "grid", gap: 14 }}>
        <div className="setting-card">
          <div><strong>Calcular estimativas de taxas?</strong>
            <p>Se desativado, não serão calculadas previsões líquidas nem sugeridas conciliações automáticas por taxa. As vendas continuam funcionando normalmente.</p>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={estimatesEnabled} disabled={busy}
              aria-label="Ativar estimativas de taxas de maquininhas"
              onChange={e => void changeEstimates(e.target.checked)} />
            {estimatesEnabled ? "Ligado" : "Desligado"}
          </label>
        </div>
        <p>Cadastre quantas maquininhas precisar. Uma pode ser padrão para crédito, outra para débito e outra para Pix. É possível ter várias taxas na mesma modalidade.</p>
        {cardRules.map(rule => <div key={rule.id} className="setting-card" style={{ gap: 12 }}>
          <div>
            <strong>{rule.paymentMethod === "CREDIT" ? "Crédito" : rule.paymentMethod === "DEBIT" ? "Débito" : "Pix"} • {rule.providerName}</strong>
            <p>{(rule.feeBps / 100).toLocaleString("pt-BR")}% • recebimento estimado: {rule.settlementDays} dia(s) • {rule.active ? (rule.isDefault ? "Padrão" : "Alternativa") : "Inativa"}</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 8 }}>
            {rule.active && !rule.isDefault && <button className="outline-button" type="button" disabled={busy}
              onClick={() => void changeTerminal(rule.id, "default")}>Definir padrão</button>}
            <button className="outline-button" type="button" disabled={busy}
              onClick={() => void changeTerminal(rule.id, "status")}>{rule.active ? "Desativar" : "Ativar"}</button>
          </div>
        </div>)}
        <div className="grid-2">
          <div className="field"><label>Modalidade</label><select value={cardForm.paymentMethod} onChange={e => setCardForm({ ...cardForm, paymentMethod: e.target.value as TerminalRate["paymentMethod"] })}>
            <option value="CREDIT">Crédito</option><option value="DEBIT">Débito</option><option value="PIX">Pix</option>
          </select></div>
          <div className="field"><label>Maquininha / adquirente</label><input value={cardForm.providerName} maxLength={120} onChange={e => setCardForm({ ...cardForm, providerName: e.target.value })} placeholder="Ex.: Stone, Cielo, Mercado Pago" /></div>
          <div className="field"><label>Taxa estimada (%)</label><input inputMode="decimal" value={cardForm.feePercent} onChange={e => setCardForm({ ...cardForm, feePercent: e.target.value })} placeholder="2,5" /></div>
          <div className="field"><label>Prazo estimado (dias)</label><input type="number" min={0} max={90} value={cardForm.settlementDays} onChange={e => setCardForm({ ...cardForm, settlementDays: e.target.value })} /></div>
        </div>
        <label className="checkbox-row"><input type="checkbox" checked={cardForm.isDefault}
          onChange={e => setCardForm({ ...cardForm, isDefault: e.target.checked })} />
          Usar como maquininha padrão desta modalidade
        </label>
        <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>O sistema usa apenas a maquininha padrão de cada modalidade para estimar vendas. Ainda não registra qual equipamento foi usado em cada operação, portanto os valores podem variar dos recebimentos reais. Desative as estimativas para não utilizar este cálculo.</p>
        <button className="primary-button" type="button" disabled={busy} onClick={() => void saveCardFee()}>Salvar maquininha / taxa</button>
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
