import { useEffect, useState } from "react";
import { Banknote, CreditCard, Smartphone } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import {
  managementService,
  type PaymentSetting,
} from "../../services/managementService";
import "./ManagementPages.css";

type Props = { onLogout: () => void; onNavigate: (page: AppPage) => void };

const details: Record<PaymentSetting["type"], { label: string; description: string; icon: typeof Banknote }> = {
  CASH: { label: "Dinheiro", description: "Pagamento em espécie", icon: Banknote },
  PIX: { label: "Pix", description: "Transferência instantânea", icon: Smartphone },
  CREDIT: { label: "Cartão de Crédito", description: "Crédito à vista ou parcelado", icon: CreditCard },
  DEBIT: { label: "Cartão de Débito", description: "Débito em conta", icon: CreditCard },
};

export default function PaymentsPage({ onLogout, onNavigate }: Props) {
  const [items, setItems] = useState<PaymentSetting[]>([]);

  async function load() {
    setItems((await managementService.payments.list()).paymentSettings);
  }

  useEffect(() => { load(); }, []);

  return (
    <AdminLayout activePage="payments" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="page-stack">
        <div className="page-heading"><div><h1>Formas de Pagamento</h1><p>Ative as formas aceitas no caixa</p></div></div>
        <section className="card payment-list">
          <div className="card-header"><h2>Métodos disponíveis</h2></div>
          <div className="card-body" style={{ padding: 0, marginTop: 8 }}>
            {items.map((item) => {
              const info = details[item.type];
              const Icon = info.icon;
              return (
                <div className="payment-row" key={item.id}>
                  <div className="payment-info"><div className="payment-icon"><Icon /></div><div><strong>{info.label}</strong><span>{info.description}</span></div></div>
                  <button
                    className={`switch-control ${item.isEnabled ? "active" : ""}`}
                    aria-label={`${item.isEnabled ? "Desativar" : "Ativar"} ${info.label}`}
                    onClick={async () => {
                      await managementService.payments.toggle(item.type, !item.isEnabled);
                      await load();
                    }}
                  />
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
