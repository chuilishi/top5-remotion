import { useState, useEffect, useCallback } from 'react';
import type { GameData, ClipData, SubtitleData, StatData, VoiceoverData } from './types';
import { fetchGames, fetchGameDetail, saveGameName as apiSaveGameName, saveTiming as apiSaveTiming } from './api';
import { ProjectSelector } from './components/ProjectSelector';
import { GameConfig } from './components/GameConfig';
import { TimelineEditor } from './components/TimelineEditor';
import { UploadPage } from './components/UploadPage';
import { DanmakuPage } from './components/DanmakuPage';

export function App() {
  const [page, setPage] = useState<'editor' | 'upload' | 'danmaku'>('editor');
  const [rank, setRank] = useState(5);
  const [games, setGames] = useState<GameData[]>([]);
  const [titleEn, setTitleEn] = useState('');
  const [titleZh, setTitleZh] = useState('');

  const [currentGame, setCurrentGame] = useState<GameData | null>(null);
  const [editClips, setEditClips] = useState<ClipData[]>([]);
  const [editSubtitles, setEditSubtitles] = useState<SubtitleData[]>([]);
  const [editStats, setEditStats] = useState<StatData[]>([]);
  const [editVoiceover, setEditVoiceover] = useState<VoiceoverData[]>([]);

  useEffect(() => { fetchGames().then(setGames).catch(() => {}); }, []);

  useEffect(() => {
    const game = games.find(g => g.rank === rank);
    if (game) {
      setTitleEn(game.titleEn || '');
      setTitleZh(game.titleZh || '');
    } else {
      setTitleEn('');
      setTitleZh('');
    }
  }, [rank, games]);

  const loadTimeline = useCallback(async () => {
    const detail = await fetchGameDetail(rank);
    setCurrentGame(detail);
    if (detail?.clips?.length) {
      setEditClips(detail.clips.map(c => ({ ...c })));
      setEditSubtitles((detail.subtitles || []).map(s => ({ ...s })));
      setEditStats((detail.stats || []).map(s => ({ ...s })));
      setEditVoiceover((detail.voiceover || []).map(v => ({ ...v })));
    } else {
      setEditClips([]);
      setEditSubtitles([]);
      setEditStats([]);
      setEditVoiceover([]);
    }
  }, [rank]);

  useEffect(() => { loadTimeline(); }, [loadTimeline]);

  const game = games.find(g => g.rank === rank);

  const handleTitleChange = useCallback(async (en: string, zh: string) => {
    setTitleEn(en);
    setTitleZh(zh);
    await apiSaveGameName(rank, en, zh).catch(() => {});
  }, [rank]);

  const handleSaveTiming = useCallback(async () => {
    await apiSaveTiming(rank, editSubtitles, editStats, editClips, editVoiceover);
  }, [rank, editSubtitles, editStats, editClips, editVoiceover]);

  const reloadAll = useCallback(async () => {
    const g = await fetchGames().catch(() => []);
    setGames(g);
    loadTimeline();
  }, [loadTimeline]);

  return (
    <div className="app-fullwidth">
      <nav className="page-nav">
        <button className={`nav-tab${page === 'editor' ? ' active' : ''}`} onClick={() => setPage('editor')}>剪辑编辑器</button>
        <button className={`nav-tab${page === 'upload' ? ' active' : ''}`} onClick={() => setPage('upload')}>B站投稿</button>
        <button className={`nav-tab${page === 'danmaku' ? ' active' : ''}`} onClick={() => setPage('danmaku')}>弹幕发送</button>
      </nav>
      {page === 'upload' ? (
        <div style={{ maxWidth: 600, margin: '0 auto', padding: 16 }}>
          <UploadPage />
        </div>
      ) : page === 'danmaku' ? (
        <div style={{ maxWidth: 600, margin: '0 auto', padding: 16 }}>
          <DanmakuPage />
        </div>
      ) : (
      <div className="edit-container">
        <div className="edit-sidebar">
          <ProjectSelector onSwitch={reloadAll} />
          <GameConfig
            rank={rank}
            onRankChange={setRank}
            titleEn={titleEn}
            titleZh={titleZh}
            onTitleChange={handleTitleChange}
            game={game}
          />
        </div>
        <div className="edit-main">
          {editClips.length > 0 ? (
            <TimelineEditor
              clips={editClips}
              subtitles={editSubtitles}
              stats={editStats}
              voiceover={editVoiceover}
              onClipsChange={setEditClips}
              onSubtitlesChange={setEditSubtitles}
              onStatsChange={setEditStats}
              onVoiceoverChange={setEditVoiceover}
              onSave={handleSaveTiming}
              onRefresh={loadTimeline}
              currentGame={currentGame}
            />
          ) : (
            <div className="empty-state">暂无剪辑数据</div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
