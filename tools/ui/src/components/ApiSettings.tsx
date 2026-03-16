interface Props {
  apiBase: string; onApiBaseChange: (v: string) => void;
  apiKey: string; onApiKeyChange: (v: string) => void;
  apiModel: string; onApiModelChange: (v: string) => void;
}

export function ApiSettings({ apiBase, onApiBaseChange, apiKey, onApiKeyChange, apiModel, onApiModelChange }: Props) {
  return (
    <>
      <div>
        <label>API Base URL</label>
        <div className="cmd-box">
          <input type="text" spellCheck={false} value={apiBase} onChange={e => onApiBaseChange(e.target.value)} />
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label>API Key</label>
        <div className="cmd-box">
          <input type="password" spellCheck={false} value={apiKey} onChange={e => onApiKeyChange(e.target.value)} />
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label>模型名称</label>
        <div className="cmd-box">
          <input type="text" spellCheck={false} value={apiModel} onChange={e => onApiModelChange(e.target.value)} />
        </div>
      </div>
    </>
  );
}
