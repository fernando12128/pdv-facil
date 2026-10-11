import { useEffect, useState, type FormEvent } from "react";
import { ArrowDownCircle, ArrowUpCircle, Plus, Wallet } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import { financeService, type FinancialEntry, type FinanceReport } from "../../services/financeService";
import "./FinancePage.css";
type Props = { onLogout: () => void; onNavigate: (page: AppPage) => void };
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const localDate = (s: string) => new Date(s).toLocaleDateString("pt-BR", { timeZone: "UTC" });
const today = () => new Date().toLocaleDateString("en-CA");
export default function FinancePage({ onLogout, onNavigate }: Props) {
  const [month, setMonth] = useState(new Date().toISOString().slice(0,7));
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [tab, setTab] = useState<"entries" | "dre" | "cash">("entries");
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ type: "PAYABLE" as FinancialEntry["type"], description: "", category: "", amount: "", dueDate: today(), notes: "" });
  async function load() {
    try {
      const [list, report] = await Promise.all([financeService.list(), financeService.report(month)]);
      setEntries(list.entries); setReport(report); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar o financeiro."); }
  }
  useEffect(() => { void load(); }, [month]);
  const filtered = entries.filter(e => e.dueDate.slice(0, 7) === month);
  async function create(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await financeService.create({ ...form, amount: Number(form.amount) });
      setModal(false);
      setForm({ type: "PAYABLE", description: "", category: "", amount: "", dueDate: today(), notes: "" });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Erro ao salvar."); }
    finally { setBusy(false); }
  }
  async function act(id: string, type: "settle" | "remove") {
    if (type === "remove" && !window.confirm("Excluir este lançamento em aberto?")) return;
    setBusy(true);
    try { if (type === "settle") await financeService.settle(id); else await financeService.remove(id); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Falha na operação."); }
    finally { setBusy(false); }
  }
  return <AdminLayout activePage="finance" onNavigate={onNavigate} onLogout={onLogout}>
    <div className="page-stack">
      <div className="page-heading"><div><h1>Financeiro</h1><p>Contas a pagar, receber e resultados gerenciais</p></div>
        <div className="finance-heading-actions"><input aria-label="Mês de referência" className="search-input" type="month" value={month} onChange={e => setMonth(e.target.value)} /><button className="primary-button" onClick={() => setModal(true)}><Plus /> Novo lançamento</button></div>
      </div>
      {error && <p role="alert" className="feedback-error">{error}</p>}
      <div className="finance-stats">
        <section className="card finance-stat"><div><span>Recebimentos confirmados</span><ArrowDownCircle /></div><strong>{brl(report?.cashFlow.confirmedInflows || 0)}</strong></section>
        <section className="card finance-stat"><div><span>Pagamentos realizados</span><ArrowUpCircle /></div><strong>{brl(report?.cashFlow.confirmedOutflows || 0)}</strong></section>
        <section className="card finance-stat"><div><span>Saldo do fluxo manual</span><Wallet /></div><strong>{brl(report?.cashFlow.net || 0)}</strong></section>
        <section className="card finance-stat"><div><span>A pagar em aberto no mês</span><ArrowUpCircle /></div><strong>{brl(report?.cashFlow.pendingOutflows || 0)}</strong></section>
      </div>
      <div className="finance-tabs"><button className={tab==="entries"?"active":""} onClick={()=>setTab("entries")}>Contas a pagar / receber</button><button className={tab==="dre"?"active":""} onClick={()=>setTab("dre")}>DRE gerencial</button><button className={tab==="cash"?"active":""} onClick={()=>setTab("cash")}>Fluxo de caixa</button></div>
      {tab==="entries" && <section className="card"><div className="card-header"><h2>Lançamentos do mês</h2></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Descrição</th><th>Tipo</th><th>Categoria</th><th>Vencimento</th><th>Status</th><th className="right">Valor</th><th className="right">Ações</th></tr></thead><tbody>{filtered.map(e=><tr key={e.id}><td><strong>{e.description}</strong></td><td>{e.type==="PAYABLE"?"A pagar":"A receber"}</td><td>{e.category}</td><td>{localDate(e.dueDate)}</td><td><span className={`badge ${e.status==="SETTLED"?"success":new Date(e.dueDate)<new Date()?"danger":"warning"}`}>{e.status==="SETTLED"?"Liquidado":"Em aberto"}</span></td><td className="right">{brl(e.amount)}</td><td className="right">{e.status==="OPEN" && <div className="finance-actions"><button disabled={busy} className="outline-button" onClick={()=>void act(e.id,"settle")}>Liquidar</button><button disabled={busy} className="outline-button" onClick={()=>void act(e.id,"remove")}>Excluir</button></div>}</td></tr>)}</tbody></table>{!filtered.length && <div className="empty-state">Nenhum lançamento com vencimento neste mês.</div>}</div></section>}
      {tab==="dre" && <section className="card"><div className="card-header"><h2>Demonstração de resultado gerencial</h2></div><div className="card-body finance-report">{[["Receita de vendas (PDV)",report?.dre.salesRevenue],["Outras receitas liquidadas", report?.dre.otherRevenue],["Despesas liquidadas", -(report?.dre.expenses||0)],["Resultado gerencial preliminar",report?.dre.result]].map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{brl(Number(value || 0))}</strong></div>)}<p>{report?.dre.basis}</p><h3>Despesas por categoria</h3>{report?.dre.categories.map(c=><div key={c.category}><span>{c.category}</span><strong>{brl(c.total)}</strong></div>)}</div></section>}
      {tab==="cash" && <section className="card"><div className="card-header"><h2>Fluxo de caixa manual</h2></div><div className="card-body finance-report">{[["Entradas confirmadas",report?.cashFlow.confirmedInflows],["Saídas confirmadas",report?.cashFlow.confirmedOutflows],["Saldo do período",report?.cashFlow.net],["A receber em aberto",report?.cashFlow.pendingInflows],["A pagar em aberto",report?.cashFlow.pendingOutflows]].map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{brl(Number(value||0))}</strong></div>)}<p>{report?.cashFlow.notice}</p></div></section>}
      <p className="finance-note">Conciliação bancária e de maquininhas via API: planejada para uma próxima fase. Valores não representam saldo bancário.</p>
    </div>
    {modal && <div className="modal-backdrop" onClick={()=>setModal(false)}><div className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-header"><h2>Novo lançamento financeiro</h2><p>Registre contas a pagar ou receber</p></div><form onSubmit={e=>void create(e)}><div className="modal-body form-grid">
      <div className="field"><label>Tipo</label><select value={form.type} onChange={e=>setForm({...form,type:e.target.value as FinancialEntry["type"]})}><option value="PAYABLE">Conta a pagar</option><option value="RECEIVABLE">Conta a receber</option></select></div>
      <div className="field"><label>Categoria</label><input required value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Ex.: Aluguel, fornecedores" /></div>
      <div className="field finance-full"><label>Descrição</label><input required value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></div>
      <div className="field"><label>Valor (R$)</label><input required type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} /></div>
      <div className="field"><label>Vencimento</label><input required type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})} /></div>
      <div className="field finance-full"><label>Observações (opcional)</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
      </div><div className="modal-actions"><button type="button" className="outline-button" onClick={()=>setModal(false)}>Cancelar</button><button disabled={busy} className="primary-button" type="submit">{busy?"Salvando...":"Salvar lançamento"}</button></div></form></div></div>}
  </AdminLayout>;
}
