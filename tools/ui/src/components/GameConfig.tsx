import { titleToFolder } from '../utils';
import type { GameData } from '../types';

interface Props {
  rank: number;
  onRankChange: (rank: number) => void;
  titleEn: string;
  titleZh: string;
  onTitleChange: (en: string, zh: string) => void;
  game?: GameData;
}

export function GameConfig({ rank, onRankChange, titleEn, titleZh, onTitleChange, game }: Props) {
  const folder = titleToFolder(titleEn);

  return (
    <div className="section-row">
      <div className="section">
        <label>排名</label>
        <select value={rank} onChange={e => onRankChange(+e.target.value)}>
          <option value={5}>#5</option>
          <option value={4}>#4</option>
          <option value={3}>#3</option>
          <option value={2}>#2</option>
          <option value={1}>#1</option>
        </select>
        {game && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
            <span className="game-tag" style={{ background: '#555', color: '#fff' }}>
              {game.titleEn}
            </span>{' '}
            {game.titleZh || ''}
          </div>
        )}
      </div>
      <div className="section">
        <label>英文名称</label>
        <div className="cmd-box">
          <input type="text" placeholder="English Title" spellCheck={false}
            value={titleEn} onChange={e => onTitleChange(e.target.value, titleZh)} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label>中文名称</label>
          <div className="cmd-box">
            <input type="text" placeholder="中文标题" spellCheck={false}
              value={titleZh} onChange={e => onTitleChange(titleEn, e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <label>输出文件夹 <span className="hint">（自动生成，public/ 下）</span></label>
          <div style={{ fontFamily: "'Cascadia Code','Fira Code','Consolas',monospace", fontSize: 13, color: '#ffcc66', padding: '4px 0' }}>
            {folder || '—'}
          </div>
        </div>
      </div>
    </div>
  );
}
