import React, { useEffect, useState } from 'react';
import {
  downloadFile,
  fileTypeIcon,
  formatFileSize,
  formatSolutionTime,
  getMediaPreviewType,
} from '../utils/solutionMedia';

export default function MediaPreviewModal({ item, items, startIndex = 0, onClose }) {
  const list = items?.length ? items : (item ? [item] : []);
  const [idx, setIdx] = useState(startIndex);

  useEffect(() => {
    setIdx(startIndex);
  }, [startIndex, item, items]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setIdx(i => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setIdx(i => Math.min(list.length - 1, i + 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [list.length, onClose]);

  if (!list.length) return null;

  const current = list[idx] || list[0];
  const previewType = getMediaPreviewType(current);
  const mime = current.mimeType || current.mime_type || '—';

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 2000, background: 'rgba(0,0,0,0.92)' }}
      onClick={onClose}
    >
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: previewType === 'details' ? 480 : 'min(92vw, 960px)',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="modal-header">
          <h3 className="modal-title" style={{ fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70vw' }}>
            {fileTypeIcon(current)} {current.name}
          </h3>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          {previewType === 'image' && (
            <img src={current.data} alt={current.name} style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', borderRadius: 'var(--radius-md)' }} />
          )}
          {previewType === 'video' && (
            <video src={current.data} controls autoPlay style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 'var(--radius-md)' }} />
          )}
          {previewType === 'audio' && (
            <div style={{ width: '100%', padding: '24px 12px' }}>
              <audio src={current.data} controls autoPlay style={{ width: '100%' }} />
            </div>
          )}
          {previewType === 'pdf' && (
            <iframe
              title={current.name}
              src={current.data}
              style={{ width: '100%', height: '60vh', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', background: '#fff' }}
            />
          )}
          {previewType === 'details' && (
            <div style={{ width: '100%', textAlign: 'center', padding: '20px 8px' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>{fileTypeIcon(current)}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 8 }}>Preview not available for this file type</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{mime}</div>
            </div>
          )}

          <div style={{ width: '100%', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            <span>Type: {mime}</span>
            <span>Size: {formatFileSize(current.size)}</span>
            {(current.uploadedAt || current.createdAt) && (
              <span>Uploaded: {formatSolutionTime(current.uploadedAt || current.createdAt)}</span>
            )}
            {current.caption && <span>Caption: {current.caption}</span>}
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {list.length > 1 && (
              <>
                <button type="button" className="btn btn-secondary btn-sm" disabled={idx <= 0} onClick={() => setIdx(i => i - 1)}>‹ Prev</button>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{idx + 1} / {list.length}</span>
                <button type="button" className="btn btn-secondary btn-sm" disabled={idx >= list.length - 1} onClick={() => setIdx(i => i + 1)}>Next ›</button>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            <button type="button" className="btn btn-primary" onClick={() => downloadFile(current)}>⬇ Download</button>
          </div>
        </div>
      </div>
    </div>
  );
}
