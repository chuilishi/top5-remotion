interface Props {
  json: string;
}

export function ResultDisplay({ json }: Props) {
  return (
    <div className="section">
      <label>Gemini 返回的 JSON</label>
      <textarea id="resultArea" rows={8} readOnly value={json} />
    </div>
  );
}
