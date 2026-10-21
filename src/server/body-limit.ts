import { AppError } from '../core/errors';
export async function boundedBody(request: Request, limit: number) {
  const reader = request.body?.getReader(); if (!reader) return '';
  const decoder = new TextDecoder(); let length = 0, text = '';
  try { while (true) { const { value, done } = await reader.read(); if (done) break; length += value.byteLength; if (length > limit) { await reader.cancel(); throw new AppError('请求内容过大。', 413); } text += decoder.decode(value, { stream: true }); } return text + decoder.decode(); }
  finally { reader.releaseLock(); }
}
