import type { Result } from './core';
// プレイヤーは不変の内部ID。名前・座席・点数・リーチ状態はIDに紐付く（座席は 0=東 1=南 2=西 3=北）
export interface Player { id: number; name: string; seat: number; points: number; riichi: 0 | 1 | 2 }
export interface Transfer { from: number | null; to: number; amount: number; kind: 'pay' | 'riichi' | 'kyotaku' }
export const SEAT_NAMES = ['東', '南', '西', '北'] as const;
export const DEFAULT_NAMES = ['東家', '南家', '西家', '北家'] as const;
export const START_POINTS = 25000;
export const newPlayers = (): Player[] => [1, 2, 3, 4].map((id) => ({ id, name: '', seat: id - 1, points: START_POINTS, riichi: 0 }));
export const label = (p: Player) => p.name.trim() || DEFAULT_NAMES[p.seat];
export const bySeat = (ps: Player[]) => [...ps].sort((a, b) => a.seat - b.seat);
export const find = (ps: Player[], id: number) => ps.find((p) => p.id === id);

/** 指定プレイヤーを座席へ移動。その座席の先客と入れ替える（重複・欠番は発生しない）。 */
export function setSeat(ps: Player[], id: number, seat: number): Player[] {
  const me = find(ps, id);
  if (!me || !Number.isInteger(seat) || seat < 0 || seat > 3 || me.seat === seat) return ps.map((p) => ({ ...p }));
  return ps.map((p) => (p.id === id ? { ...p, seat } : p.seat === seat ? { ...p, seat: me.seat } : { ...p }));
}
export const moveSeat = (ps: Player[], id: number, d: -1 | 1) => { const me = find(ps, id); return me ? setSeat(ps, id, me.seat + d) : ps; };

/** 順位: 点数降順、同点は席順（東が上位） */
export function ranks(ps: Player[]): Record<number, number> {
  const r: Record<number, number> = {};
  [...ps].sort((a, b) => b.points - a.points || a.seat - b.seat).forEach((p, i, arr) => { r[p.id] = i > 0 && arr[i - 1].points === p.points ? r[arr[i - 1].id] : i + 1; });
  return r;
}
/** 和了者の座席から親・自風を導出（core.ts へ渡す値） */
export const winContext = (ps: Player[], winnerId: number) => { const w = find(ps, winnerId); return w ? { dealer: w.seat === 0, seatWind: 27 + w.seat } : null; };

export type Settle = { ok: true; transfers: Transfer[]; deltas: Record<number, number> } | { ok: false; error: string };
/** 計算結果を誰から誰へ何点動くかへ展開。riichi 棒は和了者へ、場の供託(priorKyotaku本)も和了者へ。 */
export function settle(ps: Player[], winnerId: number, discarderId: number | null, tsumo: boolean, r: Result, priorKyotaku: number): Settle {
  const w = find(ps, winnerId);
  if (!w) return { ok: false, error: '和了者を選んでください' };
  if (!tsumo && (discarderId == null || !find(ps, discarderId))) return { ok: false, error: '放銃者を選んでください' };
  if (!tsumo && discarderId === winnerId) return { ok: false, error: '放銃者に和了者以外を選んでください' };
  const tr: Transfer[] = [];
  for (const p of bySeat(ps)) {
    if (p.id === winnerId) continue;
    const role = p.seat === 0 ? 'dealer' : 'child';
    const pay = tsumo ? (r.payments.find((x) => x.from === role) ?? r.payments.find((x) => x.from === 'child')) : (p.id === discarderId ? r.payments[0] : undefined);
    if (pay) tr.push({ from: p.id, to: winnerId, amount: pay.amount, kind: 'pay' });
  }
  if (priorKyotaku > 0) tr.push({ from: null, to: winnerId, amount: priorKyotaku * 1000, kind: 'kyotaku' });
  for (const p of bySeat(ps)) if (p.riichi && p.id !== winnerId) tr.push({ from: p.id, to: winnerId, amount: 1000, kind: 'riichi' });
  const deltas: Record<number, number> = Object.fromEntries(ps.map((p) => [p.id, 0]));
  for (const t of tr) { if (t.from != null) deltas[t.from] -= t.amount; deltas[t.to] += t.amount; }
  return { ok: true, transfers: tr, deltas };
}
export const applyDeltas = (ps: Player[], d: Record<number, number>): Player[] => ps.map((p) => ({ ...p, points: p.points + (d[p.id] ?? 0), riichi: 0 }));
