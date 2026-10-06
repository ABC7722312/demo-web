import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore, parse, Win, Rule, Meld } from '../src/core.ts';

const rule: Rule = { kuitan: true, kiriage: false, uraDora: true };
const W = (o: Partial<Win> = {}): Win => ({ tsumo: false, dealer: false, roundWind: 27, seatWind: 28, riichi: 0, ippatsu: false,
  haitei: false, rinshan: false, chankan: false, tenhou: false, chiihou: false, doraInd: [], uraInd: [], honba: 0, kyotaku: 0, ...o });
const run = (h: string, win: string, o: Partial<Win> = {}, melds: Meld[] = []) => {
  const p = parse(h);
  return calculateScore({ closed: p.tiles, melds, winTile: parse(win).tiles[0], aka: p.aka }, rule, W(o));
};
const ok = (r: ReturnType<typeof run>) => { assert.equal(r.ok, true, JSON.stringify(r)); return r as Extract<typeof r, { ok: true }>; };

test('子ロン 立直平和 30符2飜=2000', () => {
  const r = ok(run('234m234567p789s55s', '4p', { riichi: 1 }));
  assert.deepEqual([r.totalHan, r.fu, r.score], [2, 30, 2000]);
});
test('子ツモ 立直+ツモ平和 3飜20符 = 700/1300', () => {
  const r = ok(run('234m234567p789s55s', '4p', { riichi: 1, tsumo: true }));
  assert.deepEqual([r.totalHan, r.fu, r.payments.map((p) => p.amount)], [3 + 0, 20, [1300, 700]]);
});
test('国士無双 親ロン 48000', () => assert.equal(ok(run('119m19p19s1234567z', '1m', { dealer: true })).score, 48000));
test('七対子 子ロン 25符2飜=1600', () => {
  const r = ok(run('1122m3344p5566s77z', '7z'));
  assert.deepEqual([r.fu, r.totalHan, r.score], [25, 2, 1600]);
});
test('複数分解: 二盃口と七対子から高い方(二盃口)を採用', () => {
  const r = ok(run('112233m445566p11z', '1z', { tsumo: true, seatWind: 29, roundWind: 28 }));
  assert.deepEqual([r.totalHan, r.fu, r.score], [4, 30, 7900]);
});
test('ドラのみは和了不可', () => assert.equal(run('123m456p789s13p55s', '2p', { doraInd: [0] }).ok, false));
test('不正入力: 枚数不足 / 5枚目', () => {
  assert.equal(run('123m456p', '1m').ok, false);
  assert.equal(run('1111m1m456p789s55s', '1m').ok, false);
});
