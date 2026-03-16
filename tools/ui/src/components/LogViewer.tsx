import { useEffect, useRef } from 'react';

interface Props {
  logs: Array<{ msg: string; cls: string }>;
  onClear: () => void;
}

export function LogViewer({ logs, onClear }: Props) {
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="section">
      <div className="log-header">
        <label>执行日志</label>
        <button className="btn-ghost" onClick={onClear}>清空</button>
      </div>
      <div ref={outputRef} className="log-output">
        {logs.map((l, i) => (
          <div key={i} className={`log-line ${l.cls}`}>{l.msg}</div>
        ))}
      </div>
    </div>
  );
}
