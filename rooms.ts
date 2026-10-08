// 記録の部屋: 各記録は固有IDを持ち、本体(raw JSON文字列)と一覧用メタを別キーで保存。外部サーバー不要。
// rev と固有IDにより、将来のオンライン同期（差分比較・マージ）へ拡張できる。
export interface Summary { players: { name: string; seat: number; points: number }[]; rw: number; honba: number; kyotaku: number; hands: number }
export interface RoomMeta { id: string; name: string; createdAt: number; updatedAt: number; rev: number; summary: Summary }
export interface Store { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
const IDX = 'mj.rooms.v1';
const KEY = (id: string) => `mj.room.v1.${id}`;
export const dateName = (d: Date) => `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
export const cleanName = (s: string, fallback: string) => s.replace(/\s+/g, ' ').trim().slice(0, 30) || fallback;
export const newId = (): string => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
const validMeta = (m: unknown): m is RoomMeta => { const o = m as RoomMeta; return !!o && typeof o.id === 'string' && typeof o.name === 'string' && typeof o.updatedAt === 'number' && typeof o.createdAt === 'number' && !!o.summary; };

export class RoomRepo {
  constructor(private s: Store) {}
  private readIdx(): RoomMeta[] { try { const a: unknown = JSON.parse(this.s.getItem(IDX) ?? '[]'); return Array.isArray(a) ? a.filter(validMeta) : []; } catch { return []; } }
  private writeIdx(a: RoomMeta[]) { this.s.setItem(IDX, JSON.stringify(a)); }
  list(): RoomMeta[] { return this.readIdx().sort((a, b) => b.updatedAt - a.updatedAt); }
  create(name: string, raw: string, summary: Summary, now: number): RoomMeta {
    const m: RoomMeta = { id: newId(), name: cleanName(name, dateName(new Date(now))), createdAt: now, updatedAt: now, rev: 1, summary };
    this.s.setItem(KEY(m.id), raw); this.writeIdx([...this.readIdx(), m]); return m;
  }
  load(id: string): { meta: RoomMeta; raw: string } | null {
    const meta = this.readIdx().find((m) => m.id === id); const raw = this.s.getItem(KEY(id));
    return meta && raw != null ? { meta, raw } : null;
  }
  save(id: string, raw: string, summary: Summary, now: number, name?: string): void {
    const a = this.readIdx(); const m = a.find((x) => x.id === id); if (!m) throw new Error('記録が見つかりません');
    this.s.setItem(KEY(id), raw); m.updatedAt = now; m.rev++; m.summary = summary; if (name !== undefined) m.name = cleanName(name, m.name); this.writeIdx(a);
  }
  rename(id: string, name: string, now: number): void {
    const a = this.readIdx(); const m = a.find((x) => x.id === id); if (!m) throw new Error('記録が見つかりません');
    m.name = cleanName(name, dateName(new Date(m.createdAt))); m.updatedAt = now; m.rev++; this.writeIdx(a);
  }
  remove(id: string): void { this.s.removeItem(KEY(id)); this.writeIdx(this.readIdx().filter((m) => m.id !== id)); }
  duplicate(id: string, now: number, name?: string): RoomMeta | null {
    const r = this.load(id); if (!r) return null;
    const m: RoomMeta = { ...r.meta, id: newId(), name: cleanName(name ?? `${r.meta.name}のコピー`, r.meta.name), createdAt: now, updatedAt: now, rev: 1 };
    this.s.setItem(KEY(m.id), r.raw); this.writeIdx([...this.readIdx(), m]); return m;
  }
}
/** 保存データの最低限の整合性検査。壊れていれば開かず、削除だけ可能にする。 */
export function validState(o: unknown): boolean {
  const r = o as { S?: Record<string, unknown>; hist?: unknown } | null;
  if (!r || typeof r !== 'object' || !r.S || !Array.isArray(r.hist)) return false;
  const { players, hand, melds, history } = r.S;
  if (!Array.isArray(hand) || !Array.isArray(melds) || !Array.isArray(history) || !Array.isArray(players) || players.length !== 4) return false;
  const ps = players as { id: unknown; seat: unknown; points: unknown; name: unknown }[];
  return ps.every((p) => p && typeof p.id === 'number' && typeof p.name === 'string' && typeof p.points === 'number' && Number.isInteger(p.seat) && (p.seat as number) >= 0 && (p.seat as number) <= 3)
    && new Set(ps.map((p) => p.seat)).size === 4 && new Set(ps.map((p) => p.id)).size === 4;
}
