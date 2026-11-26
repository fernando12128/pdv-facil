import { useEffect, useState, type ChangeEvent } from "react";
import { bankingService, type BankAccount, type BankTransaction, type RecurringRule, type FinanceAuditLog } from "../../services/bankingService";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatDate = (s: string) => new Date(s).toLocaleDateString("pt-BR", { timeZone: "UTC" });
type ParsedMovement = { date: string; description: string; amount: number; externalId?: string };
function parseMoney(value: string): number {
  const clean = value.trim().replace(/[^0-9,.+-]/g, "");
  if (!clean) return NaN;
  // R$ 1.234,56 ou 1234,56; também suporta 1234.56.
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  return Number(normalized);
}
function csvFields(line: string, separator: string): string[] {
  const fields: string[] = [];
  let value = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === separator && !quoted) { fields.push(value.trim()); value = ""; }
    else value += c;
  }
  fields.push(value.trim());
  return fields;
}
function dateIso(raw: string): string {
  const value = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  throw new Error("Data inválida: " + value);
}
function parseCsv(text: string): ParsedMovement[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) throw new Error("CSV sem movimentos.");
  const separator = lines[0].includes(";") ? ";" : ",";
  const normalized = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const headers = csvFields(lines[0], separator).map(normalized);
  const col = (values: string[]) => headers.findIndex(h => values.includes(h));
  const date = col(["data", "date"]), description = col(["descricao", "historico", "description"]);
  const amount = col(["valor", "amount"]), id = col(["id", "fitid", "identificador"]);
  if (date < 0 || description < 0 || amount < 0) throw new Error("CSV precisa de colunas Data, Descrição e Valor (ID opcional).");
  return lines.slice(1).map((line, index) => {
    const cells = csvFields(line, separator);
    const value = parseMoney(cells[amount] || "");
    if (!Number.isFinite(value) || value === 0) throw new Error(`Valor inválido na linha ${index + 2}`);
    return { date: dateIso(cells[date] || ""), description: cells[description] || "", amount: value, ...(id >= 0 && cells[id] ? { externalId: cells[id] } : {}) };
  });
}
function parseOfx(text: string): ParsedMovement[] {
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  if (!blocks.length) throw new Error("Nenhuma transação OFX encontrada.");
  const tag = (block: string, key: string) => {
    const match = new RegExp("<" + key + ">([^\\r\\n<]+)", "i").exec(block);
    return match?.[1]?.trim() || "";
  };
  return blocks.map(block => {
    const dateRaw = tag(block, "DTPOSTED");
    const date = dateRaw.length >= 8 ? `${dateRaw.slice(0,4)}-${dateRaw.slice(4,6)}-${dateRaw.slice(6,8)}` : "";
    const description = tag(block, "MEMO") || tag(block, "NAME") || "Movimentação";
    return { date: dateIso(date), description, amount: parseMoney(tag(block, "TRNAMT")), externalId: tag(block, "FITID") || undefined };
  });
}
export function BankingPanel() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [selected, setSelected] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ id: string; description: string; amount: number; dueDate: string }>>([]);
  const [selectedEntry, setSelectedEntry] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function load() {
    const [a,t] = await Promise.all([bankingService.accounts(), bankingService.transactions()]);
    setAccounts(a.accounts); setTransactions(t.transactions);
    if (!accountId && a.accounts.length) setAccountId(a.accounts[0].id);
  }
  useEffect(() => { void load().catch(e => setError(e instanceof Error ? e.message : "Falha ao carregar extratos.")); }, []);
  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !accountId) return;
    e.target.value = "";
    setBusy(true); setError(""); setMessage("");
    try {
      if (file.size > 1024 * 1024) throw new Error("O arquivo deve ter até 1 MB.");
      const content = await file.text();
      const movements = file.name.toLowerCase().endsWith(".ofx") ? parseOfx(content) : parseCsv(content);
      if (movements.length > 1000) throw new Error("Importe até 1000 movimentações por arquivo.");
      const result = await bankingService.importTransactions({ bankAccountId: accountId, transactions: movements });
      setMessage(`${result.added} movimento(s) importado(s), ${result.duplicates} duplicado(s) ignorado(s).`);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Falha na importação."); }
    finally { setBusy(false); }
  }
  async function suggest(id: string) {
    setBusy(true); setError(""); setSelected(id); setSelectedEntry("");
    try { setSuggestions((await bankingService.suggestions(id)).suggestions); }
    catch (err) { setError(err instanceof Error ? err.message : "Erro ao buscar sugestões."); }
    finally { setBusy(false); }
  }
  async function reconcile() {
    if (!selected || !selectedEntry || !window.confirm("Confirmar a conciliação e liquidar a conta selecionada?")) return;
    setBusy(true); setError("");
    try {
      await bankingService.reconcile(selected, selectedEntry);
      setSelected(""); setSuggestions([]); setSelectedEntry("");
      setMessage("Movimentação conciliada. Conta marcada como liquidada.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao conciliar."); }
    finally { setBusy(false); }
  }
  return <section className="card">
    <div className="card-header"><h2>Conciliação por extrato</h2></div>
    <div className="card-body" style={{ display: "grid", gap: 14 }}>
      <p>Importe CSV ou OFX da conta cadastrada em <strong>Configurações</strong>. A conciliação é assistida: nenhuma conta será liquidada sem sua confirmação.</p>
      <div className="grid-2">
        <div className="field"><label>Conta bancária</label><select value={accountId} onChange={e => setAccountId(e.target.value)}><option value="">Selecione</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.bankName})</option>)}</select></div>
        <div className="field"><label>Extrato CSV/OFX</label><input type="file" accept=".csv,.ofx,text/csv" disabled={busy || !accountId} onChange={e => void importFile(e)} /></div>
      </div>
      <p className="finance-note">CSV aceito: Data;Descrição;Valor;ID (ID opcional). Valores negativos representam saídas. OFX deve conter transações STMTTRN.</p>
      {message && <p className="feedback-success">{message}</p>}{error && <p className="feedback-error">{error}</p>}
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Conta</th><th>Histórico</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead><tbody>
        {transactions.filter(t => !accountId || t.bankAccountId === accountId).map(t => <tr key={t.id}>
          <td>{formatDate(t.date)}</td><td>{t.bankAccount.name}</td><td>{t.description}</td><td>{brl(t.amount)}</td>
          <td>{t.status === "MATCHED" ? "Conciliada" : "Pendente"}</td>
          <td>{t.status === "UNMATCHED" && <button className="outline-button" disabled={busy} onClick={() => void suggest(t.id)}>Conciliar</button>}</td>
        </tr>)}
      </tbody></table>{!transactions.length && <p className="empty-state">Nenhum extrato importado.</p>}</div>
      {selected && <div className="info-box" style={{ display: "grid", gap: 10 }}>
        <strong>Selecione o lançamento correspondente</strong>
        <p>As sugestões exigem mesmo valor e tipo, com vencimento próximo à data da movimentação.</p>
        <select value={selectedEntry} onChange={e => setSelectedEntry(e.target.value)}>
          <option value="">Selecione um lançamento</option>
          {suggestions.map(e => <option key={e.id} value={e.id}>{e.description} • {brl(e.amount)} • {formatDate(e.dueDate)}</option>)}
        </select>
        {!suggestions.length && <p>Nenhuma correspondência sugerida. Verifique o lançamento no Financeiro.</p>}
        <div><button className="primary-button" disabled={busy || !selectedEntry} onClick={() => void reconcile()}>Confirmar conciliação</button>{" "}<button className="outline-button" onClick={() => setSelected("")}>Cancelar</button></div>
      </div>}
    </div>
  </section>;
}
export function RecurrencesPanel() {
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [logs, setLogs] = useState<FinanceAuditLog[]>([]);
  const [form, setForm] = useState({ type: "PAYABLE", description: "", category: "", amount: "", nextDueDate: new Date().toLocaleDateString("en-CA") });
  const [message, setMessage] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function load() {
    const [r, a] = await Promise.all([bankingService.recurrences(), bankingService.audit()]);
    setRules(r.rules); setLogs(a.logs);
  }
  useEffect(() => { void load().catch(e => setError(e instanceof Error ? e.message : "Falha ao carregar recorrências.")); }, []);
  async function create() {
    setBusy(true); setError(""); setMessage("");
    try {
      await bankingService.createRecurrence({ ...form, amount: parseMoney(form.amount) });
      setForm({ ...form, description: "", category: "", amount: "" }); await load();
      setMessage("Regra de recorrência cadastrada.");
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao cadastrar recorrência."); }
    finally { setBusy(false); }
  }
  async function generate() {
    setBusy(true); setError(""); setMessage("");
    try { const r = await bankingService.generateRecurrences(); setMessage(`${r.generated} lançamento(s) gerado(s) até o fim do próximo mês.`); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Erro ao gerar contas."); }
    finally { setBusy(false); }
  }
  async function disable(id: string) {
    setBusy(true); setError("");
    try { await bankingService.disableRecurrence(id); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Erro ao desativar."); }
    finally { setBusy(false); }
  }
  return <>
    <section className="card"><div className="card-header"><h2>Contas recorrentes</h2></div>
      <div className="card-body" style={{ display: "grid", gap: 14 }}>
        <p>Cadastre contas mensais. Clique em gerar para lançar vencimentos até o fim do próximo mês. Geração repetida não duplica as parcelas.</p>
        <div className="grid-2">
          <div className="field"><label>Tipo</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="PAYABLE">A pagar</option><option value="RECEIVABLE">A receber</option></select></div>
          <div className="field"><label>Primeiro vencimento</label><input type="date" value={form.nextDueDate} onChange={e => setForm({ ...form, nextDueDate: e.target.value })} /></div>
          <div className="field"><label>Descrição</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Aluguel" /></div>
          <div className="field"><label>Categoria</label><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Despesas fixas" /></div>
          <div className="field"><label>Valor (R$)</label><input inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="150,00" /></div>
        </div>
        {error && <p className="feedback-error">{error}</p>}{message && <p className="feedback-success">{message}</p>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button className="primary-button" disabled={busy} onClick={() => void create()}>Criar recorrência</button><button className="outline-button" disabled={busy} onClick={() => void generate()}>Gerar vencimentos</button></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Descrição</th><th>Valor</th><th>Próximo vencimento</th><th>Status</th><th></th></tr></thead><tbody>{rules.map(rule =>
          <tr key={rule.id}><td>{rule.description}</td><td>{brl(rule.amountCents / 100)}</td><td>{formatDate(rule.nextDueDate)}</td><td>{rule.active ? "Ativa" : "Desativada"}</td><td>{rule.active && <button className="outline-button" onClick={() => void disable(rule.id)}>Desativar</button>}</td></tr>
        )}</tbody></table></div>
      </div>
    </section>
    <section className="card"><div className="card-header"><h2>Auditoria financeira recente</h2></div><div className="card-body"><div className="table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Ação</th><th>Registro</th></tr></thead><tbody>{logs.slice(0,30).map(l => <tr key={l.id}><td>{formatDate(l.createdAt)}</td><td>{l.action}</td><td>{l.targetType} • {l.targetId.slice(0,8)}</td></tr>)}</tbody></table></div></div></section>
  </>;
}
