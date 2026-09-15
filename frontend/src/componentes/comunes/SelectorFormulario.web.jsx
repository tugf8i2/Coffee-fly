export default function SelectorFormulario({ label, value, onValueChange, options, placeholder = 'Selecciona una opción', disabled = false }) {
  return <select aria-label={label} value={value} disabled={disabled}
    onChange={(event) => onValueChange(event.target.value)}
    style={{ width: '100%', maxWidth: 620, minWidth: 0, minHeight: 48, boxSizing: 'border-box', padding: '11px 12px', border: '1px solid #B7CBBE', borderRadius: 10, backgroundColor: disabled ? '#F0F3F0' : '#FFFFFF', color: value ? '#23372A' : '#526451', fontFamily: 'inherit', fontSize: 16, cursor: disabled ? 'not-allowed' : 'pointer' }}>
    <option value="" disabled>{placeholder}</option>
    {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
  </select>;
}
