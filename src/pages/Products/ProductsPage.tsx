import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar/Sidebar";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import ProductModal from "../../components/products/ProductModal";
import type { ProductFormData } from "../../types/product";
import {
  createProductRequest,
  deleteProductRequest,
  listProductsRequest,
  type Product,
} from "../../services/productsService";
import "./ProductsPage.css";

type ProductsPageProps = {
  onLogout: () => void;
  onNavigate: (page: AppPage) => void;
};

export default function ProductsPage({
  onLogout,
  onNavigate,
}: ProductsPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await listProductsRequest();

      setProducts(response.products);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Erro ao carregar produtos.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveProduct(data: ProductFormData) {
    try {
      setIsSaving(true);
      setErrorMessage("");

      await createProductRequest({
        name: data.name,
        sku: data.sku,
        barcode: data.barcode,
        category: data.category,
        brand: data.brand,

        isActive: data.isActive,

        salePrice: Number(data.salePrice),
        cost: Number(data.cost),
        useSameOnlinePrice: data.useSameOnlinePrice,
        onlinePrice: Number(
          data.useSameOnlinePrice ? data.salePrice : data.onlinePrice
        ),

        stock: Number(data.stock),
        minStock: Number(data.minStock),
        allowBackorder: data.allowBackorder,

        isVisibleOnline: data.isVisibleOnline,
        description: data.description,
        imageUrl: data.imageUrl,
        isFeatured: data.isFeatured,
        allowPickup: data.allowPickup,
        allowDelivery: data.allowDelivery,
      });

      await loadProducts();
      setIsModalOpen(false);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Erro ao salvar produto.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteProduct(productId: string) {
    const shouldDelete = window.confirm(
      "Tem certeza que deseja excluir este produto?"
    );

    if (!shouldDelete) {
      return;
    }

    try {
      setErrorMessage("");

      await deleteProductRequest(productId);

      setProducts((currentProducts) =>
        currentProducts.filter((product) => product.id !== productId)
      );
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Erro ao excluir produto.");
      }
    }
  }

  function formatCurrency(value: number) {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function getOnlinePrice(product: Product) {
    if (product.useSameOnlinePrice) {
      return product.salePrice;
    }

    return product.onlinePrice;
  }

  const totalVisibleOnline = products.filter(
    (product) => product.isVisibleOnline
  ).length;

  return (
    <main className="products-layout">
      <Sidebar
        activePage="products"
        onNavigate={onNavigate}
        onLogout={onLogout}
      />

      <section className="products-main">
        <header className="products-topbar">
          <button className="products-topbar-button">
            <PanelIcon />
          </button>
        </header>

        <div className="products-content">
          <div className="products-header-row">
            <div>
              <h1>Produtos</h1>

              <p>
                {products.length}{" "}
                {products.length === 1 ? "cadastrado" : "cadastrados"} ·{" "}
                {totalVisibleOnline} na loja virtual
              </p>
            </div>

            <button
              className="new-product-button"
              onClick={() => setIsModalOpen(true)}
              disabled={isSaving}
            >
              <PlusIcon />
              <span>Novo Produto</span>
            </button>
          </div>

          {errorMessage && <p className="products-error">{errorMessage}</p>}

          <section className="products-table-card">
            <div className="products-table-header products-table-header-new">
              <span>Produto</span>
              <span>Categoria</span>
              <span>Balcão</span>
              <span>Online</span>
              <span>Estoque</span>
              <span>Loja virtual</span>
              <span>Status</span>
              <span>Ações</span>
            </div>

            {isLoading ? (
              <div className="products-empty-row">Carregando produtos...</div>
            ) : products.length === 0 ? (
              <div className="products-empty-row">
                Nenhum produto. Clique em "Novo Produto".
              </div>
            ) : (
              <div className="products-list">
                {products.map((product) => (
                  <div
                    className="products-table-row products-table-row-new"
                    key={product.id}
                  >
                    <div className="product-name-cell">
                      <strong>{product.name}</strong>

                      <span>
                        {product.sku ? `SKU: ${product.sku}` : "Sem SKU"}
                      </span>
                    </div>

                    <span>{product.category || "-"}</span>

                    <span>{formatCurrency(product.salePrice)}</span>

                    <span>{formatCurrency(getOnlinePrice(product))}</span>

                    <span
                      className={
                        product.stock <= product.minStock
                          ? "stock-low-text"
                          : ""
                      }
                    >
                      {product.stock}
                    </span>

                    <span>
                      {product.isVisibleOnline ? (
                        <span className="status-pill online">Publicado</span>
                      ) : (
                        <span className="status-pill hidden">Oculto</span>
                      )}
                    </span>

                    <span>
                      {product.isActive ? (
                        <span className="status-pill active">Ativo</span>
                      ) : (
                        <span className="status-pill inactive">Inativo</span>
                      )}
                    </span>

                    <div className="products-actions">
                      <button
                        className="delete-product-button"
                        onClick={() => handleDeleteProduct(product.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>

      <ProductModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProduct}
      />
    </main>
  );
}

function PanelIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M10 5V19" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5V19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M5 12H19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}