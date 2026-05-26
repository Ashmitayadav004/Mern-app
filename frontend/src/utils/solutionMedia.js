export function formatSolutionTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

export function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function fileTypeIcon(item) {
  const m = (item?.mimeType || item?.mime_type || '').toLowerCase();
  const n = (item?.name || '').toLowerCase();
  if (m.startsWith('image/')) return '🖼️';
  if (m.startsWith('video/')) return '🎬';
  if (m.startsWith('audio/')) return '🎵';
  if (m === 'application/pdf' || n.endsWith('.pdf')) return '📄';
  if (m.includes('zip') || m.includes('rar') || m.includes('7z') || /\.(zip|rar|7z)$/.test(n)) return '🗜️';
  if (m.includes('word') || n.endsWith('.doc') || n.endsWith('.docx')) return '📝';
  if (m.includes('sheet') || n.endsWith('.xls') || n.endsWith('.xlsx')) return '📊';
  return '📎';
}

export function getMediaPreviewType(item) {
  const m = (item?.mimeType || item?.mime_type || '').toLowerCase();
  const n = (item?.name || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/') || /\.(mp4|webm|ogg|mov|mkv)$/.test(n)) return 'video';
  if (m.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/.test(n)) return 'audio';
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  return 'details';
}

export function canPreviewMedia(item) {
  return getMediaPreviewType(item) !== 'details';
}

export function downloadFile(item) {
  if (!item?.data) return;
  const name = item.name || 'download';
  const link = document.createElement('a');
  link.rel = 'noopener';
  link.download = name;

  if (item.data.startsWith('data:')) {
    link.href = item.data;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  link.href = item.data;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function openMediaInNewTab(item) {
  if (!item?.data) return;
  const w = window.open(item.data, '_blank', 'noopener,noreferrer');
  if (!w) downloadFile(item);
}
