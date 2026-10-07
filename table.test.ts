import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore, parse, Result } from '../src/core.ts';
import { newPlayers, setSeat, moveSeat, ranks, label, settle, applyDeltas, winContext, Player } from '../src/table.ts';

const calc = (ps: Player[], winnerId: number, tsumo: boolean): Result => {
  const ctx = winContext(ps, winnerId)!; const p = parse('234m234567p789s55s');
  const r = calculateScore({ closed: p.tiles, melds: [], winTile: parse('4p').tiles[0], aka: 0 }, { kuitan: true, kiriage: false, uraDora: true },
    { tsumo, dealer: ctx.dealer, roundWind: 27, seatWind: ctx.seatWind, riichi: 1, ippatsu: false, haitei: false, rinshan: false, chankan: false,
      tenhou: false, chiihou: false, doraInd: [], uraInd: [], honba: 0, kyotaku: 0 });
  assert.equal(r.ok, true); return r as Result;
};
const named = () => { const ps = newPlayers(); ['太郎', '花子', '次郎', '三郎'].forEach((n, i) => { ps[i].name = n; }); return ps; };
const sum = (d: Record<number, number>) => Object.values(d).reduce((a, b) => a + b, 0);

test('初期値と空欄は座席の既定名、同名可', () => {
  const ps = newPlayers(); assert.deepEqual(ps.map(label), ['東家', '南家', '西家', '北家']);
  ps[0].name = '  '; ps[1].name = 'A'; ps[2].name = 'A'; assert.deepEqual(ps.map(label), ['東家', 'A', 'A', '北家']);
});
test('座席入替: 太郎=東,花子=南,次郎=西,三郎=北 → 花子=東,太郎=南,三郎=西,次郎=北。点数/リーチはIDに追従', () => {
  let ps = named(); ps[0].points = 31000; ps[1].points = 20000; ps[1].riichi = 1;
  ps = setSeat(ps, 2, 0); ps = setSeat(ps, 4, 2);
  const m = Object.fromEntries(ps.map((p) => [p.name, p.seat]));
  assert.deepEqual(m, { 花子: 0, 太郎: 1, 三郎: 2, 次郎: 3 });
  assert.deepEqual([ps[0].points, ps[1].points, ps[1].riichi], [31000, 20000, 1]);
  assert.deepEqual([...new Set(ps.map((p) => p.seat))].sort(), [0, 1, 2, 3]);
});
test('座席入替は常に重複なし / 範囲外・同席は無変更 / 上下移動', () => {
  let ps = named();
  for (const [id, s] of [[1, 3], [2, 3], [4, 0], [3, 1], [1, 1]] as const) { ps = setSeat(ps, id, s); assert.deepEqual(ps.map((p) => p.seat).sort(), [0, 1, 2, 3]); }
  const before = JSON.stringify(ps); assert.equal(JSON.stringify(setSeat(ps, 1, 9)), before); assert.equal(JSON.stringify(setSeat(ps, 1, -1)), before);
  const a = named(); const b = moveSeat(a, 1, 1); assert.deepEqual([b[0].seat, b[1].seat], [1, 0]);
  assert.equal(JSON.stringify(moveSeat(a, 1, -1)), JSON.stringify(a));
});
test('順位: 点数降順、同点は席順', () => {
  const ps = newPlayers(); ps[0].points = 20000; ps[1].points = 30000; ps[2].points = 25000; ps[3].points = 25000;
  assert.deepEqual(ranks(ps), { 1: 4, 2: 1, 3: 2, 4: 2 });
});
test('親・自風は和了者の座席から導出(座席変更に追従)', () => {
  let ps = named(); assert.deepEqual(winContext(ps, 1), { dealer: true, seatWind: 27 });
  ps = setSeat(ps, 2, 0); assert.deepEqual([winContext(ps, 2), winContext(ps, 1)], [{ dealer: true, seatWind: 27 }, { dealer: false, seatWind: 28 }]);
});
test('ロン精算: 放銃者→和了者のみ移動、合計0', () => {
  const ps = named(); const r = calc(ps, 2, false); // 花子(南)=子
  const s = settle(ps, 2, 4, false, r, 0); assert.ok(s.ok); if (!s.ok) return;
  assert.deepEqual(s.deltas, { 1: 0, 2: 2000, 3: 0, 4: -2000 }); assert.equal(sum(s.deltas), 0);
  assert.deepEqual(applyDeltas(ps, s.deltas).map((p) => p.points), [25000, 27000, 25000, 23000]);
});
test('子ツモ: 親が多く払う / 親ツモ: 全員同額', () => {
  const ps = named(); const s = settle(ps, 2, null, true, calc(ps, 2, true), 0); assert.ok(s.ok); if (!s.ok) return;
  assert.deepEqual(s.deltas, { 1: -1300, 2: 2700, 3: -700, 4: -700 });
  const d = settle(ps, 1, null, true, calc(ps, 1, true), 0); assert.ok(d.ok); if (!d.ok) return;
  assert.deepEqual(d.deltas, { 1: 3900, 2: -1300, 3: -1300, 4: -1300 });
});
test('座席入替後の精算: 親=現在の東家へ紐付く', () => {
  let ps = named(); ps = setSeat(ps, 2, 0); // 花子が東(親)、太郎が南
  const r = calc(ps, 1, true); // 太郎(南家)ツモ → 親=花子が1300
  const s = settle(ps, 1, null, true, r, 0); assert.ok(s.ok); if (!s.ok) return;
  assert.deepEqual(s.deltas, { 1: 2700, 2: -1300, 3: -700, 4: -700 });
});
test('リーチ棒・場の供託の精算 (合計 = 場の供託)', () => {
  const ps = named(); ps[2].riichi = 1; ps[3].riichi = 1; ps[1].riichi = 1; const r = calc(ps, 2, false);
  const s = settle(ps, 2, 3, false, r, 1); assert.ok(s.ok); if (!s.ok) return;
  assert.deepEqual(s.deltas, { 1: 0, 2: 5000, 3: -3000, 4: -1000 }); assert.equal(sum(s.deltas), 1000);
  assert.deepEqual(applyDeltas(ps, s.deltas).map((p) => p.riichi), [0, 0, 0, 0]);
});
test('精算の入力不備: 放銃者なし/自分/存在しないID', () => {
  const ps = named(); const r = calc(ps, 2, false);
  for (const [w, d] of [[2, null], [2, 2], [2, 99], [99, 1]] as const) assert.equal(settle(ps, w, d, false, r, 0).ok, false);
});
test('全組合せで合計0 (座席入替後も)', () => {
  let ps = named(); ps = setSeat(setSeat(ps, 3, 0), 4, 1);
  for (const w of ps) for (const d of ps) {
    if (w.id === d.id) continue;
    for (const t of [false, true]) { const s = settle(ps, w.id, t ? null : d.id, t, calc(ps, w.id, t), 0); assert.ok(s.ok); if (s.ok) assert.equal(sum(s.deltas), 0); }
  }
});
