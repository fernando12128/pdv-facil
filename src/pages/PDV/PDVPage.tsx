import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowDownCircle,
  ArrowRight,
  ArrowUpCircle,
  Briefcase,
  ChevronDown,
  Lock,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import {
  listProductsRequest,
  type Product,
} from "../../services/productsService";
import { createSaleRequest } from "../../services/salesService";
import { meRequest, type MeResponse } from "../../services/authService";
import {
  createCashMovementRequest,
  type CashMovementType,
} from "../../services/cashMovementsService";
import "./PDVPage.css";

type PDVPageProps = {
  onLogout: () => void;
  onNavigate: (page: AppPage) => void;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type MovementModalState = {
  type: CashMovementType;
} | null;

export default function PDVPage({ onLogout, onNavigate }: PDVPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [currentUser, setCurrentUser] = useState<MeResponse["user"] | null>(
    null
  );
  const [cashierOpenedAt] = useState(() => new Date());

  const [search, setSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Dinheiro");
  const [discount, setDiscount] = useState("");

  const [movementModal, setMovementModal] = useState<MovementModalState>(null);
  const [movementAmount, setMovementAmount] = useState("");
  const [movementNote, setMovementNote] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isFinishingSale, setIsFinishingSale] = useState(false);
  const [isSavingMovement, setIsSavingMovement] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    await Promise.all([loadProducts(), loadUser()]);
  }

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

  async function loadUser() {
    const token = localStorage.getItem("pdv_facil_token");

    if (!token) {
      return;
    }

    try {
      const response = await meRequest(token);

      setCurrentUser(response.user);
    } catch {
      setCurrentUser(null);
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
      const barcode = product.barcode?.toLowerCase() || "";
      const category = product.category?.toLowerCase() || "";

      return (
        name.includes(normalizedSearch) ||
        sku.includes(normalizedSearch) ||
        barcode.includes(normalizedSearch) ||
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

  function formatCashierOpenedAt() {
    return cashierOpenedAt.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
      setErrorMessage("Produto sem estoque.");
      return;
    }

    const currentQuantity = getQuantityInCart(product.id);

    if (currentQuantity >= product.stock) {
      setErrorMessage("Você já adicionou todo o estoque disponível.");
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
          setErrorMessage("Estoque máximo atingido para este produto.");
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
    setDiscount("");
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
      setDiscount("");

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

  function openMovementModal(type: CashMovementType) {
    setMovementModal({ type });
    setMovementAmount("");
    setMovementNote("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function closeMovementModal() {
    if (isSavingMovement) {
      return;
    }

    setMovementModal(null);
    setMovementAmount("");
    setMovementNote("");
  }

  async function handleSaveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!movementModal) {
      return;
    }

    const parsedAmount = Number(movementAmount);

    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Informe um valor maior que zero.");
      return;
    }

    try {
      setIsSavingMovement(true);
      setErrorMessage("");
      setSuccessMessage("");

      await createCashMovementRequest({
        type: movementModal.type,
        amount: parsedAmount,
        note: movementNote,
      });

      setSuccessMessage(
        `${getMovementLabel(movementModal.type)} registrado com sucesso.`
      );
      setMovementModal(null);
      setMovementAmount("");
      setMovementNote("");
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Erro ao registrar movimento de caixa.");
      }
    } finally {
      setIsSavingMovement(false);
    }
  }

  function getMovementLabel(type: CashMovementType) {
    return type === "SUPPLY" ? "Suprimento" : "Sangria";
  }

  return (
    <main className="pdv-screen">
      <header className="pdv-cashier-topbar">
        <div className="cashier-identity">
          <button
            className="cashier-icon-button"
            onClick={() => onNavigate("dashboard")}
            aria-label="Voltar para o dashboard"
          >
            <ShoppingCart size={19} />
          </button>

          <div>
            <h1>Frente de Caixa</h1>
            <p>
              Aberto {formatCashierOpenedAt()} -{" "}
              {currentUser?.name || "operador"}
            </p>
          </div>
        </div>

        <div className="cashier-actions">
          <button
            className="cashier-action-button"
            onClick={() => openMovementModal("SUPPLY")}
          >
            <ArrowDownCircle size={17} />
            <span>Suprimento</span>
          </button>

          <button
            className="cashier-action-button"
            onClick={() => openMovementModal("WITHDRAWAL")}
          >
            <ArrowUpCircle size={17} />
            <span>Sangria</span>
          </button>

          <button className="cashier-close-button" type="button">
            <Lock size={17} />
            <span>Fechar Caixa</span>
          </button>

          <button
            className="cashier-exit-button"
            onClick={onLogout}
            aria-label="Sair"
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </header>

      <div className="pdv-workspace">
        <section className="products-panel">
          <div className="search-box">
            <Search size={18} />
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
            <div className="empty-products">
              Cadastre produtos no painel admin
            </div>
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
              <ShoppingCart size={18} />
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

                    <button onClick={() => removeProductFromCart(item.product.id)}>
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
              <label className="select-wrapper">
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  <option>Dinheiro</option>
                  <option>Cartão de crédito</option>
                  <option>Cartão de débito</option>
                  <option>Pix</option>
                </select>
                <ChevronDown size={16} />
              </label>

              <input
                type="number"
                step="0.01"
                min="0"
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
                <Trash2 size={17} />
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

      {movementModal && (
        <div className="movement-backdrop" role="presentation">
          <form className="movement-modal" onSubmit={handleSaveMovement}>
            <div className="movement-modal-icon">
              <Briefcase size={22} />
            </div>

            <h2>{getMovementLabel(movementModal.type)}</h2>
            <p>
              {movementModal.type === "SUPPLY"
                ? "Registre uma entrada de dinheiro no caixa."
                : "Registre uma retirada de dinheiro do caixa."}
            </p>

            <label>
              Valor
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={movementAmount}
                onChange={(event) => setMovementAmount(event.target.value)}
                autoFocus
              />
            </label>

            <label>
              Observação
              <textarea
                placeholder="Motivo ou descrição opcional"
                value={movementNote}
                onChange={(event) => setMovementNote(event.target.value)}
              />
            </label>

            <div className="movement-actions">
              <button type="button" onClick={closeMovementModal}>
                Cancelar
              </button>

              <button type="submit" disabled={isSavingMovement}>
                {isSavingMovement ? "Salvando..." : "Registrar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
