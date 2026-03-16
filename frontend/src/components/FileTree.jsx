import { useState } from 'react';

const EXT_COLORS = {
  jsx: '#61dafb', tsx: '#61dafb',
  ts:  '#3178c6', js:  '#f7df1e',
  css: '#ff69b4', html:'#e34f26',
  json:'#f5a623', md:  '#9ecbff',
};

const EXT_ICONS = {
  jsx: '⚛', tsx: '⚛',
  ts:  '𝘛', js:  '𝘑',
  css: '✦', html:'◈',
  json:'{}', md:  '≡',
};

function getExt(filename) {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export default function FileTree({ tree, selected, onSelect }) {
  return (
    <div style={s.root}>
      <div style={s.header}>
        <span style={s.headerIcon}>⬡</span>
        <span style={s.headerTitle}>project</span>
      </div>
      <div style={s.body}>
        <TreeNode name="/" node={tree} path="" selected={selected} onSelect={onSelect} defaultOpen />
      </div>
    </div>
  );
}

function TreeNode({ name, node, path, selected, onSelect, defaultOpen = false, depth = 0 }) {
  const isFile = node === 'file';
  const [open, setOpen] = useState(defaultOpen || depth < 2);

  if (isFile) {
    const ext = getExt(name);
    const color = EXT_COLORS[ext] || 'var(--text-2)';
    const icon  = EXT_ICONS[ext]  || '·';
    const isSelected = selected === path;
    return (
      <button
        onClick={() => onSelect(path)}
        style={{
          ...s.fileRow,
          paddingLeft: 12 + depth * 14,
          background: isSelected ? 'rgba(124,106,247,0.12)' : 'transparent',
          borderLeft: isSelected ? '2px solid var(--violet)' : '2px solid transparent',
        }}
        title={path}
      >
        <span style={{ ...s.fileIcon, color }}>{icon}</span>
        <span style={{ ...s.fileName, color: isSelected ? 'var(--text)' : 'var(--text-2)' }}>
          {name}
        </span>
      </button>
    );
  }

  const children = Object.entries(node || {}).sort(([, av], [, bv]) => {
    if (av === 'file' && bv !== 'file') return 1;
    if (av !== 'file' && bv === 'file') return -1;
    return 0;
  });

  const displayName = name === '/' ? '' : name;

  return (
    <div>
      {displayName && (
        <button
          onClick={() => setOpen(o => !o)}
          style={{ ...s.dirRow, paddingLeft: 12 + (depth - 1) * 14 }}
        >
          <span style={{ ...s.arrow, transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
          <span style={s.folderIcon}>⬡</span>
          <span style={s.dirName}>{displayName}</span>
        </button>
      )}
      {open && children.map(([childName, childNode]) => (
        <TreeNode
          key={childName}
          name={childName}
          node={childNode}
          path={displayName ? `${path ? path + '/' : ''}${displayName}/${childName}` : childName}
          selected={selected}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

const s = {
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-1)',
    borderRight: '1px solid var(--border)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  headerIcon: { fontSize: 12, color: 'var(--violet)', opacity: 0.7 },
  headerTitle: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-3)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  body: { flex: 1, overflowY: 'auto', padding: '6px 0' },
  fileRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '4px 12px',
    paddingRight: 12,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.1s',
    textAlign: 'left',
    minHeight: 26,
  },
  fileIcon: { fontSize: 11, flexShrink: 0, width: 16, textAlign: 'center' },
  fileName: { fontSize: 12, fontFamily: 'var(--font-mono)', letterSpacing: '0.01em', truncate: true },
  dirRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    minHeight: 24,
  },
  arrow: {
    fontSize: 14,
    color: 'var(--text-3)',
    transition: 'transform 0.15s',
    flexShrink: 0,
    lineHeight: 1,
    display: 'inline-block',
  },
  folderIcon: { fontSize: 12, color: 'var(--amber)', flexShrink: 0 },
  dirName: {
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-2)',
    letterSpacing: '0.01em',
  },
};
