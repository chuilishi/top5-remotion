interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function SystemPromptEditor({ value, onChange }: Props) {
  return <textarea rows={10} spellCheck={false} value={value} onChange={e => onChange(e.target.value)} />;
}
