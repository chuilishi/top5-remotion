interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function TopicInput({ value, onChange }: Props) {
  return (
    <div className="section">
      <label>主题描述 <span className="hint">（随视频一起发送给 Gemini，可粘贴整段文案）</span></label>
      <textarea
        placeholder="将包含主题描述的文本粘贴到这里..."
        rows={4}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
