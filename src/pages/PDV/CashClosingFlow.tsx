import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calculator,
  CheckCircle2,
  Eye,
  FileText,
  Info,
  History,
  LockKeyhole,
  PencilLine,
  Printer,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  closeCashSession,
  getCashSessionPreview,
  getCashSessionSummary,
  type CashSession,
  type PaymentReconciliation,
} from "../../services/cashSessionsService";
import type { Sale } from "../../services/salesService";
import "./CashClosingFlow.css";

type Props = {
  session: CashSession;
  operatorFallback: string;
  onCancel: () => void;
  onClosed: () => void;
};

type DetailProps = {
  sessionId: string;
  onClose: () => void;
  onCorrect?: (session: CashSession) => void;
  refreshKey?: number;
  autoPrint?: boolean;
};

const brl = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

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

const duration = (openedAt: string, closedAt?: string | null) => {
  const end = closedAt ? new Date(closedAt).getTime() : Date.now();
  const minutes = Math.max(
    0,
    Math.floor((end - new Date(openedAt).getTime()) / 60000)
  );
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
};

const saleCode = (sale: Sale) => `#${sale.id.slice(-6).toUpperCase()}`;

const denominations = [
  200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05,
];

const discrepancyReasons = [
  "Erro de troco",
  "Forma de pagamento registrada incorretamente",
  "Sangria ou suprimento não registrado",
  "Diferença na maquininha",
  "Erro de contagem",
  "Cancelamento ou estorno",
  "Motivo não identificado",
  "Outro",
];

function differenceText(value: number) {
  if (Math.abs(value) < 0.01) return `${brl(0)} (sem diferença)`;
  return value > 0 ? `+${brl(value)} (sobra)` : `${brl(value)} (falta)`;
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="closing-stepper" aria-label="Etapas do fechamento">
      {["Resumo e vendas", "Conferência", "Divergências", "Revisão"].map(
        (label, index) => {
          const number = index + 1;
          return (
            <div
              className={`closing-step ${number <= step ? "active" : ""} ${
                number === step ? "current" : ""
              }`}
              key={label}
            >
              <span>{number}</span>
              {label}
            </div>
          );
        }
      )}
    </div>
  );
}

function InfoGrid({
  rows,
  className = "",
}: {
  rows: { label: string; value: string; strong?: boolean }[];
  className?: string;
}) {
  return (
    <div className={`closing-info-grid ${className}`}>
      {rows.map((row) => (
        <div className={row.strong ? "strong" : ""} key={row.label}>
          <span>{row.label}</span>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}

function SaleDetails({
  sale,
  onClose,
}: {
  sale: Sale;
  onClose: () => void;
}) {
  return (
    <div className="closing-nested-backdrop">
      <div className="closing-confirm-card sale-detail-card">
        <button className="closing-x" onClick={onClose} aria-label="Fechar">
          <X />
        </button>
        <h2>Venda {saleCode(sale)}</h2>
        <p>{formatDate(sale.createdAt)}</p>
        <div className="closing-detail-list">
          {sale.items.map((item) => (
            <div key={item.id}>
              <span>
                {item.quantity}× {item.productName}
                <small>{brl(item.unitPrice)} por unidade</small>
              </span>
              <strong>{brl(item.total)}</strong>
            </div>
          ))}
        </div>
        <InfoGrid
          rows={[
            { label: "Subtotal", value: brl(sale.subtotal) },
            { label: "Desconto", value: brl(sale.discount) },
            { label: "Pagamento", value: paymentLabel(sale.paymentMethod) },
            { label: "Total final", value: brl(sale.total), strong: true },
          ]}
        />
        <div className="closing-confirm-actions">
          <button className="secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function ClosingReadOnly({
  session,
  onPrint,
  onCorrect,
}: {
  session: CashSession;
  onPrint: () => void;
  onCorrect?: () => void;
}) {
  const summary = session.summary;
  if (!summary) return null;

  const rows =
    (session.paymentSummary as PaymentReconciliation[] | null) ||
    summary.paymentMethods;
  const cashDifference =
    rows.find((row) => isCash(row.method))?.difference || 0;

  return (
    <div className="closing-readonly-print">
      <div className="closing-status-line">
        <span className="closing-code">
          Fechamento {session.closingCode || session.id.slice(-8)}
        </span>
        <span
          className={`closing-status ${
            Math.abs(session.difference || 0) >= 0.01 ? "danger" : "success"
          }`}
        >
          {session.closingStatus || "Fechado"}
        </span>
      </div>

      <InfoGrid
        rows={[
          {
            label: "Operador",
            value: session.operatorName || "Não informado",
          },
          {
            label: "Duração",
            value: duration(session.openedAt, session.closedAt),
          },
          { label: "Abertura", value: formatDate(session.openedAt) },
          { label: "Fechamento", value: formatDate(session.closedAt) },
        ]}
      />

      <h3>Vendas</h3>
      <InfoGrid
        rows={[
          { label: "Quantidade de vendas", value: String(summary.saleCount) },
          { label: "Total bruto", value: brl(summary.grossSales) },
          { label: "Descontos", value: brl(summary.discounts) },
          {
            label: "Cancelamentos",
            value: brl(summary.cancelledTotal),
          },
          { label: "Estornos", value: brl(summary.refundedTotal) },
          {
            label: "Total líquido",
            value: brl(summary.netSales),
            strong: true,
          },
        ]}
      />

      <h3>Movimentações</h3>
      <InfoGrid
        rows={[
          { label: "Valor inicial", value: brl(session.openingAmount) },
          { label: "Suprimentos", value: brl(summary.supplies) },
          { label: "Sangrias", value: brl(summary.withdrawals) },
          { label: "Devoluções em dinheiro", value: brl(0) },
        ]}
      />

      <h3>Conferência</h3>
      <div className="closing-table-wrap">
        <table className="closing-table">
          <thead>
            <tr>
              <th>Forma</th>
              <th>Esperado</th>
              <th>Conferido</th>
              <th>Diferença</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.method}>
                <td>{paymentLabel(row.method)}</td>
                <td>{brl(row.expected)}</td>
                <td>{row.confirmed === null ? "—" : brl(row.confirmed)}</td>
                <td>
                  {row.difference === null
                    ? "—"
                    : differenceText(row.difference)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InfoGrid
        className="closing-highlight-grid"
        rows={[
          {
            label: "Dinheiro esperado na gaveta",
            value: brl(session.expectedCash ?? summary.expectedCash),
          },
          {
            label: "Dinheiro contado",
            value: brl(session.closingAmount || 0),
          },
          {
            label: "Diferença em dinheiro",
            value: differenceText(cashDifference),
            strong: true,
          },
          {
            label: "Contagens realizadas",
            value: String(session.countHistory?.length || 1),
          },
        ]}
      />

      {session.discrepancyReason && (
        <section className="closing-justification-box">
          <h3>Justificativas</h3>
          <InfoGrid
            rows={[
              { label: "Motivo", value: session.discrepancyReason },
              {
                label: "Observação",
                value: session.discrepancyNote || "Não informada",
              },
              {
                label: "Ação tomada",
                value: session.actionTaken || "Não informada",
              },
            ]}
          />
        </section>
      )}

      {!!session.corrections?.length && (
        <section className="closing-corrections-box">
          <h3><History /> Histórico de correções</h3>
          <p>
            O fechamento original foi preservado. As alterações abaixo fazem
            parte do comprovante e não podem ser apagadas.
          </p>
          <div className="closing-correction-timeline">
            {session.corrections.map((correction, index) => (
              <article key={correction.id}>
                <div className="closing-correction-heading">
                  <strong>Correção {index + 1}</strong>
                  <span>{formatDate(correction.createdAt)}</span>
                </div>
                <InfoGrid
                  rows={[
                    {
                      label: "Gerente responsável",
                      value: correction.authorizedManagerName,
                    },
                    {
                      label: "Solicitada por",
                      value: correction.requestedByName,
                    },
                    {
                      label: "Valor contado",
                      value: `${brl(correction.previousClosingAmount)} → ${brl(correction.correctedClosingAmount)}`,
                    },
                    {
                      label: "Diferença geral",
                      value: `${differenceText(correction.previousDifference)} → ${differenceText(correction.correctedDifference)}`,
                    },
                    { label: "Motivo", value: correction.reason },
                    {
                      label: "Observação",
                      value: correction.note || "Não informada",
                    },
                  ]}
                />
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="closing-readonly-actions">
        {onCorrect && (
          <button className="secondary" onClick={onCorrect}>
            <PencilLine /> Corrigir
          </button>
        )}
        <button className="secondary" onClick={onPrint}>
          <Printer /> Imprimir
        </button>
      </div>
    </div>
  );
}

export function CashClosingDetailsModal({
  sessionId,
  onClose,
  onCorrect,
  refreshKey = 0,
  autoPrint = false,
}: DetailProps) {
  const [session, setSession] = useState<CashSession | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getCashSessionSummary(sessionId)
      .then((result) => {
        setSession(result.session);
        if (autoPrint) {
          window.setTimeout(() => window.print(), 100);
        }
      })
      .catch((value) =>
        setError(
          value instanceof Error
            ? value.message
            : "Erro ao carregar o fechamento."
        )
      );
  }, [autoPrint, sessionId, refreshKey]);

  return (
    <div className="closing-backdrop">
      <section className="closing-modal closing-history-modal">
        <button className="closing-x" onClick={onClose} aria-label="Fechar">
          <X />
        </button>
        <header className="closing-modal-header">
          <h2>
            Fechamento {session?.closingCode || ""}
            {!onCorrect && <small>(somente leitura)</small>}
          </h2>
        </header>
        {error && <p className="closing-error">{error}</p>}
        {!session && !error && <div className="closing-loading">Carregando...</div>}
        {session && (
          <ClosingReadOnly
            session={session}
            onPrint={() => window.print()}
            onCorrect={onCorrect ? () => onCorrect(session) : undefined}
          />
        )}
      </section>
    </div>
  );
}

export default function CashClosingFlow({
  session,
  operatorFallback,
  onCancel,
  onClosed,
}: Props) {
  const [details, setDetails] = useState<CashSession | null>(null);
  const [step, setStep] = useState(1);
  const [saleSearch, setSaleSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [cashMode, setCashMode] = useState<"simple" | "assisted">("simple");
  const [cashCount, setCashCount] = useState("");
  const [denominationCounts, setDenominationCounts] = useState<
    Record<string, string>
  >({});
  const [confirmedPayments, setConfirmedPayments] = useState<
    Record<string, string>
  >({});
  const [countHistory, setCountHistory] = useState<number[]>([]);
  const [discrepancyReason, setDiscrepancyReason] = useState("");
  const [discrepancyNote, setDiscrepancyNote] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [finalNote, setFinalNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closedSession, setClosedSession] = useState<CashSession | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getCashSessionPreview(session.id)
      .then((result) => setDetails(result.session))
      .catch((value) =>
        setError(
          value instanceof Error
            ? value.message
            : "Erro ao carregar o fechamento."
        )
      );
  }, [session.id]);

  const summary = details?.summary;
  const sales = useMemo(() => details?.sales || [], [details?.sales]);
  const assistedWasEntered = Object.values(denominationCounts).some(
    (value) => value !== ""
  );
  const assistedTotal = denominations.reduce((total, value) => {
    const quantity = Number(denominationCounts[String(value)]) || 0;
    return total + value * quantity;
  }, 0);
  const cashWasEntered =
    cashMode === "simple" ? cashCount !== "" : assistedWasEntered;
  const countedCash =
    cashMode === "simple" ? Number(cashCount) || 0 : assistedTotal;

  const reconciliations = useMemo(() => {
    if (!summary) return [];
    return summary.paymentMethods.map((payment) => {
      const confirmed = isCash(payment.method)
        ? cashWasEntered
          ? countedCash
          : null
        : confirmedPayments[payment.method] === undefined ||
            confirmedPayments[payment.method] === ""
          ? null
          : Number(confirmedPayments[payment.method]);
      return {
        ...payment,
        confirmed,
        difference:
          confirmed === null
            ? null
            : Math.round((confirmed - payment.expected) * 100) / 100,
      };
    });
  }, [
    cashWasEntered,
    confirmedPayments,
    countedCash,
    summary,
  ]);

  const divergences = reconciliations.filter(
    (payment) =>
      payment.difference !== null && Math.abs(payment.difference) >= 0.01
  );
  const totalDifference = reconciliations.reduce(
    (sum, payment) => sum + (payment.difference || 0),
    0
  );
  const cashDifference =
    reconciliations.find((payment) => isCash(payment.method))?.difference || 0;

  const filteredSales = sales.filter((sale) => {
    const searchValue = `${saleCode(sale)} ${sale.customerName || ""}`
      .toLowerCase()
      .includes(saleSearch.toLowerCase());
    const paymentValue =
      paymentFilter === "ALL" || sale.paymentMethod === paymentFilter;
    const statusValue = statusFilter === "ALL" || sale.status === statusFilter;
    return searchValue && paymentValue && statusValue;
  });

  const canExplain =
    discrepancyReason &&
    (discrepancyReason !== "Outro" || discrepancyNote.trim());

  function goFromConference() {
    setError("");
    const pending = reconciliations.find(
      (payment) => payment.confirmed === null
    );
    if (pending) {
      setError(`Confira ${paymentLabel(pending.method)} antes de continuar.`);
      return;
    }
    setCountHistory((current) => [
      ...current.filter((value) => value !== countedCash),
      countedCash,
    ]);
    setStep(divergences.length ? 3 : 4);
  }

  function recount() {
    setCashCount("");
    setDenominationCounts({});
    setStep(2);
  }

  async function finishClosing() {
    if (!summary) return;
    try {
      setSaving(true);
      setError("");
      const response = await closeCashSession(session.id, {
        closingAmount: countedCash,
        confirmedPayments: Object.fromEntries(
          reconciliations
            .filter((payment) => !isCash(payment.method))
            .map((payment) => [payment.method, payment.confirmed || 0])
        ),
        countHistory:
          countHistory.length > 0 ? countHistory : [countedCash],
        discrepancyReason,
        discrepancyNote,
        actionTaken,
        finalNote,
      });
      setConfirming(false);
      setClosedSession({
        ...response.session,
        summary,
        sales,
        movements: details?.movements,
        paymentSummary: reconciliations,
      });
    } catch (value) {
      setConfirming(false);
      setError(
        value instanceof Error ? value.message : "Erro ao fechar o caixa."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!details || !summary) {
    return (
      <div className="closing-backdrop">
        <section className="closing-modal closing-loading-modal">
          <button className="closing-x" onClick={onCancel} aria-label="Fechar">
            <X />
          </button>
          {error ? (
            <>
              <AlertTriangle />
              <h2>Não foi possível carregar o fechamento</h2>
              <p>{error}</p>
              <button className="secondary" onClick={onCancel}>
                Voltar
              </button>
            </>
          ) : (
            <div className="closing-loading">Carregando fechamento...</div>
          )}
        </section>
      </div>
    );
  }

  if (closedSession) {
    return (
      <>
        <div className="closing-backdrop">
          <section className="closing-success-modal">
            <button
              className="closing-x"
              onClick={onClosed}
              aria-label="Fechar"
            >
              <X />
            </button>
            <header>
              <CheckCircle2 />
              <div>
                <h2>Caixa fechado com sucesso</h2>
                <p>
                  Fechamento {closedSession.closingCode} registrado.
                </p>
              </div>
            </header>
            <InfoGrid
              className="closing-success-grid"
              rows={[
                {
                  label: "Número do fechamento",
                  value: closedSession.closingCode || "—",
                },
                {
                  label: "Caixa / Operador",
                  value: `Caixa 01 • ${
                    session.operatorName || operatorFallback
                  }`,
                },
                {
                  label: "Período",
                  value: `${formatDate(session.openedAt)} → ${formatDate(
                    closedSession.closedAt
                  )}`,
                },
                {
                  label: "Total vendido",
                  value: brl(summary.netSales),
                },
                {
                  label: "Dinheiro esperado na gaveta",
                  value: brl(summary.expectedCash),
                },
                {
                  label: "Dinheiro contado",
                  value: brl(countedCash),
                },
                {
                  label: "Diferença em dinheiro",
                  value: differenceText(cashDifference),
                },
              ]}
            />
            <span
              className={`closing-status ${
                divergences.length ? "danger" : "success"
              }`}
            >
              {divergences.length
                ? "Fechado com divergência justificada"
                : "Fechado sem divergências"}
            </span>
            <div className="closing-success-actions">
              <button className="secondary" onClick={() => window.print()}>
                <Printer /> Imprimir resumo
              </button>
              <button className="secondary" onClick={() => window.print()}>
                <FileText /> Gerar PDF
              </button>
              <button
                className="secondary"
                onClick={() => setDetailsOpen(true)}
              >
                <Eye /> Fechamento completo
              </button>
              <button className="primary" onClick={onClosed}>
                Voltar ao painel
              </button>
            </div>
          </section>
        </div>
        {detailsOpen && (
          <CashClosingDetailsModal
            sessionId={closedSession.id}
            onClose={() => setDetailsOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="closing-backdrop">
      <section className="closing-modal">
        <button className="closing-x" onClick={onCancel} aria-label="Fechar">
          <X />
        </button>
        <header className="closing-modal-header">
          <h2>
            <LockKeyhole /> Fechamento de caixa
          </h2>
          <p>
            Confira tudo o que foi registrado nesta sessão antes de encerrá-la.
          </p>
        </header>
        <Stepper step={step} />

        <div className="closing-scroll-area">
          {error && <p className="closing-error">{error}</p>}

          {step === 1 && (
            <div className="closing-step-content">
              <InfoGrid
                className="closing-session-card"
                rows={[
                  { label: "Caixa", value: "Caixa 01" },
                  {
                    label: "Operador",
                    value: session.operatorName || operatorFallback,
                  },
                  { label: "Aberto em", value: formatDate(session.openedAt) },
                  {
                    label: "Valor inicial",
                    value: brl(session.openingAmount),
                  },
                  {
                    label: "Duração do turno",
                    value: duration(session.openedAt),
                  },
                ]}
              />

              <div className="closing-stats">
                <article>
                  <span>Total líquido vendido</span>
                  <strong>{brl(summary.netSales)}</strong>
                </article>
                <article>
                  <span>Vendas realizadas</span>
                  <strong>{summary.saleCount}</strong>
                </article>
                <article>
                  <span>Ticket médio</span>
                  <strong>{brl(summary.averageTicket)}</strong>
                </article>
              </div>

              <InfoGrid
                className="closing-summary-card"
                rows={[
                  { label: "Total bruto", value: brl(summary.grossSales) },
                  { label: "Descontos", value: brl(summary.discounts) },
                  {
                    label: `Cancelamentos (${summary.cancelledSales})`,
                    value: brl(summary.cancelledTotal),
                  },
                  {
                    label: `Estornos (${summary.refundedSales})`,
                    value: brl(summary.refundedTotal),
                  },
                  {
                    label: "Total de suprimentos",
                    value: brl(summary.supplies),
                  },
                  {
                    label: "Total de sangrias",
                    value: brl(summary.withdrawals),
                  },
                ]}
              />

              <section className="closing-sales-section">
                <h3>Vendas do turno</h3>
                <div className="closing-filters">
                  <label>
                    <Search />
                    <input
                      placeholder="Número da venda ou cliente"
                      value={saleSearch}
                      onChange={(event) => setSaleSearch(event.target.value)}
                    />
                  </label>
                  <select
                    value={paymentFilter}
                    onChange={(event) => setPaymentFilter(event.target.value)}
                  >
                    <option value="ALL">Todos os pagamentos</option>
                    {Array.from(new Set(sales.map((sale) => sale.paymentMethod))).map(
                      (method) => (
                        <option value={method} key={method}>
                          {paymentLabel(method)}
                        </option>
                      )
                    )}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="ALL">Todas as situações</option>
                    <option value="COMPLETED">Concluídas</option>
                    <option value="CANCELLED">Canceladas</option>
                  </select>
                </div>
                <div className="closing-table-wrap">
                  <table className="closing-table sales-table">
                    <thead>
                      <tr>
                        <th>Venda</th>
                        <th>Horário</th>
                        <th>Pagamento</th>
                        <th>Total</th>
                        <th>Situação</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSales.map((sale) => (
                        <tr
                          className={sale.total <= 0 ? "zero-sale" : ""}
                          key={sale.id}
                        >
                          <td>{saleCode(sale)}</td>
                          <td>
                            {new Date(sale.createdAt).toLocaleTimeString(
                              "pt-BR",
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                          </td>
                          <td>{paymentLabel(sale.paymentMethod)}</td>
                          <td>{brl(sale.total)}</td>
                          <td>
                            <span
                              className={`closing-status ${
                                sale.status === "COMPLETED"
                                  ? "success"
                                  : "danger"
                              }`}
                            >
                              {sale.total <= 0
                                ? "Venda zerada"
                                : sale.status === "COMPLETED"
                                  ? "Concluída"
                                  : "Cancelada"}
                            </span>
                          </td>
                          <td>
                            <button
                              className="closing-view-button"
                              onClick={() => setSelectedSale(sale)}
                            >
                              Ver
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filteredSales.length && (
                    <div className="closing-empty">
                      Nenhuma venda registrada nesta sessão.
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {step === 2 && (
            <div className="closing-step-content">
              <div className="closing-tip">
                <Info />
                <span>
                  O valor esperado é calculado com base nas vendas e
                  movimentações desta sessão. Informe o valor realmente
                  encontrado — o sistema calcula a diferença automaticamente.
                </span>
              </div>

              <section>
                <h3>Movimentações do dinheiro (somente consulta)</h3>
                <div className="closing-table-wrap">
                  <table className="closing-table">
                    <thead>
                      <tr>
                        <th>Horário</th>
                        <th>Movimento</th>
                        <th>Descrição</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{formatDate(session.openedAt)}</td>
                        <td>Abertura</td>
                        <td>Fundo de troco</td>
                        <td className="positive">
                          + {brl(session.openingAmount)}
                        </td>
                      </tr>
                      {(details.movements || []).map((movement) => (
                        <tr key={movement.id}>
                          <td>{formatDate(movement.createdAt)}</td>
                          <td>
                            {movement.type === "SUPPLY"
                              ? "Suprimento"
                              : "Sangria"}
                          </td>
                          <td>{movement.note || "Sem observação"}</td>
                          <td
                            className={
                              movement.type === "SUPPLY"
                                ? "positive"
                                : "negative"
                            }
                          >
                            {movement.type === "SUPPLY" ? "+" : "-"}{" "}
                            {brl(movement.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <InfoGrid
                  rows={[
                    { label: "Valor inicial", value: brl(session.openingAmount) },
                    { label: "Suprimentos", value: brl(summary.supplies) },
                    { label: "Sangrias", value: brl(summary.withdrawals) },
                    { label: "Devoluções em dinheiro", value: brl(0) },
                  ]}
                />
              </section>

              <section className="closing-reconciliation">
                <h3>Conciliação por forma de pagamento</h3>
                {reconciliations.map((payment) => (
                  <article className="payment-reconciliation" key={payment.method}>
                    <div>
                      <strong>{paymentLabel(payment.method)}</strong>
                      <small>
                        {payment.sales} venda(s) • Esperado{" "}
                        {brl(payment.expected)}
                      </small>
                    </div>
                    {!isCash(payment.method) && (
                      <label>
                        Valor conferido
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={confirmedPayments[payment.method] || ""}
                          onChange={(event) =>
                            setConfirmedPayments((current) => ({
                              ...current,
                              [payment.method]: event.target.value,
                            }))
                          }
                        />
                      </label>
                    )}
                    <div>
                      <span>Conferido</span>
                      <strong>
                        {payment.confirmed === null
                          ? "—"
                          : brl(payment.confirmed)}
                      </strong>
                    </div>
                    <div>
                      <span>Diferença</span>
                      <strong>
                        {payment.difference === null
                          ? "—"
                          : differenceText(payment.difference)}
                      </strong>
                    </div>
                    <span
                      className={`closing-status ${
                        payment.difference === null
                          ? ""
                          : Math.abs(payment.difference) < 0.01
                            ? "success"
                            : "danger"
                      }`}
                    >
                      {payment.difference === null
                        ? "Não conferido"
                        : Math.abs(payment.difference) < 0.01
                          ? "Conferido"
                          : payment.difference > 0
                            ? "Valor acima"
                            : "Valor abaixo"}
                    </span>
                  </article>
                ))}
                <p className="closing-hint">
                  Pix e cartões são conferidos no extrato ou na maquininha —
                  não misture com o dinheiro físico da gaveta.
                </p>
              </section>

              <section className="cash-counting">
                <h3>
                  <Calculator /> Contagem do dinheiro
                </h3>
                <div className="cash-formula">
                  <InfoGrid
                    rows={[
                      {
                        label: "Valor inicial",
                        value: brl(session.openingAmount),
                      },
                      {
                        label: "+ Vendas em dinheiro",
                        value: brl(summary.cashSales),
                      },
                      {
                        label: "+ Suprimentos",
                        value: brl(summary.supplies),
                      },
                      {
                        label: "- Sangrias",
                        value: brl(summary.withdrawals),
                      },
                      {
                        label: "- Devoluções em dinheiro",
                        value: brl(0),
                      },
                      {
                        label: "Valor esperado na gaveta",
                        value: brl(summary.expectedCash),
                        strong: true,
                      },
                    ]}
                  />
                </div>
                <div className="cash-count-tabs">
                  <button
                    className={cashMode === "simple" ? "active" : ""}
                    onClick={() => setCashMode("simple")}
                  >
                    Informar total
                  </button>
                  <button
                    className={cashMode === "assisted" ? "active" : ""}
                    onClick={() => setCashMode("assisted")}
                  >
                    Contagem assistida
                  </button>
                </div>
                {cashMode === "simple" ? (
                  <label className="closing-field">
                    Total contado na gaveta (R$)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cashCount}
                      onChange={(event) => setCashCount(event.target.value)}
                    />
                  </label>
                ) : (
                  <div className="denomination-grid">
                    {denominations.map((value) => (
                      <label key={value}>
                        {brl(value)}
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={denominationCounts[String(value)] || ""}
                          onChange={(event) =>
                            setDenominationCounts((current) => ({
                              ...current,
                              [String(value)]: event.target.value,
                            }))
                          }
                        />
                      </label>
                    ))}
                    <div className="denomination-total">
                      <span>Total contado</span>
                      <strong>{brl(assistedTotal)}</strong>
                    </div>
                  </div>
                )}
                <InfoGrid
                  className="closing-count-result"
                  rows={[
                    {
                      label: "Valor esperado",
                      value: brl(summary.expectedCash),
                    },
                    {
                      label: "Valor contado",
                      value: cashWasEntered ? brl(countedCash) : "—",
                    },
                    {
                      label: "Diferença",
                      value: cashWasEntered
                        ? differenceText(countedCash - summary.expectedCash)
                        : "—",
                      strong: true,
                    },
                  ]}
                />
              </section>
            </div>
          )}

          {step === 3 && (
            <div className="closing-step-content">
              {divergences.map((payment) => (
                <section
                  className="closing-divergence-card"
                  key={payment.method}
                >
                  <h3>
                    <AlertTriangle /> Diferença encontrada em{" "}
                    {paymentLabel(payment.method)}
                  </h3>
                  <InfoGrid
                    rows={[
                      { label: "Esperado", value: brl(payment.expected) },
                      {
                        label: "Conferido",
                        value: brl(payment.confirmed || 0),
                      },
                      {
                        label: "Diferença",
                        value: differenceText(payment.difference || 0),
                        strong: true,
                      },
                    ]}
                  />
                </section>
              ))}
              <div className="closing-recount-row">
                <button className="secondary" onClick={recount}>
                  <RefreshCcw /> Contar novamente
                </button>
                <span>
                  Contagens registradas:{" "}
                  {(countHistory.length ? countHistory : [countedCash])
                    .map(brl)
                    .join(", ")}
                </span>
              </div>
              <label className="closing-field">
                Motivo da diferença *
                <select
                  value={discrepancyReason}
                  onChange={(event) =>
                    setDiscrepancyReason(event.target.value)
                  }
                >
                  <option value="">Selecione o motivo</option>
                  {discrepancyReasons.map((reason) => (
                    <option value={reason} key={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </label>
              <label className="closing-field">
                Observação {discrepancyReason === "Outro" ? "*" : ""}
                <textarea
                  placeholder="Descreva o que aconteceu"
                  value={discrepancyNote}
                  onChange={(event) => setDiscrepancyNote(event.target.value)}
                />
              </label>
              <label className="closing-field">
                Ação tomada
                <input
                  placeholder="Ex.: comunicado ao gerente"
                  value={actionTaken}
                  onChange={(event) => setActionTaken(event.target.value)}
                />
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="closing-step-content">
              <InfoGrid
                className="closing-session-card"
                rows={[
                  { label: "Caixa", value: "Caixa 01" },
                  {
                    label: "Operador",
                    value: session.operatorName || operatorFallback,
                  },
                  { label: "Abertura", value: formatDate(session.openedAt) },
                  { label: "Fechamento", value: formatDate(new Date().toISOString()) },
                  {
                    label: "Duração da sessão",
                    value: duration(session.openedAt),
                  },
                ]}
              />
              <section className="closing-review-card">
                <h3>Vendas</h3>
                <InfoGrid
                  rows={[
                    {
                      label: "Quantidade de vendas",
                      value: String(summary.saleCount),
                    },
                    { label: "Total bruto", value: brl(summary.grossSales) },
                    { label: "Descontos", value: brl(summary.discounts) },
                    {
                      label: "Cancelamentos e estornos",
                      value: brl(
                        summary.cancelledTotal + summary.refundedTotal
                      ),
                    },
                    {
                      label: "Total líquido",
                      value: brl(summary.netSales),
                      strong: true,
                    },
                  ]}
                />
              </section>
              <section className="closing-review-card">
                <h3>Movimentações</h3>
                <InfoGrid
                  rows={[
                    {
                      label: "Valor inicial",
                      value: brl(session.openingAmount),
                    },
                    { label: "Suprimentos", value: brl(summary.supplies) },
                    { label: "Sangrias", value: brl(summary.withdrawals) },
                    { label: "Devoluções em dinheiro", value: brl(0) },
                  ]}
                />
              </section>
              <div className="closing-table-wrap">
                <table className="closing-table">
                  <thead>
                    <tr>
                      <th>Forma</th>
                      <th>Esperado</th>
                      <th>Conferido</th>
                      <th>Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconciliations.map((payment) => (
                      <tr key={payment.method}>
                        <td>{paymentLabel(payment.method)}</td>
                        <td>{brl(payment.expected)}</td>
                        <td>{brl(payment.confirmed || 0)}</td>
                        <td>{differenceText(payment.difference || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <InfoGrid
                className="closing-highlight-grid"
                rows={[
                  {
                    label: "Dinheiro esperado na gaveta",
                    value: brl(summary.expectedCash),
                  },
                  {
                    label: "Dinheiro contado",
                    value: brl(countedCash),
                  },
                  {
                    label: "Diferença geral",
                    value: differenceText(totalDifference),
                    strong: true,
                  },
                  ...(divergences.length
                    ? [
                        {
                          label: "Motivo da divergência",
                          value: discrepancyReason,
                        },
                        {
                          label: "Observação",
                          value: discrepancyNote || "Não informada",
                        },
                        {
                          label: "Ação tomada",
                          value: actionTaken || "Não informada",
                        },
                      ]
                    : []),
                ]}
              />
              <label className="closing-field">
                Observação final (opcional)
                <textarea
                  value={finalNote}
                  onChange={(event) => setFinalNote(event.target.value)}
                />
              </label>
              <div className="closing-warning">
                <AlertTriangle />
                Ao confirmar, esta sessão será encerrada e não poderá receber
                novas vendas ou movimentações.
              </div>
            </div>
          )}
        </div>

        <footer className="closing-footer">
          {step === 1 ? (
            <button className="secondary" onClick={onCancel}>
              Cancelar
            </button>
          ) : (
            <button
              className="secondary"
              onClick={() => setStep((current) => Math.max(1, current - 1))}
            >
              <ArrowLeft /> Voltar e revisar
            </button>
          )}
          {step < 4 ? (
            <button
              className="primary"
              disabled={step === 3 && !canExplain}
              onClick={() => {
                if (step === 1) setStep(2);
                else if (step === 2) goFromConference();
                else setStep(4);
              }}
            >
              Continuar <ArrowRight />
            </button>
          ) : (
            <button
              className="danger"
              onClick={() => setConfirming(true)}
            >
              Confirmar fechamento
            </button>
          )}
        </footer>
      </section>

      {selectedSale && (
        <SaleDetails
          sale={selectedSale}
          onClose={() => setSelectedSale(null)}
        />
      )}

      {confirming && (
        <div className="closing-nested-backdrop">
          <section className="closing-confirm-card">
            <button
              className="closing-x"
              onClick={() => setConfirming(false)}
              aria-label="Fechar"
            >
              <X />
            </button>
            <h2>Confirmar fechamento do caixa?</h2>
            <p>
              Após o fechamento, nenhuma nova venda poderá ser registrada nesta
              sessão.
            </p>
            <div className="closing-confirm-actions">
              <button
                className="secondary"
                onClick={() => setConfirming(false)}
              >
                Cancelar
              </button>
              <button className="danger" disabled={saving} onClick={finishClosing}>
                {saving ? "Fechando caixa..." : "Sim, fechar caixa"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
