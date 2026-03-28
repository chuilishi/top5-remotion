import { useState, useEffect, useCallback } from 'react';

interface VideoFile {
  name: string;
  sizeMB: number;
  mtime: string;
}

interface UploadInfo {
  titleSuggestion: string;
  tagSuggestion: string;
  lastEpisode: number;
  currentProject: string | null;
  partitions: { tid: number; name: string }[];
  accounts: string[];
}

function getSmartScheduleTime(): string {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let target: Date;
  if (h < 11 || (h === 11 && m < 30)) {
    target = new Date(today.getTime() + 11 * 3600000 + 30 * 60000);
  } else if (h < 18) {
    target = new Date(today.getTime() + 18 * 3600000);
  } else {
    target = new Date(today.getTime() + 86400000 + 11 * 3600000 + 30 * 60000);
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`;
}

export function UploadPage() {
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [info, setInfo] = useState<UploadInfo | null>(null);
  const [selectedVideo, setSelectedVideo] = useState('');
  const [episode, setEpisode] = useState(1);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [tid, setTid] = useState(237);
  const [account, setAccount] = useState('cookies');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'custom'>('custom');
  const [scheduleTime, setScheduleTime] = useState(() => getSmartScheduleTime());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const loadData = useCallback(async () => {
    const [vRes, iRes] = await Promise.all([
      fetch('/api/upload/videos').then(r => r.json()),
      fetch('/api/upload/info').then(r => r.json()),
    ]);
    setVideos(vRes);
    setInfo(iRes);
    if (vRes.length > 0 && !selectedVideo) setSelectedVideo(vRes[0].name);
    if (iRes.accounts?.length > 0 && !account) setAccount(iRes.accounts[0]);
    if (iRes.tagSuggestion) setTags(iRes.tagSuggestion);
    const ep = (iRes.lastEpisode || 0) + 1;
    setEpisode(ep);
    const base = iRes.titleSuggestion || '全球前五XXX';
    setTitle(`第${ep}期 | ${base}`);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!info) return;
    const base = info.titleSuggestion || '全球前五XXX';
    setTitle(`第${episode}期 | ${base}`);
  }, [episode, info]);

  const handleSubmit = async () => {
    if (!selectedVideo || !title) return;
    setSubmitting(true);
    setResult(null);
    try {
      let dtime: number | null = null;
      if (scheduleMode === 'custom' && scheduleTime) {
        dtime = Math.floor(new Date(scheduleTime).getTime() / 1000);
      }
      const res = await fetch('/api/upload/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video: selectedVideo, title, tid, dtime, episode, account, tags }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, message: data.message || '投稿成功！' });
      } else {
        setResult({ ok: false, message: data.error || '投稿失败' });
      }
    } catch (e: any) {
      setResult({ ok: false, message: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const now = new Date();
  const minTime = new Date(now.getTime() + 5 * 60000).toISOString().slice(0, 16);
  const maxTime = new Date(now.getTime() + 15 * 86400000).toISOString().slice(0, 16);

  return (
    <div className="upload-page">
      <h2 style={{ marginBottom: 20, fontSize: 18 }}>B站投稿</h2>

      <div className="upload-form">
        {(info?.accounts?.length ?? 0) > 1 && (
          <div className="section" style={{ marginBottom: 12 }}>
            <label>账号</label>
            <select value={account} onChange={e => setAccount(e.target.value)}>
              {info!.accounts.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        )}

        <div className="section" style={{ marginBottom: 12 }}>
          <label>视频文件</label>
          {videos.length === 0 ? (
            <div style={{ color: '#666', fontSize: 13 }}>out/ 目录下无 mp4 文件</div>
          ) : (
            <select value={selectedVideo} onChange={e => setSelectedVideo(e.target.value)}>
              {videos.map(v => (
                <option key={v.name} value={v.name}>
                  {v.name} ({v.sizeMB}MB, {new Date(v.mtime).toLocaleDateString('zh-CN')} {new Date(v.mtime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="section" style={{ marginBottom: 12 }}>
          <label>期数</label>
          <input
            type="number"
            className="timing-input"
            style={{ width: 80 }}
            value={episode}
            onChange={e => setEpisode(parseInt(e.target.value) || 1)}
            min={1}
          />
          <span style={{ fontSize: 11, color: '#666', marginLeft: 8 }}>
            上期: {info?.lastEpisode ?? 0}
          </span>
        </div>

        <div className="section" style={{ marginBottom: 12 }}>
          <label>标题</label>
          <input
            type="text"
            className="timing-text-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div className="section" style={{ marginBottom: 12 }}>
          <label>标签 <span className="hint">逗号分隔，B站限制10个</span></label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              className="timing-text-input"
              value={tags}
              onChange={e => setTags(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              className="btn-ghost"
              onClick={async () => {
                const res = await fetch(`/api/upload/tag-recommend?title=${encodeURIComponent(title)}&account=${encodeURIComponent(account)}`);
                const data = await res.json();
                if (data.tags?.length) {
                  const existing = tags.split(',').map(t => t.trim()).filter(Boolean);
                  const merged = [...new Set([...existing, ...data.tags])].slice(0, 10);
                  setTags(merged.join(','));
                }
              }}
              title="根据标题从B站获取推荐标签"
            >推荐</button>
          </div>
        </div>

        <div className="section" style={{ marginBottom: 12 }}>
          <label>分区</label>
          <select value={tid} onChange={e => setTid(parseInt(e.target.value))}>
            {info?.partitions.map(p => (
              <option key={p.tid} value={p.tid}>tid={p.tid} {p.name}</option>
            ))}
          </select>
        </div>

        <div className="section" style={{ marginBottom: 12 }}>
          <label>发布时间</label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', margin: 0, textTransform: 'none', letterSpacing: 0 }}>
              <input type="radio" checked={scheduleMode === 'now'} onChange={() => setScheduleMode('now')} />
              立即发布
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', margin: 0, textTransform: 'none', letterSpacing: 0 }}>
              <input type="radio" checked={scheduleMode === 'custom'} onChange={() => setScheduleMode('custom')} />
              定时发布
            </label>
          </div>
          {scheduleMode === 'custom' && (
            <input
              type="datetime-local"
              className="timing-text-input"
              value={scheduleTime}
              onChange={e => setScheduleTime(e.target.value)}
              min={minTime}
              max={maxTime}
              style={{ width: 220, colorScheme: 'dark' }}
            />
          )}
        </div>

        <div className="section" style={{ marginBottom: 12 }}>
          <label>封面</label>
          <div style={{ fontSize: 12, color: '#888' }}>优先使用渲染封面 (_cover.png)，无则截取视频第1秒</div>
        </div>

        <div className="actions" style={{ marginTop: 16 }}>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={submitting || !selectedVideo || !title}
            style={{ minWidth: 120 }}
          >
            {submitting ? '上传中...' : '投稿'}
          </button>
        </div>

        {result && (
          <div
            style={{
              marginTop: 16,
              padding: '12px 16px',
              borderRadius: 8,
              background: result.ok ? '#052e16' : '#450a0a',
              border: `1px solid ${result.ok ? '#166534' : '#991b1b'}`,
              color: result.ok ? '#4ade80' : '#fca5a5',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
            }}
          >
            {result.ok ? '✓ ' : '✗ '}{result.message}
          </div>
        )}
      </div>
    </div>
  );
}
