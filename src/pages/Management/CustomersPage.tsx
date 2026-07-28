import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import {
  managementService,
  type Customer,
} from "../../services/managementService";
import "./ManagementPages.css";

type Props = {
  onLogout: () => void;
  onNavigate: (page: AppPage) => void;
};

const emptyForm = { name: "", phone: "", email: "", document: "" };

export default function CustomersPage({ onLogout, onNavigate }: Props) {
  const [items, setItems] = useState<Customer[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      setItems((await managementService.customers.list()).customers);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Erro ao carregar.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    try {
      await managementService.customers.create(form);
      setForm(emptyForm);
      setOpen(false);
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Erro ao salvar.");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir?")) return;
    await managementService.customers.remove(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <AdminLayout activePage="customers" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="page-stack">
        <div className="page-heading">
          <div>
            <h1>Clientes</h1>
            <p>{items.length} cadastrados</p>
          </div>
          <button className="primary-button" onClick={() => setOpen(true)}>
            <Plus /> Novo cliente
          </button>
        </div>
        {error && <p className="feedback-error">{error}</p>}
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Telefone</th>
                <th>Documento</th>
                <th className="right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.phone || "-"}</td>
                  <td>{item.document || "-"}</td>
                  <td className="right">
                    <button className="icon-button" onClick={() => remove(item.id)}>
                      <Trash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && <div className="empty-state">Nenhum cliente.</div>}
        </div>
      </div>
      {open && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header"><h2>Novo cliente</h2></div>
            <div className="modal-body form-grid">
              {(["name", "phone", "document", "email"] as const).map((key) => (
                <div className="field" key={key}>
                  <label>
                    {{ name: "Nome", phone: "Telefone", document: "CPF/CNPJ", email: "Email" }[key]}
                  </label>
                  <input
                    type={key === "email" ? "email" : "text"}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="outline-button" onClick={() => setOpen(false)}>Cancelar</button>
              <button className="primary-button" onClick={save}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
