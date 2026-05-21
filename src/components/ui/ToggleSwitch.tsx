import "./ToggleSwitch.css";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
}

export default function ToggleSwitch({
  checked,
  onChange,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      className={`toggle-switch ${checked ? "checked" : ""}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      <span className="toggle-thumb" />
    </button>
  );
}