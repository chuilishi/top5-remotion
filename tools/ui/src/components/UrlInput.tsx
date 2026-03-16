import { useMemo } from 'react';
import { extractUrls } from '../utils';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function UrlInput({ value, onChange }: Props) {
  const urls = useMemo(() => extractUrls(value), [value]);

  return (
    <div className="section">
      <label>粘贴包含链接的文本</label>
      <textarea
        placeholder="将包含视频链接的文本粘贴到这里..."
        rows={5}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {urls.length > 0 && (
        <div className="url-preview">
          <div className="url-preview-header">✅ 识别到 {urls.length} 个链接</div>
          <ul className="url-list">
            {urls.map((u, i) => (
              <li key={i}><a href={u} target="_blank" rel="noopener">{u}</a></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
