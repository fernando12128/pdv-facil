import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import {
  managementService,
  type Category,
} from "../../services/managementService";
import "./ManagementPages.css";

type Props = {
  onLogout: () => void;
  onNavigate: (page: AppPage) => void;
};

export default function CategoriesPage({ onLogout, onNavigate }: Props) {
  const [items, setItems] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [error, setError] = useState("");

  async function load() {
    try {
      setItems((await managementService.categories.list()).categories);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Erro ao carregar.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    try {
      await managementService.categories.create({ name, color });
      setName("");
      setColor("#3b82f6");
      setOpen(false);
      await load();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Erro ao salvar.");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir?")) return;
    await managementService.categories.remove(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <AdminLayout
      activePage="categories"
      onNavigate={onNavigate}
      onLogout={onLogout}
    >
      <div className="page-stack">
        <div className="page-heading">
          <div>
            <h1>Categorias</h1>
            <p>{items.length} categorias</p>
          </div>
          <button className="primary-button" onClick={() => setOpen(true)}>
            <Plus /> Nova categoria
          </button>
        </div>
        {error && <p className="feedback-error">{error}</p>}
        {items.length ? (
          <div className="management-cards">
            {items.map((item) => (
              <article className="card category-card" key={item.id}>
                <div>
                  <span
                    className="category-color"
                    style={{ background: item.color }}
                  />
                  {item.name}
                </div>
                <button className="icon-button" onClick={() => remove(item.id)}>
                  <Trash2 />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="card empty-state">Nenhuma categoria.</div>
        )}
      </div>
      {open && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Nova categoria</h2>
            </div>
            <div className="modal-body form-grid">
              <div className="field">
                <label>Nome</label>
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label>Cor</label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="outline-button" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button className="primary-button" onClick={save}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
