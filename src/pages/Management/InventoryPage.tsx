import { useEffect, useMemo, useState } from "react";
import { Minus, Package, Plus, Search, TriangleAlert } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import { managementService } from "../../services/managementService";
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
  const [error, setError] = useState("");

  async function load() {
    try {
      setProducts((await listProductsRequest()).products);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Erro ao carregar.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      products.filter((item) =>
        `${item.name} ${item.sku}`.toLowerCase().includes(search.toLowerCase())
      ),
    [products, search]
  );
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
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
          <article className="card stat-card"><div className="stat-card-top"><span>Itens cadastrados</span><Package /></div><strong>{products.length}</strong></article>
          <article className="card stat-card"><div className="stat-card-top"><span>Estoque baixo</span><TriangleAlert /></div><strong>{lowStock}</strong></article>
          <article className="card stat-card"><div className="stat-card-top"><span>Valor total (custo)</span></div><strong>{brl(cost)}</strong></article>
        </div>
        <div className="card">
          <div className="card-body">
            <div className="search-row"><Search /><input className="search-input" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Produto</th><th className="right">Mínimo</th><th className="right">Estoque</th><th className="right">Ajustar</th></tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.name}</strong>{item.sku && <small style={{ display: "block", color: "var(--muted-foreground)" }}>{item.sku}</small>}</td>
                    <td className="right">{item.minStock}</td>
                    <td className="right">{item.stock <= item.minStock ? <span className="badge danger">{item.stock}</span> : item.stock}</td>
                    <td><div className="inventory-actions"><button onClick={() => adjust(item.id, -1)}><Minus /></button><button onClick={() => adjust(item.id, 1)}><Plus /></button><button onClick={() => adjust(item.id, 10)}>+10</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <div className="empty-state">Nenhum produto.</div>}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
