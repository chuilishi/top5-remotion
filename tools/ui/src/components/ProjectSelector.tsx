import { useState, useEffect, useCallback } from 'react';
import { fetchProjects, switchProject, type ProjectInfo } from '../api';

interface Props {
  onSwitch: () => void;
}

export function ProjectSelector({ onSwitch }: Props) {
  const [info, setInfo] = useState<ProjectInfo>({ projects: [], current: null });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setInfo(await fetchProjects());
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSwitch = async (name: string) => {
    if (name === info.current) return;
    setLoading(true);
    try {
      await switchProject(name);
      setInfo(prev => ({ ...prev, current: name }));
      onSwitch();
    } catch (e) {
      alert(`Switch failed: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  if (info.projects.length === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <label style={{ fontSize: 13, color: '#aaa' }}>Project:</label>
      <select
        value={info.current || ''}
        onChange={e => handleSwitch(e.target.value)}
        disabled={loading}
        style={{ padding: '4px 8px', borderRadius: 4, background: '#1e1e2e', color: '#cdd6f4', border: '1px solid #45475a', fontSize: 13 }}
      >
        <option value="" disabled>(select)</option>
        {info.projects.filter(p => p.hasConfig).map(p => (
          <option key={p.name} value={p.name}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}
