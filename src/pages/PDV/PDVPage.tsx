import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar/Sidebar";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import {
  listProductsRequest,
  type Product,
} from "../../services/productsService";
import { createSaleRequest } from "../../services/salesService";
import "./PDVPage.css";

type PDVPageProps = {
  onLogout: () => void;
  onNavigate: (page: AppPage) => void;
};

type CartItem = {
  product: Product;
  quantity: number;
};

export default function PDVPage({ onLogout, onNavigate }: PDVPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const [search, setSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Dinheiro");
  const [discount, setDiscount] = useState("0");

  const [isLoading, setIsLoading] = useState(true);
  const [isFinishingSale, setIsFinishingSale] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return products;
    }

    return products.filter((product) => {
      const name = product.name.toLowerCase();
      const sku = product.sku?.toLowerCase() || "";
      const category = product.category?.toLowerCase() || "";

      return (
        name.includes(normalizedSearch) ||
        sku.includes(normalizedSearch) ||
        category.includes(normalizedSearch)
      );
    });
  }, [products, search]);

  const subtotal = cartItems.reduce((total, item) => {
    return total + item.product.salePrice * item.quantity;
  }, 0);

  const parsedDiscount = Number(discount || 0);
  const validDiscount =
    Number.isNaN(parsedDiscount) || parsedDiscount < 0 ? 0 : parsedDiscount;

  const total = Math.max(subtotal - validDiscount, 0);

  const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);

  function formatCurrency(value: number) {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function getQuantityInCart(productId: string) {
    const item = cartItems.find((cartItem) => cartItem.product.id === productId);

    return item?.quantity || 0;
  }

  function addProductToCart(product: Product) {
    setSuccessMessage("");
    setErrorMessage("");

    if (product.stock <= 0) {
      alert("Produto sem estoque.");
      return;
    }

    const currentQuantity = getQuantityInCart(product.id);

    if (currentQuantity >= product.stock) {
      alert("Você já adicionou todo o estoque disponível deste produto.");
      return;
    }

    setCartItems((currentItems) => {
      const productAlreadyInCart = currentItems.find(
        (item) => item.product.id === product.id
      );

      if (productAlreadyInCart) {
        return currentItems.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...currentItems,
        {
          product,
          quantity: 1,
        },
      ];
    });
  }

  function increaseQuantity(productId: string) {
    setCartItems((currentItems) =>
      currentItems.map((item) => {
        if (item.product.id !== productId) {
          return item;
        }

        if (item.quantity >= item.product.stock) {
          alert("Estoque máximo atingido para este produto.");
          return item;
        }

        return {
          ...item,
          quantity: item.quantity + 1,
        };
      })
    );
  }

  function decreaseQuantity(productId: string) {
    setCartItems((currentItems) =>
      currentItems
        .map((item) => {
          if (item.product.id !== productId) {
            return item;
          }

          return {
            ...item,
            quantity: item.quantity - 1,
          };
        })
        .filter((item) => item.quantity > 0)
    );
  }

  function removeProductFromCart(productId: string) {
    setCartItems((currentItems) =>
      currentItems.filter((item) => item.product.id !== productId)
    );
  }

  function clearCart() {
    setCartItems([]);
    setCustomerName("");
    setPaymentMethod("Dinheiro");
    setDiscount("0");
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleFinishSale() {
    if (cartItems.length === 0) {
      return;
    }

    try {
      setIsFinishingSale(true);
      setErrorMessage("");
      setSuccessMessage("");

      const response = await createSaleRequest({
        customerName,
        paymentMethod,
        discount: validDiscount,
        items: cartItems.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      });

      setSuccessMessage(
        `Venda finalizada com sucesso! Total: ${formatCurrency(
          response.sale.total
        )}`
      );

      setCartItems([]);
      setCustomerName("");
      setPaymentMethod("Dinheiro");
      setDiscount("0");

      await loadProducts();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Erro ao finalizar venda.");
      }
    } finally {
      setIsFinishingSale(false);
    }
  }

  return (
    <main className="pdv-layout">
      <Sidebar activePage="pdv" onNavigate={onNavigate} onLogout={onLogout} />

      <section className="pdv-main">
        <header className="pdv-topbar">
          <button className="pdv-topbar-button">
            <PanelIcon />
          </button>
        </header>

        <div className="pdv-content">
          <section className="products-panel">
            <div className="search-box">
              <SearchIcon />
              <input
                type="text"
                placeholder="Buscar produto..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            {errorMessage && <p className="pdv-error">{errorMessage}</p>}
            {successMessage && <p className="pdv-success">{successMessage}</p>}

            {isLoading ? (
              <div className="empty-products">Carregando produtos...</div>
            ) : products.length === 0 ? (
              <div className="empty-products">Cadastre produtos em Produtos</div>
            ) : filteredProducts.length === 0 ? (
              <div className="empty-products">Nenhum produto encontrado</div>
            ) : (
              <div className="pdv-products-grid">
                {filteredProducts.map((product) => {
                  const quantityInCart = getQuantityInCart(product.id);
                  const isOutOfStock = product.stock <= 0;
                  const reachedStockLimit = quantityInCart >= product.stock;

                  return (
                    <button
                      key={product.id}
                      className={`pdv-product-card ${
                        isOutOfStock ? "out-of-stock" : ""
                      }`}
                      onClick={() => addProductToCart(product)}
                      disabled={isOutOfStock || reachedStockLimit}
                    >
                      <div>
                        <strong>{product.name}</strong>

                        <span>{product.category || "Sem categoria"}</span>

                        {product.sku && <small>SKU: {product.sku}</small>}
                      </div>

                      <div className="pdv-product-bottom">
                        <strong>{formatCurrency(product.salePrice)}</strong>

                        <span
                          className={
                            product.stock <= product.minStock
                              ? "stock-warning"
                              : ""
                          }
                        >
                          Estoque: {product.stock}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="cart-panel">
            <div className="cart-header">
              <div className="cart-title">
                <CartIcon />
                <strong>Carrinho</strong>
              </div>

              <span className="cart-count">
                {totalItems} {totalItems === 1 ? "item" : "itens"}
              </span>
            </div>

            {cartItems.length === 0 ? (
              <div className="cart-empty">Adicione produtos</div>
            ) : (
              <div className="cart-items">
                {cartItems.map((item) => (
                  <article className="cart-item" key={item.product.id}>
                    <div className="cart-item-info">
                      <strong>{item.product.name}</strong>
                      <span>{formatCurrency(item.product.salePrice)}</span>
                    </div>

                    <div className="cart-item-controls">
                      <button onClick={() => decreaseQuantity(item.product.id)}>
                        -
                      </button>

                      <span>{item.quantity}</span>

                      <button onClick={() => increaseQuantity(item.product.id)}>
                        +
                      </button>
                    </div>

                    <div className="cart-item-total">
                      <strong>
                        {formatCurrency(item.product.salePrice * item.quantity)}
                      </strong>

                      <button
                        onClick={() => removeProductFromCart(item.product.id)}
                      >
                        remover
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="cart-footer">
              <div className="cart-divider" />

              <input
                className="customer-input"
                type="text"
                placeholder="Cliente (opcional)"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
              />

              <div className="cart-row-inputs">
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  <option>Dinheiro</option>
                  <option>Cartão de crédito</option>
                  <option>Cartão de débito</option>
                  <option>Pix</option>
                </select>

                <input
                  type="number"
                  step="0.01"
                  placeholder="Desc."
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                />
              </div>

              <div className="subtotal-row">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>

              <div className="total-row">
                <strong>Total</strong>
                <strong>{formatCurrency(total)}</strong>
              </div>

              <div className="cart-actions">
                <button className="clear-button" onClick={clearCart}>
                  <TrashIcon />
                  <span>Limpar</span>
                </button>

                <button
                  className="finish-button"
                  disabled={cartItems.length === 0 || isFinishingSale}
                  onClick={handleFinishSale}
                >
                  {isFinishingSale ? "Finalizando..." : "Finalizar"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </section>
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

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M16 16L20 20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 5H5L7.2 14.5H18.5L20 8H6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="19" r="1.4" fill="currentColor" />
      <circle cx="18" cy="19" r="1.4" fill="currentColor" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10 11V17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M14 11V17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6 7L7 21H17L18 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M9 7V4H15V7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}