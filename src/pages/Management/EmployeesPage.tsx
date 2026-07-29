import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import {
  managementService,
  type Employee,
} from "../../services/managementService";
import "./ManagementPages.css";

type Props = {
  onLogout: () => void;
  onNavigate: (page: AppPage) => void;
};

export default function EmployeesPage({ onLogout, onNavigate }: Props) {
  const [items, setItems] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    role: "CASHIER" as Employee["role"],
    pin: "",
    isActive: true,
  });
  const [error, setError] = useState("");

  async function load() {
    try {
      setItems((await managementService.employees.list()).employees);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Erro ao carregar.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    try {
      await managementService.employees.create(form);
      setOpen(false);
      setForm({ name: "", role: "CASHIER", pin: "", isActive: true });
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Erro ao salvar.");
    }
  }

  return (
    <AdminLayout activePage="employees" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="page-stack">
        <div className="page-heading">
          <div><h1>Funcionários</h1><p>Operadores de caixa e gerentes</p></div>
          <button className="primary-button" onClick={() => setOpen(true)}>
            <Plus /> Novo funcionário
          </button>
        </div>
        {error && <p className="feedback-error">{error}</p>}
        <div className="card table-wrap">
          <table className="data-table">
            <thead><tr><th>Nome</th><th>Função</th><th>Status</th><th className="right">Ações</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong></td>
                  <td>{item.role === "MANAGER" ? "Gerente" : "Caixa"}</td>
                  <td>
                    <button
                      className={`badge ${item.isActive ? "success" : ""}`}
                      onClick={async () => {
                        await managementService.employees.toggle(item.id);
                        await load();
                      }}
                    >
                      {item.isActive ? "Ativo" : "Inativo"}
                    </button>
                  </td>
                  <td className="right">
                    <button
                      className="icon-button"
                      onClick={async () => {
                        if (!window.confirm("Excluir?")) return;
                        await managementService.employees.remove(item.id);
                        await load();
                      }}
                    >
                      <Trash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && <div className="empty-state">Nenhum funcionário.</div>}
        </div>
      </div>
      {open && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header"><h2>Novo funcionário</h2></div>
            <div className="modal-body form-grid">
              <div className="field"><label>Nome</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="field"><label>Função</label><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Employee["role"] })}><option value="CASHIER">Caixa</option><option value="MANAGER">Gerente</option></select></div>
              <div className="field"><label>PIN (4 dígitos)</label><input maxLength={4} inputMode="numeric" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} /></div>
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
