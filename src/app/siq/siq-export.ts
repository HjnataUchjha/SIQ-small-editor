import JSZip from 'jszip';
import { type LoadedSiq } from './siq-package';

export interface SiqDownload {
  readonly fileName: string;
  readonly blob: Blob;
}

function storedCompression(entry: JSZip.JSZipObject): 'STORE' | 'DEFLATE' {
  const data = (entry as JSZip.JSZipObject & { _data?: { compression?: { magic?: string } } })._data;
  if (data?.compression?.magic === '\x00\x00') return 'STORE';
  if (data?.compression?.magic === '\x08\x00') return 'DEFLATE';
  return entry.options.compression || 'DEFLATE';
}

export async function prepareSiqDownload(
  current: LoadedSiq,
  onProgress?: (percent: number) => void,
): Promise<SiqDownload> {
  const output = new JSZip();
  const archiveComment = (current.archive as JSZip & { comment?: string | null }).comment;
  for (const [name, entry] of Object.entries(current.archive.files)) {
    // Копия метаданных, но общий буфер сжатых данных. Входной архив не изменяем.
    const copy = Object.assign(Object.create(Object.getPrototypeOf(entry)) as JSZip.JSZipObject, entry);
    copy.options = { ...entry.options, compression: storedCompression(entry) };
    output.files[name] = copy;
  }

  const originalXml = current.archive.file('content.xml');
  if (!originalXml) throw new Error('В исходном архиве отсутствует content.xml');

  // JSZip кодирует строки в UTF-8. У исходного XML могла быть другая кодировка.
  const contentXml = current.contentXml.replace(
    /^(\uFEFF?\s*<\?xml\b[^?]*\bencoding\s*=\s*)(["'])[^"']+\2/i,
    '$1"utf-8"',
  );
  output.file('content.xml', contentXml, {
    date: originalXml.date,
    comment: originalXml.comment,
    unixPermissions: originalXml.unixPermissions,
    dosPermissions: originalXml.dosPermissions,
    createFolders: false,
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const blob = await output.generateAsync({
    type: 'blob',
    mimeType: 'application/octet-stream',
    streamFiles: true,
    comment: archiveComment ?? undefined,
    compression: 'DEFLATE',
    platform: Object.values(output.files).some((entry) => entry.unixPermissions != null) ? 'UNIX' : 'DOS',
  }, ({ percent }) => onProgress?.(Math.min(100, Math.max(0, Math.floor(percent)))));

  return { fileName: current.fileName.replace(/\.siq$/i, '') + '_shuffled.siq', blob };
}

export function downloadSiqFile(download: SiqDownload): void {
  const url = URL.createObjectURL(download.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = download.fileName;
  link.hidden = true;
  try {
    document.body.appendChild(link);
    link.click();
  } catch (error: unknown) {
    URL.revokeObjectURL(url);
    throw error;
  } finally {
    link.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
