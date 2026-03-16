import { useState, type ReactNode } from 'react';

interface Props {
  title: string;
  defaultOpen: boolean;
  children: ReactNode;
  headerExtra?: ReactNode;
}

export function CollapsibleSection({ title, defaultOpen, children, headerExtra }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="section">
      <div className="collapse-header" onClick={() => setOpen(o => !o)}>
        <label style={{ cursor: 'pointer', margin: 0 }}>{title}</label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {headerExtra}
          <span className={`collapse-arrow${open ? ' open' : ''}`}>▸</span>
        </div>
      </div>
      {open && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}
