import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  LockKeyhole,
  PencilLine,
  Printer,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import { CashClosingDetailsModal } from "../PDV/CashClosingFlow";
import {
  authorizeCashClosingCorrection,
  correctCashClosing,
  getCashSessionSummary,
  listCashSessionHistory,
  type CashSession,
} from "../../services/cashSessionsService";
import "./CashClosingsPage.css";

type Props = { onLogout: () => void; onNavigate: (page: AppPage) => void };

type AuthorizedCorrection = {
  session: CashSession;
  authorizationToken: string;
  managerName: string;
};

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR") : "—";

const paymentLabel = (value: string) =>
  ({
    CASH: "Dinheiro",
    PIX: "Pix",
    CREDIT: "Cartão de crédito",
    DEBIT: "Cartão de débito",
  })[value] || value;

const isCash = (method: string) =>
  ["dinheiro", "cash"].includes(method.trim().toLowerCase());

const correctionReasons = [
  "Valor encontrado posteriormente",
  "Erro de contagem confirmado",
  "Comprovante localizado",
  "Ajuste de maquininha ou extrato",
  "Movimentação não considerada",
  "Outro",
];

function differenceLabel(value: number) {
  if (Math.abs(value) < 0.01) return brl(0);
  return value > 0 ? `+${brl(value)}` : brl(value);
}

export default function CashClosingsPage({ onLogout, onNavigate }: Props) {
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [printRequested, setPrintRequested] = useState(false);
  const [detailsRefreshKey, setDetailsRefreshKey] = useState(0);

  const [authorizationSession, setAuthorizationSession] =
    useState<CashSession | null>(null);
  const [managerName, setManagerName] = useState("");
  const [managerPin, setManagerPin] = useState("");
  const [authorizationError, setAuthorizationError] = useState("");
  const [authorizing, setAuthorizing] = useState(false);

  const [correction, setCorrection] =
    useState<AuthorizedCorrection | null>(null);
  const [correctedValues, setCorrectedValues] = useState<
    Record<string, string>
  >({});
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [correctionError, setCorrectionError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadSessions() {
    try {
      setError("");
      const result = await listCashSessionHistory();
      setSessions(result.sessions);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Erro ao carregar os fechamentos."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  const filteredSessions = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    return sessions.filter((session) => {
      const matchesSearch =
        !normalizedSearch ||
        session.closingCode?.toLocaleLowerCase("pt-BR").includes(normalizedSearch) ||
        session.operatorName?.toLocaleLowerCase("pt-BR").includes(normalizedSearch);
      const difference = Math.abs(session.difference || 0);
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "NO_DIFFERENCE" && difference < 0.01) ||
        (statusFilter === "JUSTIFIED" &&
          difference >= 0.01 &&
          session.closingStatus?.toLocaleLowerCase("pt-BR").includes("justificada")) ||
        (statusFilter === "PENDING" &&
          session.closingStatus?.toLocaleLowerCase("pt-BR").includes("aguardando"));
      return matchesSearch && matchesStatus;
    });
  }, [search, sessions, statusFilter]);

  function openAuthorization(session: CashSession) {
    setAuthorizationSession(session);
    setManagerName("");
    setManagerPin("");
    setAuthorizationError("");
  }

  function closeAuthorization() {
    if (authorizing) return;
    setAuthorizationSession(null);
    setManagerPin("");
    setAuthorizationError("");
  }

  async function handleAuthorization(event: FormEvent) {
    event.preventDefault();
    if (!authorizationSession) return;
    setAuthorizing(true);
    setAuthorizationError("");
    try {
      const [authorization, details] = await Promise.all([
        authorizeCashClosingCorrection(authorizationSession.id, {
          managerName,
          pin: managerPin,
        }),
        getCashSessionSummary(authorizationSession.id),
      ]);
      const rows =
        details.session.paymentSummary ||
        details.session.summary?.paymentMethods ||
        [];
      setCorrectedValues(
        Object.fromEntries(
          rows.map((row) => [
            row.method,
            String(row.confirmed ?? row.expected),
          ])
        )
      );
      setCorrection({
        session: details.session,
        authorizationToken: authorization.authorizationToken,
        managerName: authorization.manager.name,
      });
      setReason("");
      setNote("");
      setReviewing(false);
      setCorrectionError("");
      setAuthorizationSession(null);
      setManagerPin("");
    } catch (value) {
      setAuthorizationError(
        value instanceof Error ? value.message : "Não foi possível autorizar."
      );
    } finally {
      setAuthorizing(false);
    }
  }

  const correctionRows = useMemo(() => {
    if (!correction) return [];
    const rows =
      correction.session.paymentSummary ||
      correction.session.summary?.paymentMethods ||
      [];
    return rows.map((row) => {
      const rawValue = correctedValues[row.method];
      const parsed = Number(rawValue);
      const corrected =
        rawValue?.trim() && Number.isFinite(parsed) && parsed >= 0
          ? parsed
          : null;
      return {
        ...row,
        corrected,
        correctedDifference:
          corrected === null
            ? null
            : Math.round((corrected - row.expected + Number.EPSILON) * 100) /
              100,
      };
    });
  }, [correctedValues, correction]);

  const correctedDifference = correctionRows.reduce(
    (total, row) => total + (row.correctedDifference || 0),
    0
  );
  const correctedCash = correctionRows.find((row) => isCash(row.method));
  const correctionIsValid =
    correctionRows.length > 0 &&
    correctionRows.every((row) => row.corrected !== null) &&
    !!reason &&
    (reason !== "Outro" || !!note.trim());

  function closeCorrection() {
    if (saving) return;
    setCorrection(null);
    setReviewing(false);
    setCorrectionError("");
  }

  async function saveCorrection() {
    if (!correction || !correctionIsValid) return;
    setSaving(true);
    setCorrectionError("");
    try {
      await correctCashClosing(correction.session.id, {
        authorizationToken: correction.authorizationToken,
        correctedPayments: Object.fromEntries(
          correctionRows.map((row) => [row.method, row.corrected as number])
        ),
        reason,
        note: note.trim() || undefined,
      });
      const closingCode = correction.session.closingCode;
      const correctedId = correction.session.id;
      setCorrection(null);
      setReviewing(false);
      setSuccess(`Fechamento ${closingCode || ""} corrigido com sucesso.`);
      setSelectedId(correctedId);
      setDetailsRefreshKey((value) => value + 1);
      await loadSessions();
    } catch (value) {
      const message =
        value instanceof Error
          ? value.message
          : "Não foi possível salvar a correção.";
      setCorrectionError(message);
      if (message.toLocaleLowerCase("pt-BR").includes("autorização")) {
        setAuthorizationSession(correction.session);
        setAuthorizationError(message);
        setCorrection(null);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout
      activePage="cash-closings"
      onNavigate={onNavigate}
      onLogout={onLogout}
    >
      <div className="page-stack cash-closings-page">
        <div className="page-heading cash-closings-heading">
          <div>
            <h1><LockKeyhole /> Fechamentos de Caixa</h1>
            <p>
              Consulte e corrija fechamentos já encerrados. Cada correção fica
              registrada no comprovante.
            </p>
          </div>
        </div>

        {error && <p className="feedback-error">{error}</p>}
        {success && (
          <div className="feedback-success cash-closing-success">
            <CheckCircle2 /> {success}
            <button onClick={() => setSuccess("")} aria-label="Fechar aviso">
              <X />
            </button>
          </div>
        )}

        <section className="card cash-closings-card">
          <div className="cash-closings-filters">
            <label className="cash-closing-search">
              <Search />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por número ou operador..."
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filtrar por situação"
            >
              <option value="ALL">Todas as situações</option>
              <option value="NO_DIFFERENCE">Sem divergências</option>
              <option value="JUSTIFIED">Divergência justificada</option>
              <option value="PENDING">Aguardando análise</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Carregando fechamentos...</div>
          ) : (
            <>
              <div className="table-wrap cash-closings-table-wrap">
                <table className="data-table cash-closings-table">
                  <thead>
                    <tr>
                      <th>Fechamento</th>
                      <th>Operador</th>
                      <th className="right">Vendido</th>
                      <th className="right">Esperado</th>
                      <th className="right">Contado</th>
                      <th className="right">Diferença</th>
                      <th>Situação</th>
                      <th className="right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.map((session) => (
                      <tr key={session.id}>
                        <td>
                          <strong>{session.closingCode || session.id.slice(-8)}</strong>
                          <small>{formatDate(session.closedAt)}</small>
                        </td>
                        <td>{session.operatorName || "Não informado"}</td>
                        <td className="right">{brl(session.netSales || 0)}</td>
                        <td className="right">{brl(session.expectedCash || 0)}</td>
                        <td className="right">{brl(session.closingAmount || 0)}</td>
                        <td className={`right ${(session.difference || 0) < -0.009 ? "negative" : (session.difference || 0) > 0.009 ? "positive" : ""}`}>
                          {differenceLabel(session.difference || 0)}
                        </td>
                        <td>
                          <span className={`cash-closing-status ${Math.abs(session.difference || 0) < 0.01 ? "success" : "danger"}`}>
                            {session.closingStatus || "Fechado"}
                          </span>
                          {!!session.corrections?.length && (
                            <small className="corrected-mark">Corrigido</small>
                          )}
                        </td>
                        <td className="right">
                          <div className="cash-closing-actions">
                            <button onClick={() => { setPrintRequested(false); setSelectedId(session.id); }} aria-label="Visualizar fechamento" title="Visualizar">
                              <Eye />
                            </button>
                            <button onClick={() => openAuthorization(session)} aria-label="Corrigir fechamento" title="Corrigir">
                              <PencilLine />
                            </button>
                            <button onClick={() => { setPrintRequested(true); setSelectedId(session.id); }} aria-label="Imprimir fechamento" title="Imprimir">
                              <Printer />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="cash-closings-mobile-list">
                {filteredSessions.map((session) => (
                  <article key={session.id}>
                    <div className="cash-closing-mobile-head">
                      <div><strong>{session.closingCode || session.id.slice(-8)}</strong><small>{formatDate(session.closedAt)}</small></div>
                      <span className={`cash-closing-status ${Math.abs(session.difference || 0) < 0.01 ? "success" : "danger"}`}>
                        {session.closingStatus || "Fechado"}
                      </span>
                    </div>
                    <dl>
                      <div><dt>Operador</dt><dd>{session.operatorName || "Não informado"}</dd></div>
                      <div><dt>Vendido</dt><dd>{brl(session.netSales || 0)}</dd></div>
                      <div><dt>Esperado</dt><dd>{brl(session.expectedCash || 0)}</dd></div>
                      <div><dt>Contado</dt><dd>{brl(session.closingAmount || 0)}</dd></div>
                      <div><dt>Diferença</dt><dd>{differenceLabel(session.difference || 0)}</dd></div>
                    </dl>
                    <div className="cash-closing-mobile-actions">
                      <button className="outline-button" onClick={() => { setPrintRequested(false); setSelectedId(session.id); }}><Eye /> Visualizar</button>
                      <button className="primary-button" onClick={() => openAuthorization(session)}><PencilLine /> Corrigir</button>
                    </div>
                  </article>
                ))}
              </div>

              {!filteredSessions.length && (
                <div className="empty-state">Nenhum fechamento encontrado.</div>
              )}
            </>
          )}
        </section>
      </div>

      {selectedId && (
        <CashClosingDetailsModal
          sessionId={selectedId}
          refreshKey={detailsRefreshKey}
          autoPrint={printRequested}
          onClose={() => { setSelectedId(null); setPrintRequested(false); }}
          onCorrect={openAuthorization}
        />
      )}

      {authorizationSession && (
        <div className="manager-authorization-backdrop">
          <form className="manager-authorization-card" onSubmit={handleAuthorization}>
            <button type="button" className="cash-modal-close" onClick={closeAuthorization} aria-label="Fechar"><X /></button>
            <header>
              <span><ShieldCheck /></span>
              <div>
                <h2>Autorização de Gerente</h2>
                <p>Ação restrita: Editar fechamento {authorizationSession.closingCode}</p>
              </div>
            </header>
            <p className="manager-requested-by">
              Solicitado por <strong>{authorizationSession.operatorName || "Operador"}</strong>
            </p>
            {authorizationError && <p className="feedback-error">{authorizationError}</p>}
            <label className="field">
              <span>Usuário do gerente</span>
              <input autoFocus value={managerName} onChange={(event) => setManagerName(event.target.value)} placeholder="Digite o nome do gerente" autoComplete="username" />
            </label>
            <label className="field">
              <span>PIN</span>
              <input type="password" inputMode="numeric" maxLength={4} value={managerPin} onChange={(event) => setManagerPin(event.target.value.replace(/\D/g, ""))} placeholder="••••" autoComplete="current-password" />
            </label>
            <small className="manager-security-hint"><LockKeyhole /> A autorização é válida por 10 minutos e somente para este fechamento.</small>
            <footer>
              <button type="button" className="outline-button" onClick={closeAuthorization}>Cancelar</button>
              <button type="submit" className="primary-button" disabled={authorizing || !managerName.trim() || managerPin.length !== 4}>
                {authorizing ? "Autorizando..." : "Autorizar"}
              </button>
            </footer>
          </form>
        </div>
      )}

      {correction && (
        <div className="cash-correction-backdrop">
          <section className="cash-correction-card">
            <button className="cash-modal-close" onClick={closeCorrection} aria-label="Fechar"><X /></button>
            <header>
              <div>
                <h2>{reviewing ? "Confirmar correção" : `Corrigir fechamento ${correction.session.closingCode}`}</h2>
                <p>{reviewing ? "Revise os valores antes de registrar a alteração." : `Autorizado por ${correction.managerName}`}</p>
              </div>
            </header>

            {correctionError && <p className="feedback-error">{correctionError}</p>}

            {!reviewing ? (
              <div className="cash-correction-content">
                <div className="cash-correction-notice">
                  <ShieldCheck />
                  <div><strong>O fechamento original será preservado</strong><span>Esta correção ficará registrada no comprovante com o gerente responsável, data, valores anteriores e valores corrigidos.</span></div>
                </div>

                <div className="cash-correction-table-wrap">
                  <table className="cash-correction-table">
                    <thead><tr><th>Forma</th><th>Esperado</th><th>Informado no fechamento</th><th>Novo valor conferido</th><th>Nova diferença</th></tr></thead>
                    <tbody>
                      {correctionRows.map((row) => (
                        <tr key={row.method}>
                          <td><strong>{paymentLabel(row.method)}</strong><small>{row.sales} venda(s)</small></td>
                          <td>{brl(row.expected)}</td>
                          <td>{brl(row.confirmed || 0)}</td>
                          <td><input type="number" min="0" step="0.01" value={correctedValues[row.method] ?? ""} onChange={(event) => setCorrectedValues((values) => ({ ...values, [row.method]: event.target.value }))} aria-label={`Novo valor de ${paymentLabel(row.method)}`} /></td>
                          <td className={(row.correctedDifference || 0) < -0.009 ? "negative" : (row.correctedDifference || 0) > 0.009 ? "positive" : ""}>{row.correctedDifference === null ? "—" : differenceLabel(row.correctedDifference)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="cash-correction-summary">
                  <div><span>Dinheiro informado antes</span><strong>{brl(correction.session.closingAmount || 0)}</strong></div>
                  <div><span>Novo dinheiro conferido</span><strong>{correctedCash?.corrected === null ? "—" : brl(correctedCash?.corrected || 0)}</strong></div>
                  <div><span>Diferença após correção</span><strong className={correctedDifference < -0.009 ? "negative" : correctedDifference > 0.009 ? "positive" : ""}>{differenceLabel(correctedDifference)}</strong></div>
                </div>

                <div className="cash-correction-fields">
                  <label className="field"><span>Motivo da correção *</span><select value={reason} onChange={(event) => setReason(event.target.value)}><option value="">Selecione o motivo</option>{correctionReasons.map((item) => <option key={item}>{item}</option>)}</select></label>
                  <label className="field"><span>{reason === "Outro" ? "Descrição do motivo *" : "Observação"}</span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Explique o que foi encontrado e como a conferência foi realizada." /></label>
                </div>
              </div>
            ) : (
              <div className="cash-correction-review">
                <div className="cash-correction-review-icon"><AlertTriangle /></div>
                <h3>Confirme os dados da correção</h3>
                <p>Depois de confirmada, esta alteração não poderá ser apagada. Uma nova correção poderá ser registrada, mantendo todo o histórico.</p>
                <dl>
                  <div><dt>Fechamento</dt><dd>{correction.session.closingCode}</dd></div>
                  <div><dt>Gerente responsável</dt><dd>{correction.managerName}</dd></div>
                  <div><dt>Dinheiro contado</dt><dd>{brl(correction.session.closingAmount || 0)} → {brl(correctedCash?.corrected || 0)}</dd></div>
                  <div><dt>Diferença geral</dt><dd>{differenceLabel(correction.session.difference || 0)} → {differenceLabel(correctedDifference)}</dd></div>
                  <div><dt>Nova situação</dt><dd>{Math.abs(correctedDifference) < 0.01 ? "Fechado sem divergências" : "Fechado com divergência justificada"}</dd></div>
                  <div><dt>Motivo</dt><dd>{reason}</dd></div>
                  {note && <div><dt>Observação</dt><dd>{note}</dd></div>}
                </dl>
              </div>
            )}

            <footer>
              <button className="outline-button" onClick={() => reviewing ? setReviewing(false) : closeCorrection()} disabled={saving}>{reviewing ? "Voltar e revisar" : "Cancelar"}</button>
              {!reviewing ? (
                <button className="primary-button" onClick={() => setReviewing(true)} disabled={!correctionIsValid}>Revisar correção</button>
              ) : (
                <button className="primary-button" onClick={saveCorrection} disabled={saving}>{saving ? "Registrando correção..." : "Confirmar correção"}</button>
              )}
            </footer>
          </section>
        </div>
      )}
    </AdminLayout>
  );
}
