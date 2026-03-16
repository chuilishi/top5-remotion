import { useState, useEffect, useCallback } from 'react';
import type { GameData, ClipData, SubtitleData, StatData } from './types';
import { fetchGames, fetchGameDetail, saveGameName as apiSaveGameName, saveTiming as apiSaveTiming, streamAuto } from './api';
import { DEFAULT_PROMPT, extractUrls, titleToFolder, loadPersisted, savePersisted } from './utils';
import { ProjectSelector } from './components/ProjectSelector';
import { GameConfig } from './components/GameConfig';
import { UrlInput } from './components/UrlInput';
import { TopicInput } from './components/TopicInput';
import { CollapsibleSection } from './components/CollapsibleSection';
import { ApiSettings } from './components/ApiSettings';
import { SystemPromptEditor } from './components/SystemPromptEditor';
import { GenerateButton } from './components/GenerateButton';
import { ResultDisplay } from './components/ResultDisplay';
import { TimelineEditor } from './components/TimelineEditor';
import { LogViewer } from './components/LogViewer';

export function App() {
  const [tab, setTab] = useState<'config' | 'edit'>('config');
  const [rank, setRank] = useState(5);
  const [games, setGames] = useState<GameData[]>([]);
  const [titleEn, setTitleEn] = useState('');
  const [titleZh, setTitleZh] = useState('');

  const [urlText, setUrlText] = useState(() => loadPersisted('urlInput', ''));
  const [topicText, setTopicText] = useState(() => loadPersisted('topicInput', ''));
  const [apiBase, setApiBase] = useState(() => loadPersisted('apiBase', 'http://localhost:8000/v1'));
  const [apiKey, setApiKey] = useState(() => loadPersisted('apiKey', 'sk-dummy'));
  const [apiModel, setApiModel] = useState(() => loadPersisted('apiModel', 'gemini-3.0-flash-thinking'));
  const [systemPrompt, setSystemPrompt] = useState(() => loadPersisted('systemPrompt', DEFAULT_PROMPT));

  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<Array<{ msg: string; cls: string }>>([]);
  const [resultJson, setResultJson] = useState('');
  const [showLog, setShowLog] = useState(false);

  const [currentGame, setCurrentGame] = useState<GameData | null>(null);
  const [editClips, setEditClips] = useState<ClipData[]>([]);
  const [editSubtitles, setEditSubtitles] = useState<SubtitleData[]>([]);
  const [editStats, setEditStats] = useState<StatData[]>([]);

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
    } else {
      setEditClips([]);
      setEditSubtitles([]);
      setEditStats([]);
    }
  }, [rank]);

  useEffect(() => { loadTimeline(); }, [loadTimeline]);

  const game = games.find(g => g.rank === rank);

  const handleTitleChange = useCallback(async (en: string, zh: string) => {
    setTitleEn(en);
    setTitleZh(zh);
    await apiSaveGameName(rank, en, zh).catch(() => {});
  }, [rank]);

  const log = useCallback((msg: string, cls = '') => {
    setShowLog(true);
    setLogs(prev => [...prev, { msg, cls }]);
  }, []);

  const handleGenerate = useCallback(async () => {
    const urls = extractUrls(urlText);
    if (!urls.length) { log('⚠ 未找到有效链接', 'error'); return; }
    const folder = titleToFolder(titleEn);
    if (!folder) { log('⚠ 请填写英文名称', 'error'); return; }
    if (!apiBase || !apiKey || !apiModel) { log('⚠ 请填写 API 设置', 'error'); return; }

    setRunning(true);
    try {
      for await (const msg of streamAuto({ urls, topic: topicText, rank, folderName: folder, apiBase, apiKey, model: apiModel, systemPrompt })) {
        if (msg.type === 'log') log(msg.data);
        else if (msg.type === 'json') setResultJson(msg.data);
        else if (msg.type === 'done') {
          log(`\n✓ 完成! ${msg.data.clips.length} 个切片, 总时长 ${msg.data.totalDur}s`, 'success');
          setTimeout(loadTimeline, 300);
        }
        else if (msg.type === 'error') log(`\n✗ ${msg.data}`, 'error');
      }
    } catch (err: any) {
      log(`✗ 网络错误: ${err.message}`, 'error');
    }
    setRunning(false);
  }, [urlText, titleEn, apiBase, apiKey, apiModel, topicText, rank, systemPrompt, log, loadTimeline]);

  const handleSaveTiming = useCallback(async () => {
    await apiSaveTiming(rank, editSubtitles, editStats, editClips);
  }, [rank, editSubtitles, editStats, editClips]);

  const reloadAll = useCallback(async () => {
    const g = await fetchGames().catch(() => []);
    setGames(g);
    loadTimeline();
  }, [loadTimeline]);

  return (
    <div className={tab === 'edit' ? 'app-fullwidth' : ''}>
      <div className="tab-bar">
        <button className={`tab-btn${tab === 'config' ? ' active' : ''}`} onClick={() => setTab('config')}>⚙ 配置</button>
        <button className={`tab-btn${tab === 'edit' ? ' active' : ''}`} onClick={() => setTab('edit')}>🎬 剪辑</button>
      </div>

      {tab === 'config' && (
        <div className="container">
          <div className="header">
            <div className="logo">🎬</div>
            <h1>Auto Clips — Top 5 素材工具</h1>
          </div>

          <div className="info-bar">
            粘贴视频链接 + 主题描述 → Gemini 自动分析 → 高画质切片下载到 <code>public/</code> → 自动更新 YAML 配置
          </div>

          <GameConfig
            rank={rank}
            onRankChange={setRank}
            titleEn={titleEn}
            titleZh={titleZh}
            onTitleChange={handleTitleChange}
            game={game}
          />

          <UrlInput value={urlText} onChange={(v: string) => { setUrlText(v); savePersisted('urlInput', v); }} />
          <TopicInput value={topicText} onChange={(v: string) => { setTopicText(v); savePersisted('topicInput', v); }} />

          <CollapsibleSection title="API 设置" defaultOpen={false}>
            <ApiSettings
              apiBase={apiBase} onApiBaseChange={(v: string) => { setApiBase(v); savePersisted('apiBase', v); }}
              apiKey={apiKey} onApiKeyChange={(v: string) => { setApiKey(v); savePersisted('apiKey', v); }}
              apiModel={apiModel} onApiModelChange={(v: string) => { setApiModel(v); savePersisted('apiModel', v); }}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="系统提示词"
            defaultOpen={false}
            headerExtra={<button className="btn-ghost" onClick={e => { e.stopPropagation(); setSystemPrompt(DEFAULT_PROMPT); savePersisted('systemPrompt', DEFAULT_PROMPT); }}>↺ 还原默认</button>}
          >
            <SystemPromptEditor value={systemPrompt} onChange={(v: string) => { setSystemPrompt(v); savePersisted('systemPrompt', v); }} />
          </CollapsibleSection>

          <GenerateButton running={running} onClick={handleGenerate} />

          {resultJson && <ResultDisplay json={resultJson} />}

          {showLog && <LogViewer logs={logs} onClear={() => setLogs([])} />}
        </div>
      )}

      {tab === 'edit' && (
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
                onClipsChange={setEditClips}
                onSubtitlesChange={setEditSubtitles}
                onStatsChange={setEditStats}
                onSave={handleSaveTiming}
                onRefresh={loadTimeline}
                currentGame={currentGame}
              />
            ) : (
              <div className="empty-state">暂无剪辑数据，请先在"配置"页生成素材</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
