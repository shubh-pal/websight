export default function TokenBadges({ tokens }) {
  if (!tokens) return null;

  const colorSwatches = [
    { label: 'primary',   value: tokens.primaryColor },
    { label: 'secondary', value: tokens.secondaryColor },
    { label: 'accent',    value: tokens.accentColor },
    { label: 'bg',        value: tokens.bgColor },
    { label: 'text',      value: tokens.textColor },
  ].filter(s => s.value);

  const metaItems = [
    { icon: '⊞', label: 'Type',    value: tokens.siteType },
    { icon: '⬡', label: 'Heading', value: tokens.fontHeading },
    { icon: '¶',  label: 'Body',   value: tokens.fontBody },
    { icon: '◻', label: 'Radius',  value: tokens.borderRadius },
    { icon: '◈', label: 'Pages',   value: tokens.pages?.length + ' pages' },
  ].filter(i => i.value);

  return (
    <div style={s.root}>
      {/* Color swatches */}
      <div style={s.section}>
        <span style={s.sectionLabel}>color tokens</span>
        <div style={s.swatches}>
          {colorSwatches.map(sw => (
            <div key={sw.label} style={s.swatchWrap} title={`${sw.label}: ${sw.value}`}>
              <div style={{ ...s.swatch, background: sw.value }} />
              <span style={s.swatchLabel}>{sw.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Meta */}
      <div style={s.section}>
        <span style={s.sectionLabel}>design system</span>
        <div style={s.meta}>
          {metaItems.map(item => (
            <div key={item.label} style={s.metaItem}>
              <span style={s.metaIcon}>{item.icon}</span>
              <span style={s.metaLabel}>{item.label}</span>
              <span style={s.metaValue}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const s = {
  root: {
    display: 'flex',
    gap: 24,
    padding: '14px 0',
    flexWrap: 'wrap',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-3)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  swatches: { display: 'flex', gap: 8 },
  swatchWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 5,
    cursor: 'default',
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.08)',
    transition: 'transform 0.15s',
  },
  swatchLabel: { fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' },
  meta: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    background: 'var(--bg-3)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '4px 10px',
  },
  metaIcon: { fontSize: 11, color: 'var(--violet)', flexShrink: 0 },
  metaLabel: { fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' },
  metaValue: { fontSize: 11, color: 'var(--text)', fontFamily: 'var(--font-mono)' },
};
