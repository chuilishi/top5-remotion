interface Props {
  running: boolean;
  onClick: () => void;
}

export function GenerateButton({ running, onClick }: Props) {
  return (
    <div className="actions">
      <button className="btn-primary" style={{ flex: 1 }} disabled={running} onClick={onClick}>
        {running ? '⏳ 运行中...' : '▶ 一键生成素材'}
      </button>
    </div>
  );
}
