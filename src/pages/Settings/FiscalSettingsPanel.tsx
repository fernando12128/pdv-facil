import { useEffect, useState } from "react";
import { fiscalService, type FiscalSettingsInput } from "../../services/fiscalService";

const empty: FiscalSettingsInput = {
  legalName: "", tradeName: "", cnpj: "", stateRegistration: "", taxRegime: "",
  stateCode: "", cityName: "", cityIbgeCode: "", postalCode: "", street: "",
  streetNumber: "", district: "", complementaryAddress: "", receiptWidth: 80
};
const labels: Array<[keyof Omit<FiscalSettingsInput, "receiptWidth" | "taxRegime">, string, string]> = [
  ["legalName", "Razão social", "Razão social do emitente"],
  ["tradeName", "Nome fantasia", "Nome comercial"],
  ["cnpj", "CNPJ", "00.000.000/0000-00"],
  ["stateRegistration", "Inscrição estadual", "Número da inscrição"],
  ["stateCode", "UF", "SP"],
  ["cityName", "Município", "São Paulo"],
  ["cityIbgeCode", "Código IBGE do município", "3550308"],
  ["postalCode", "CEP", "00000-000"],
  ["street", "Logradouro", "Rua / avenida"],
  ["streetNumber", "Número", "123"],
  ["district", "Bairro", "Centro"],
  ["complementaryAddress", "Complemento", "Opcional"]
];

const formatCnpj = (value: string) => {
  const d = value.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

export default function FiscalSettingsPanel() {
  const [form, setForm] = useState<FiscalSettingsInput>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fiscalService.settings().then(({ settings }) => {
      setForm({
        ...empty, ...Object.fromEntries(Object.entries(empty).map(([key]) => [key,
          settings[key as keyof FiscalSettingsInput] ?? empty[key as keyof FiscalSettingsInput]
        ]))
      } as FiscalSettingsInput);
    }).catch(e => setError(e instanceof Error ? e.message : "Erro ao carregar configurações fiscais."));
  }, []);
  async function save() {
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fiscalService.saveSettings(form);
      setSuccess(response.message);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar os dados fiscais."); }
    finally { setSaving(false); }
  }

  return <section className="card">
    <div className="card-header"><h2>Fiscal e impressão</h2></div>
    <div className="card-body" style={{ display: "grid", gap: 14 }}>
      <div className="info-box">
        <strong>Emissão fiscal desativada.</strong> Esta etapa prepara o cadastro para futura integração Focus NFe.
        O ambiente planejado é homologação. Nenhum documento será transmitido à SEFAZ e nenhum token será solicitado aqui.
      </div>
      <div className="grid-2">
        {labels.map(([field, label, placeholder]) => <div className="field" key={field}>
          <label>{label}</label>
          <input value={field === "cnpj" ? formatCnpj(String(form.cnpj ?? "")) : String(form[field] ?? "")}
            placeholder={placeholder} inputMode={field === "cnpj" ? "numeric" : undefined}
            maxLength={field === "cnpj" ? 18 : undefined}
            onChange={e => setForm(current => ({ ...current, [field]: field === "cnpj" ? e.target.value.replace(/\D/g, "").slice(0, 14) : e.target.value }))} />
        </div>)}
        <div className="field"><label>Regime tributário</label>
          <select value={form.taxRegime || ""} onChange={e => setForm(f => ({ ...f, taxRegime: e.target.value }))}>
            <option value="">Selecione com orientação da contabilidade</option>
            <option value="SIMPLES_NACIONAL">Simples Nacional</option>
            <option value="SIMPLES_EXCESSO">Simples Nacional, sublimite excedido</option>
            <option value="REGIME_NORMAL">Regime normal</option>
          </select>
        </div>
        <div className="field"><label>Largura do comprovante não fiscal</label>
          <select value={form.receiptWidth} onChange={e => setForm(f => ({ ...f, receiptWidth: Number(e.target.value) as 58 | 80 }))}>
            <option value={58}>58 mm</option><option value={80}>80 mm</option>
          </select>
        </div>
      </div>
      {error && <p className="feedback-error" role="alert">{error}</p>}
      {success && <p className="feedback-success" role="status">{success}</p>}
      <button type="button" disabled={saving} className="primary-button" onClick={() => void save()}>
        {saving ? "Salvando..." : "Salvar configurações fiscais"}
      </button>
      <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
        O certificado digital A1, CSC, credenciais da Focus NFe, séries e regras de autorização serão configurados em fase posterior,
        com proteção de segredos no servidor. A impressão nesta fase usa o diálogo do navegador e é somente não fiscal.
      </p>
    </div>
  </section>;
}
