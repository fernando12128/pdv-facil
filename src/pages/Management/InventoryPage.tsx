import { useEffect, useMemo, useState } from "react";
import { Minus, Package, Plus, Search, TriangleAlert } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import { managementService, type StockRotationItem, type StockRotationResponse } from "../../services/managementService";
import {
  listProductsRequest,
  type Product,
} from "../../services/productsService";
import "./ManagementPages.css";

type Props = {
  onLogout: () => void;
  onNavigate: (page: AppPage) => void;
};

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function InventoryPage({ onLogout, onNavigate }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [rotation, setRotation] = useState<StockRotationResponse | null>(null);
  const [rotationFilter, setRotationFilter] = useState<"all" | "14" | "30" | "60" | "never">("all");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [list, slowStock] = await Promise.all([listProductsRequest(), managementService.stock.rotation()]);
      setProducts(list.products);
      setRotation(slowStock);
      setError("");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Erro ao carregar.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const rotationById = useMemo(() => new Map(rotation?.items.map(item => [item.id, item]) || []), [rotation]);
  const filtered = useMemo(() => products.filter(item => {
    if (!`${item.name} ${item.sku || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (rotationFilter === "all") return true;
    const rotationItem = rotationById.get(item.id);
    if (!rotationItem) return false;
    if (rotationFilter === "never") return rotationItem.neverSold;
    return rotationItem.daysWithoutSales >= Number(rotationFilter);
  }), [products, search, rotationFilter, rotationById]);
  const rotationStatus = (item: StockRotationItem | undefined) => {
    if (!item) return "Sem estoque ou inativo";
    if (item.status === "NEW") return "Novo (menos de 14 dias)";
    if (item.status === "NORMAL") return "Giro normal";
    if (item.daysWithoutSales >= 60) return "Parado há 60+ dias";
    if (item.daysWithoutSales >= 30) return "Parado há 30+ dias";
    return "Sem vendas há 14+ dias";
  };
  const lowStock = products.filter((item) => item.stock <= item.minStock).length;
  const cost = products.reduce((sum, item) => sum + item.cost * item.stock, 0);

  async function adjust(id: string, value: number) {
    await managementService.stock.adjust(id, value);
    await load();
  }

  return (
    <AdminLayout activePage="inventory" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="page-stack">
        <div className="page-heading"><div><h1>Estoque</h1><p>Controle de inventário</p></div></div>
        {error && <p className="feedback-error">{error}</p>}
        <div className="stats-grid">
          <article className="card stat-card"><div className="stat-card-top"><span>Itens cadastrados</span><Package /></div><strong>{products.length}</strong></article>
          <article className="card stat-card"><div className="stat-card-top"><span>Estoque baixo</span><TriangleAlert /></div><strong>{lowStock}</strong></article>
          <article className="card stat-card"><div className="stat-card-top"><span>Valor total (custo)</span></div><strong>{brl(cost)}</strong></article>
          <article className="card stat-card"><div className="stat-card-top"><span>Sem vendas há 14+ dias</span><TriangleAlert /></div><strong>{rotation?.summary.slowCount ?? "..."}</strong><small style={{ color: "var(--muted-foreground)" }}>Capital parado: {brl((rotation?.summary.slowCapitalCents ?? 0) / 100)}</small></article>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="inventory-filters">
                          <div className="search-row"><Search /><input className="search-input" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              <label className="inventory-filter-select">Giro do estoque
                <select value={rotationFilter} onChange={e => setRotationFilter(e.target.value as typeof rotationFilter)}>
                  <option value="all">Todos</option>
                  <option value="14">Sem venda há 14+ dias</option>
                  <option value="30">Sem venda há 30+ dias</option>
                  <option value="60">Sem venda há 60+ dias</option>
                  <option value="never">Nunca vendidos</option>
                </select>
              </label>
            </div>
            <p className="purchases-note" style={{ marginTop: 12 }}>Giro calculado por vendas concluídas no PDV e pedidos online entregues. Produtos com estoque zerado ou inativos não entram nos alertas. Produtos novos só são considerados parados após 14 dias.</p>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Produto</th><th className="right">Mínimo</th><th className="right">Estoque</th><th>Última venda</th><th>Giro</th><th className="right">Capital parado</th><th className="right">Ajustar</th></tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.name}</strong>{item.sku && <small style={{ display: "block", color: "var(--muted-foreground)" }}>{item.sku}</small>}</td>
                    <td className="right">{item.minStock}</td>
                    <td className="right">{item.stock <= item.minStock ? <span className="badge danger">{item.stock}</span> : item.stock}</td>
                    <td>{rotationById.get(item.id)?.lastSaleAt ? new Date(rotationById.get(item.id)!.lastSaleAt!).toLocaleDateString("pt-BR") : "Nunca vendido"}</td>
                    <td><span className={rotationById.get(item.id)?.daysWithoutSales && rotationById.get(item.id)!.daysWithoutSales >= 14 ? "badge warning" : "badge"}>{rotationStatus(rotationById.get(item.id))}</span></td>
                    <td className="right">{rotationById.get(item.id)?.daysWithoutSales && rotationById.get(item.id)!.daysWithoutSales >= 14 ? brl(rotationById.get(item.id)!.capitalCents / 100) : "—"}</td>
                    <td><div className="inventory-actions"><button onClick={() => adjust(item.id, -1)}><Minus /></button><button onClick={() => adjust(item.id, 1)}><Plus /></button><button onClick={() => adjust(item.id, 10)}>+10</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <div className="empty-state">{rotationFilter === "all" ? "Nenhum produto." : "Nenhum produto encontrado para este filtro."}</div>}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
