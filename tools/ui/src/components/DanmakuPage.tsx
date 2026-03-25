import { useState, useCallback, useEffect } from 'react';

interface DanmakuItem {
  time: number;
  msg: string;
  color: string;
  mode: 1 | 4 | 5;
}

interface CookieEntry {
  label: string;
  sessdata: string;
  bili_jct: string;
}

const COLOR_PRESETS: { label: string; value: string }[] = [
  { label: '白', value: '#FFFFFF' },
  { label: '红', value: '#FF0000' },
  { label: '蓝', value: '#4FC3F7' },
  { label: '绿', value: '#66BB6A' },
  { label: '黄', value: '#FFEB3B' },
  { label: '橙', value: '#FF9800' },
  { label: '粉', value: '#E91E63' },
];

function hexToDecimal(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

const STORAGE_KEY_LIST = 'danmaku_list';

function loadList(): DanmakuItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LIST);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [{ time: 1, msg: '', color: '#FFFFFF', mode: 1 }];
}

function saveList(list: DanmakuItem[]) {
  localStorage.setItem(STORAGE_KEY_LIST, JSON.stringify(list));
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function DanmakuPage() {
  const [bvid, setBvid] = useState('');
  const [cookies, setCookies] = useState<CookieEntry[]>([]);
  const [selectedCookieIdx, setSelectedCookieIdx] = useState(0);
  const [showCookie, setShowCookie] = useState(false);
  const [cookieLoaded, setCookieLoaded] = useState(false);
  const [items, setItems] = useState<DanmakuItem[]>(() => loadList());
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<{ idx: number; ok: boolean; msg: string }[]>([]);
  const [projects, setProjects] = useState<{ name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState('');

  useEffect(() => {
    fetch('/api/danmaku/cookie').then(r => r.json()).then(data => {
      const list: CookieEntry[] = data.cookies || [];
      setCookies(list);
      setCookieLoaded(true);
    }).catch(() => setCookieLoaded(true));
  }, []);

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(data => {
      setProjects(data.projects || []);
      if (data.current) setSelectedProject(data.current);
    }).catch(() => {});
  }, []);

  const activeCookie = cookies[selectedCookieIdx] || null;
  const cookieReady = Boolean(activeCookie?.sessdata && activeCookie?.bili_jct);

  const updateItem = useCallback((idx: number, patch: Partial<DanmakuItem>) => {
    setItems(prev => {
      const next = prev.map((it, i) => i === idx ? { ...it, ...patch } : it);
      saveList(next);
      return next;
    });
  }, []);

  const addItem = useCallback(() => {
    setItems(prev => {
      const lastTime = prev.length > 0 ? prev[prev.length - 1].time + 5 : 0;
      const next = [...prev, { time: lastTime, msg: '', color: '#FFFFFF', mode: 1 as const }];
      saveList(next);
      return next;
    });
  }, []);

  const handlePrefill = useCallback(async () => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/danmaku/timing?project=${encodeURIComponent(selectedProject)}`);
      const data = await res.json();
      if (!data.gameplayStarts?.length) return;
      const newItems: DanmakuItem[] = data.gameplayStarts.map((sec: number, i: number) => ({
        time: Math.round(sec),
        msg: '',
        color: '#FFFFFF',
        mode: 1 as const,
      }));
      setItems(newItems);
      saveList(newItems);
    } catch {}
  }, [selectedProject]);

  const removeItem = useCallback((idx: number) => {
    setItems(prev => {
      const next = prev.filter((_, i) => i !== idx);
      saveList(next);
      return next;
    });
  }, []);

  const handleSaveCookies = async () => {
    await fetch('/api/danmaku/cookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookies }),
    });
    setShowCookie(false);
  };

  const updateCookie = (idx: number, patch: Partial<CookieEntry>) => {
    setCookies(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  };

  const addCookie = () => {
    setCookies(prev => [...prev, { label: `账号${prev.length + 1}`, sessdata: '', bili_jct: '' }]);
  };

  const removeCookie = (idx: number) => {
    setCookies(prev => {
      const next = prev.filter((_, i) => i !== idx);
      if (selectedCookieIdx >= next.length) setSelectedCookieIdx(Math.max(0, next.length - 1));
      return next;
    });
  };

  const handleSend = async () => {
    const validItems = items.filter(it => it.msg.trim());
    if (!validItems.length || !bvid.trim() || !activeCookie) return;
    setSending(true);
    setLogs([]);

    try {
      const res = await fetch('/api/danmaku/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bvid: bvid.trim(),
          sessdata: activeCookie.sessdata,
          bili_jct: activeCookie.bili_jct,
          items: validItems.map(it => ({
            time: it.time,
            msg: it.msg,
            color: hexToDecimal(it.color),
            mode: it.mode,
          })),
        }),
      });
      const data = await res.json();
      setLogs(data.results || []);
    } catch (e: any) {
      setLogs([{ idx: 0, ok: false, msg: e.message }]);
    } finally {
      setSending(false);
    }
  };

  const validCount = items.filter(it => it.msg.trim()).length;

  return (
    <div className="upload-page">
      <h2 style={{ marginBottom: 20, fontSize: 18 }}>弹幕发送</h2>

      <div className="section" style={{ marginBottom: 12 }}>
        <label>
          Cookie
          <span style={{ marginLeft: 8, fontSize: 10, color: cookieReady ? '#4ade80' : '#f87171' }}>
            {cookieReady ? '● 已配置' : cookies.length === 0 ? '● 未配置' : '● 未选择'}
          </span>
        </label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {cookies.length > 0 && (
            <select
              value={selectedCookieIdx}
              onChange={e => setSelectedCookieIdx(parseInt(e.target.value))}
              style={{ flex: 1, fontSize: 12, padding: '6px 8px' }}
            >
              {cookies.map((c, i) => (
                <option key={i} value={i}>{c.label || `账号${i + 1}`}</option>
              ))}
            </select>
          )}
          <button className="btn-ghost" onClick={() => setShowCookie(!showCookie)}>
            {showCookie ? '收起' : '管理'}
          </button>
        </div>
        {showCookie && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cookies.map((ck, ci) => (
              <div key={ci} style={{ padding: 10, border: '1px solid #333', borderRadius: 6, background: ci === selectedCookieIdx ? '#1a1a2e' : 'transparent' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <input
                    type="text"
                    className="timing-text-input"
                    value={ck.label}
                    onChange={e => updateCookie(ci, { label: e.target.value })}
                    placeholder="名称"
                    style={{ width: 100, fontSize: 12 }}
                  />
                  <button className="btn-remove" onClick={() => removeCookie(ci)} title="删除">×</button>
                  <span style={{ fontSize: 10, color: '#555', marginLeft: 'auto' }}>
                    粘贴Cookie表自动提取 ↓
                  </span>
                </div>
                <textarea
                  className="timing-text-input"
                  rows={2}
                  placeholder="粘贴 Chrome DevTools Cookie 表格内容"
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: 10, resize: 'vertical', marginBottom: 6 }}
                  onChange={e => {
                    const lines = e.target.value.split('\n');
                    const patch: Partial<CookieEntry> = {};
                    for (const line of lines) {
                      const cols = line.split('\t');
                      const name = cols[0]?.trim();
                      const value = cols[1]?.trim();
                      if (name === 'SESSDATA' && value) patch.sessdata = value;
                      if (name === 'bili_jct' && value) patch.bili_jct = value;
                    }
                    if (patch.sessdata || patch.bili_jct) updateCookie(ci, patch);
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="timing-text-input"
                    value={ck.sessdata}
                    onChange={e => updateCookie(ci, { sessdata: e.target.value })}
                    placeholder="SESSDATA"
                    style={{ flex: 1, fontFamily: 'monospace', fontSize: 10 }}
                  />
                  <input
                    type="text"
                    className="timing-text-input"
                    value={ck.bili_jct}
                    onChange={e => updateCookie(ci, { bili_jct: e.target.value })}
                    placeholder="bili_jct"
                    style={{ flex: 1, fontFamily: 'monospace', fontSize: 10 }}
                  />
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-add" onClick={addCookie}>+ 添加账号</button>
              <button className="btn-save" style={{ fontSize: 12, padding: '6px 14px' }} onClick={handleSaveCookies}>
                保存全部
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="section" style={{ marginBottom: 12 }}>
        <label>项目</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            style={{ flex: 1, fontSize: 12, padding: '6px 8px' }}
          >
            <option value="">选择项目...</option>
            {projects.map(p => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
          <button className="btn-ghost" onClick={handlePrefill} disabled={!selectedProject} title="根据项目时间线预填5条弹幕时间">
            预填时间
          </button>
        </div>
      </div>

      <div className="section" style={{ marginBottom: 12 }}>
        <label>目标视频</label>
        <input
          type="text"
          className="timing-text-input"
          value={bvid}
          onChange={e => setBvid(e.target.value)}
          placeholder="BV号，如 BV1VMQkBzErh"
          style={{ width: '100%' }}
        />
      </div>

      <div className="section" style={{ marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>弹幕列表 ({items.length}条)</span>
          <button className="btn-add" onClick={addItem}>+ 添加</button>
        </label>
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {items.map((it, idx) => (
            <div key={idx} className="sub-item" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 56 }}>
                <input
                  type="number"
                  className="timing-input"
                  value={it.time}
                  onChange={e => updateItem(idx, { time: parseInt(e.target.value) || 0 })}
                  min={0}
                  style={{ width: 56 }}
                  title="秒数"
                />
                <span style={{ fontSize: 9, color: '#555', textAlign: 'center' }}>{formatTime(it.time)}</span>
              </div>
              <input
                type="text"
                className="timing-text-input"
                value={it.msg}
                onChange={e => updateItem(idx, { msg: e.target.value })}
                placeholder="弹幕内容"
                style={{ flex: 1 }}
              />
              <div style={{ display: 'flex', gap: 3 }}>
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => updateItem(idx, { color: c.value })}
                    title={c.label}
                    style={{
                      width: 18, height: 18, borderRadius: 3, border: it.color === c.value ? '2px solid #fff' : '1px solid #333',
                      background: c.value, cursor: 'pointer', padding: 0,
                    }}
                  />
                ))}
              </div>
              <select
                value={it.mode}
                onChange={e => updateItem(idx, { mode: parseInt(e.target.value) as 1 | 4 | 5 })}
                style={{ width: 56, fontSize: 11, padding: '4px 2px', backgroundPosition: 'right 4px center', paddingRight: 16 }}
              >
                <option value={1}>滚动</option>
                <option value={5}>顶部</option>
                <option value={4}>底部</option>
              </select>
              <button className="btn-remove" onClick={() => removeItem(idx)} title="删除">×</button>
            </div>
          ))}
        </div>
      </div>

      <div className="actions" style={{ marginTop: 16 }}>
        <button
          className="btn-primary"
          onClick={handleSend}
          disabled={sending || !cookieReady || !bvid.trim() || validCount === 0}
          style={{ minWidth: 120 }}
        >
          {sending ? '发送中...' : `发送 ${validCount} 条弹幕`}
        </button>
      </div>

      {logs.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <label>发送结果</label>
          <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 12, fontFamily: 'monospace' }}>
            {logs.map((log, i) => (
              <div
                key={i}
                style={{
                  padding: '4px 8px', margin: '2px 0', borderRadius: 4,
                  background: log.ok ? '#052e16' : '#450a0a',
                  color: log.ok ? '#4ade80' : '#fca5a5',
                }}
              >
                {log.ok ? '✓' : '✗'} {log.msg}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
