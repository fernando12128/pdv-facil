import { useMemo, useState } from "react";
import { X } from "lucide-react";
import ToggleSwitch from "../ui/ToggleSwitch";
import type { ProductFormData } from "../../types/product";
import "./ProductModal.css";

type ProductTab = "basic" | "prices" | "stock" | "online" | "fiscal";

interface ProductModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (product: ProductFormData) => void;
  product?: ProductFormData | null;
}

// Máscara monetária no padrão brasileiro: digitar 1234 produz R$ 12,34.
const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const currencyDigits = (value: string) => value.replace(/\D/g, "").slice(0, 12);
const parseCurrencyInput = (value: string) => Number(currencyDigits(value)) / 100;

const initialForm: ProductFormData = {
  name: "",
  sku: "",
  barcode: "",
  category: "",
  brand: "",
  ncm: "",
  cest: "",
  cfop: "",
  fiscalUnit: "UN",
  originCode: "0",
  taxSituation: "",

  isActive: true,

  salePrice: 0,
  cost: 0,
  useSameOnlinePrice: true,
  onlinePrice: 0,

  stock: 0,
  minStock: 0,
  allowBackorder: false,

  isVisibleOnline: false,
  description: "",
  imageUrl: "",
  isFeatured: false,
  allowPickup: true,
  allowDelivery: true,
};

export default function ProductModal({
  open,
  onClose,
  onSave,
  product,
}: ProductModalProps) {
  const [activeTab, setActiveTab] = useState<ProductTab>("basic");
  const [form, setForm] = useState<ProductFormData>(() => product || initialForm);

  const effectiveOnlinePrice = useMemo(() => {
    return form.useSameOnlinePrice ? form.salePrice : form.onlinePrice;
  }, [form.useSameOnlinePrice, form.salePrice, form.onlinePrice]);

  const profitMargin = useMemo(() => {
    if (effectiveOnlinePrice <= 0 || form.cost <= 0) return 0;
    return ((effectiveOnlinePrice - form.cost) / effectiveOnlinePrice) * 100;
  }, [effectiveOnlinePrice, form.cost]);

  function updateField<K extends keyof ProductFormData>(
    field: K,
    value: ProductFormData[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function handleSave() {
    const payload: ProductFormData = {
      ...form,
      onlinePrice: effectiveOnlinePrice,
    };

    onSave(payload);
  }

  if (!open) return null;

  return (
    <div className="product-modal-overlay">
      <div className="product-modal">
        <div className="product-modal-header">
          <h2>{product ? "Editar produto" : "Novo produto"}</h2>

          <button
            type="button"
            className="product-modal-close"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="product-modal-tabs">
          <button
            type="button"
            className={activeTab === "basic" ? "active" : ""}
            onClick={() => setActiveTab("basic")}
          >
            Básico
          </button>

          <button
            type="button"
            className={activeTab === "prices" ? "active" : ""}
            onClick={() => setActiveTab("prices")}
          >
            Preços
          </button>

          <button
            type="button"
            className={activeTab === "stock" ? "active" : ""}
            onClick={() => setActiveTab("stock")}
          >
            Estoque
          </button>

          <button
            type="button"
            className={activeTab === "online" ? "active" : ""}
            onClick={() => setActiveTab("online")}
          >
            Loja virtual
          </button>
          <button type="button" className={activeTab === "fiscal" ? "active" : ""} onClick={() => setActiveTab("fiscal")}>Fiscal</button>
        </div>

        <div className="product-modal-body">
          {activeTab === "basic" && (
            <>
              <div className="field full">
                <label>Nome do produto</label>
                <input
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                />
              </div>

              <div className="grid-2">
                <div className="field">
                  <label>SKU / Código interno</label>
                  <input
                    value={form.sku}
                    onChange={(e) => updateField("sku", e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>Código de barras</label>
                  <input
                    value={form.barcode}
                    onChange={(e) => updateField("barcode", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid-2">
                <div className="field">
                  <label>Categoria</label>
                  <input
                    value={form.category}
                    onChange={(e) => updateField("category", e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>Marca</label>
                  <input
                    value={form.brand}
                    onChange={(e) => updateField("brand", e.target.value)}
                  />
                </div>
              </div>

              <div className="setting-card">
                <div>
                  <strong>Produto ativo</strong>
                  <p>Inativo não aparece no PDV nem na loja</p>
                </div>

                <ToggleSwitch
                  checked={form.isActive}
                  onChange={(value) => updateField("isActive", value)}
                />
              </div>
            </>
          )}

          {activeTab === "prices" && (
            <>
              <div className="grid-2">
                <div className="field">
                  <label>Preço balcão (PDV)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Preço balcão em reais"
                    value={brl(form.salePrice)}
                    onChange={(e) => updateField("salePrice", parseCurrencyInput(e.target.value))}
                  />
                </div>

                <div className="field">
                  <label>Custo</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Custo em reais"
                    value={brl(form.cost)}
                    onChange={(e) => updateField("cost", parseCurrencyInput(e.target.value))}
                  />
                </div>
              </div>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.useSameOnlinePrice}
                  onChange={(e) =>
                    updateField("useSameOnlinePrice", e.target.checked)
                  }
                />
                <span>Usar o mesmo preço do balcão na loja virtual</span>
              </label>

              <div className="field full">
                <label>Preço online</label>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label="Preço online em reais"
                  disabled={form.useSameOnlinePrice}
                  value={brl(form.useSameOnlinePrice ? form.salePrice : form.onlinePrice)}
                  onChange={(e) => updateField("onlinePrice", parseCurrencyInput(e.target.value))}
                />
              </div>

              <div className="info-box">
                Margem de lucro: {profitMargin.toFixed(1)}%
              </div>
            </>
          )}

          {activeTab === "stock" && (
            <>
              <div className="grid-2">
                <div className="field">
                  <label>Estoque atual</label>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={(e) => updateField("stock", Number(e.target.value))}
                  />
                </div>

                <div className="field">
                  <label>Estoque mínimo</label>
                  <input
                    type="number"
                    value={form.minStock}
                    onChange={(e) =>
                      updateField("minStock", Number(e.target.value))
                    }
                  />
                </div>
              </div>

              <div className="setting-card">
                <div>
                  <strong>Permitir venda sem estoque</strong>
                </div>

                <ToggleSwitch
                  checked={form.allowBackorder}
                  onChange={(value) => updateField("allowBackorder", value)}
                />
              </div>
            </>
          )}

          {activeTab === "fiscal" && (
            <div style={{ display: "grid", gap: 14 }}>
              <div className="info-box">Preparação fiscal para NF-e/NFC-e. Informe os códigos conforme a classificação do produto e orientação da contabilidade. Nenhum documento é emitido nesta etapa.</div>
              <div className="grid-2">
                <div className="field"><label>NCM (8 dígitos)</label><input inputMode="numeric" maxLength={8} value={form.ncm} onChange={e => updateField("ncm", e.target.value.replace(/\D/g, ""))} placeholder="00000000" /></div>
                <div className="field"><label>CEST (quando aplicável)</label><input inputMode="numeric" maxLength={7} value={form.cest} onChange={e => updateField("cest", e.target.value.replace(/\D/g, ""))} placeholder="0000000" /></div>
                <div className="field"><label>CFOP</label><input inputMode="numeric" maxLength={4} value={form.cfop} onChange={e => updateField("cfop", e.target.value.replace(/\D/g, ""))} placeholder="5102" /></div>
                <div className="field"><label>Unidade tributável</label><input maxLength={6} value={form.fiscalUnit} onChange={e => updateField("fiscalUnit", e.target.value.toUpperCase())} placeholder="UN" /></div>
                <div className="field"><label>Origem da mercadoria (0 a 8)</label><select value={form.originCode} onChange={e => updateField("originCode", e.target.value)}>{Array.from({ length: 9 }, (_, i) => <option key={i} value={String(i)}>{i}</option>)}</select></div>
                <div className="field"><label>CST / CSOSN</label><input inputMode="numeric" maxLength={3} value={form.taxSituation} onChange={e => updateField("taxSituation", e.target.value.replace(/\D/g, ""))} placeholder="Ex.: 102" /></div>
              </div>
              <p style={{ color: "var(--muted-foreground)", fontSize: 12 }}>Campos de preparação, não são calculados automaticamente. ICMS, PIS, COFINS e demais regras tributárias serão validados no módulo emissor, com suporte contábil.</p>
            </div>
          )}

          {activeTab === "online" && (
            <>
              <div className="setting-card">
                <div>
                  <strong>Mostrar na loja virtual</strong>
                  <p>Produto fica visível para clientes online</p>
                </div>

                <ToggleSwitch
                  checked={form.isVisibleOnline}
                  onChange={(value) => updateField("isVisibleOnline", value)}
                />
              </div>

              <div className="field full">
                <label>Descrição</label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                />
              </div>

              <div className="field full">
                <label>URL da imagem</label>
                <input
                  placeholder="https://..."
                  value={form.imageUrl}
                  onChange={(e) => updateField("imageUrl", e.target.value)}
                />
              </div>

              <div className="grid-3">
                <div className="mini-setting">
                  <ToggleSwitch
                    checked={form.isFeatured}
                    onChange={(value) => updateField("isFeatured", value)}
                  />
                  <span>Destaque</span>
                </div>

                <div className="mini-setting">
                  <ToggleSwitch
                    checked={form.allowPickup}
                    onChange={(value) => updateField("allowPickup", value)}
                  />
                  <span>Retirada</span>
                </div>

                <div className="mini-setting">
                  <ToggleSwitch
                    checked={form.allowDelivery}
                    onChange={(value) => updateField("allowDelivery", value)}
                  />
                  <span>Entrega</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="product-modal-footer">
          <button type="button" className="save-button" onClick={handleSave}>
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
