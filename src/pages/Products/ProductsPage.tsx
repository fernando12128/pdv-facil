import { useEffect, useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Power } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import ProductModal from "../../components/products/ProductModal";
import type { ProductFormData } from "../../types/product";
import {
  createProductRequest,
  listProductsRequest,
  updateProductRequest,
  type Product,
} from "../../services/productsService";

type Props = { onLogout: () => void; onNavigate: (page: AppPage) => void };
const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function toForm(product: Product): ProductFormData {
  return {
    name: product.name,
    sku: product.sku || "",
    barcode: product.barcode || "",
    category: product.category || "",
    brand: product.brand || "",
    isActive: product.isActive,
    salePrice: product.salePrice,
    cost: product.cost,
    useSameOnlinePrice: product.useSameOnlinePrice,
    onlinePrice: product.onlinePrice,
    stock: product.stock,
    minStock: product.minStock,
    allowBackorder: product.allowBackorder,
    isVisibleOnline: product.isVisibleOnline,
    description: product.description || "",
    imageUrl: product.imageUrl || "",
    isFeatured: product.isFeatured,
    allowPickup: product.allowPickup,
    allowDelivery: product.allowDelivery,
  };
}

export default function ProductsPage({ onLogout, onNavigate }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setProducts((await listProductsRequest()).products);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Erro ao carregar produtos.");
    }
  }

  useEffect(() => { load(); }, []);

  async function save(data: ProductFormData) {
    try {
      const payload = {
        ...data,
        salePrice: Number(data.salePrice),
        cost: Number(data.cost),
        onlinePrice: Number(data.useSameOnlinePrice ? data.salePrice : data.onlinePrice),
        stock: Number(data.stock),
        minStock: Number(data.minStock),
      };
      if (editing) await updateProductRequest(editing.id, payload);
      else await createProductRequest(payload);
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Erro ao salvar produto.");
    }
  }

  async function quickUpdate(product: Product, changes: Partial<ProductFormData>) {
    await updateProductRequest(product.id, { ...toForm(product), ...changes });
    await load();
  }

  return (
    <AdminLayout activePage="products" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="page-stack">
        <div className="page-heading">
          <div><h1>Produtos</h1><p>{products.length} cadastrados · {products.filter((item) => item.isVisibleOnline).length} na loja virtual</p></div>
          <button className="primary-button" onClick={() => { setEditing(null); setModalOpen(true); }}><Plus /> Novo Produto</button>
        </div>
        {error && <p className="feedback-error">{error}</p>}
        <section className="card table-wrap">
          <table className="data-table">
            <thead><tr><th>Produto</th><th>Categoria</th><th className="right">Balcão</th><th className="right">Online</th><th className="right">Estoque</th><th>Loja virtual</th><th>Status</th><th className="right">Ações</th></tr></thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td><strong>{product.name}</strong><small style={{ display: "block", color: "var(--muted-foreground)" }}>{product.sku ? `SKU: ${product.sku}` : "Sem SKU"}</small></td>
                  <td>{product.category || "-"}</td>
                  <td className="right">{brl(product.salePrice)}</td>
                  <td className="right">{brl(product.useSameOnlinePrice ? product.salePrice : product.onlinePrice)}</td>
                  <td className="right">{product.stock <= product.minStock ? <span className="badge danger">{product.stock}</span> : product.stock}</td>
                  <td><span className={`badge ${product.isVisibleOnline ? "success" : ""}`}>{product.isVisibleOnline ? "Publicado" : "Oculto"}</span></td>
                  <td><span className={`badge ${product.isActive ? "info" : ""}`}>{product.isActive ? "Ativo" : "Inativo"}</span></td>
                  <td className="right">
                    <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                      <button className="icon-button" title="Editar" onClick={() => { setEditing(product); setModalOpen(true); }}><Pencil /></button>
                      <button className="icon-button" title={product.isVisibleOnline ? "Ocultar da loja" : "Publicar"} onClick={() => quickUpdate(product, { isVisibleOnline: !product.isVisibleOnline })}>{product.isVisibleOnline ? <EyeOff /> : <Eye />}</button>
                      <button className="icon-button" title={product.isActive ? "Desativar" : "Ativar"} onClick={() => quickUpdate(product, { isActive: !product.isActive })}><Power /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!products.length && <div className="empty-state">Nenhum produto. Clique em "Novo Produto".</div>}
        </section>
      </div>
      {modalOpen && <ProductModal key={editing?.id || "new"} open onClose={() => { setModalOpen(false); setEditing(null); }} onSave={save} product={editing ? toForm(editing) : null} />}
    </AdminLayout>
  );
}
