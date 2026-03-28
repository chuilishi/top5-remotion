import { useState } from 'react';
import { UploadPage } from './components/UploadPage';
import { DanmakuPage } from './components/DanmakuPage';

export function App() {
  const [page, setPage] = useState<'upload' | 'danmaku'>('upload');

  return (
    <div className="app-fullwidth">
      <nav className="page-nav">
        <button className={`nav-tab${page === 'upload' ? ' active' : ''}`} onClick={() => setPage('upload')}>B站投稿</button>
        <button className={`nav-tab${page === 'danmaku' ? ' active' : ''}`} onClick={() => setPage('danmaku')}>弹幕发送</button>
      </nav>
      {page === 'danmaku' ? (
        <div style={{ maxWidth: 600, margin: '0 auto', padding: 16 }}>
          <DanmakuPage />
        </div>
      ) : (
        <div style={{ maxWidth: 600, margin: '0 auto', padding: 16 }}>
          <UploadPage />
        </div>
      )}
    </div>
  );
}
