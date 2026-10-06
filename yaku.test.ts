import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore, parse, Win, Rule, Meld } from '../src/core.ts';

const base: Rule = { kuitan: true, kiriage: false, uraDora: true };
const W = (o: Partial<Win> = {}): Win => ({ tsumo: false, dealer: false, roundWind: 27, seatWind: 28, riichi: 0, ippatsu: false,
  haitei: false, rinshan: false, chankan: false, tenhou: false, chiihou: false, doraInd: [], uraInd: [], honba: 0, kyotaku: 0, ...o });
type Opt = Partial<Win> & { dora?: string; ura?: string };
const run = (h: string, win: string, o: Opt = {}, melds: Meld[] = [], rule: Rule = base, meldAka = 0) => {
  const p = parse(h); const { dora, ura, ...rest } = o;
  return calculateScore({ closed: p.tiles, melds, winTile: parse(win).tiles[0], aka: p.aka + meldAka }, rule,
    W({ ...rest, doraInd: dora ? parse(dora).tiles : [], uraInd: ura ? parse(ura).tiles : [] }));
};
const ok = (r: ReturnType<typeof run>) => { assert.equal(r.ok, true, JSON.stringify(r)); return r as Extract<typeof r, { ok: true }>; };
const han = (r: ReturnType<typeof ok>, n: string) => r.yaku.filter((y) => y.n === n).map((y) => y.h);
const M = (type: Meld['type'], t: string): Meld => ({ type, tile: parse(t).tiles[0] });

// ---- 追加役満 ----
test('三槓子 2飜(副露)', () => {
  const r = ok(run('456p55s', '6p', {}, [M('ankan', '1m'), M('ankan', '2m'), M('minkan', '3m')]));
  assert.deepEqual([han(r, '三槓子'), r.yakuHan], [[2], 2]);
});
test('四槓子 役満 32000', () => {
  const r = ok(run('55s', '5s', {}, [M('minkan', '1m'), M('ankan', '9m'), M('ankan', '1p'), M('ankan', '9p')]));
  assert.deepEqual([han(r, '四槓子'), r.score], [[1], 32000]);
});
test('緑一色', () => assert.deepEqual([ok(run('223344666888s66z', '6z')).yaku[0].n, ok(run('223344666888s66z', '6z')).score], ['緑一色', 32000]));
test('清老頭(副露あり)', () => {
  const r = ok(run('111p999p11s', '1s', {}, [M('pon', '1m'), M('pon', '9m')]));
  assert.deepEqual([r.yaku.map((y) => y.n), r.score], [['清老頭'], 32000]);
});
test('九蓮宝燈 / 純正九蓮宝燈 (通常ルールは単独役満, 二倍ルールで64000)', () => {
  const a = ok(run('11123455678999m', '2m')); const b = ok(run('11123455678999m', '5m'));
  assert.deepEqual([a.yaku[0].n, a.score, b.yaku[0].n, b.score], ['九蓮宝燈', 32000, '純正九蓮宝燈', 32000]);
  assert.equal(ok(run('11123455678999m', '5m', {}, [], { ...base, doubleYakuman: true })).score, 64000);
});
test('小四喜 / 大四喜', () => {
  assert.deepEqual([ok(run('111z222z333z44z123m', '3m')).yaku[0].n, ok(run('111z222z333z44z123m', '3m')).score], ['小四喜', 32000]);
  const d = ok(run('222z333z444z11m', '1m', {}, [M('pon', '1z')]));
  assert.deepEqual([d.yaku[0].n, d.score], ['大四喜', 32000]);
  assert.equal(ok(run('222z333z444z11m', '1m', {}, [M('pon', '1z')], { ...base, doubleYakuman: true })).score, 64000);
});
test('国士無双十三面待ち / 通常国士', () => {
  assert.equal(ok(run('119m19p19s1234567z', '1m')).yaku[0].n, '国士無双十三面待ち');
  assert.equal(ok(run('119m19p19s1234567z', '9m')).yaku[0].n, '国士無双');
  assert.equal(ok(run('119m19p19s1234567z', '1m', {}, [], { ...base, doubleYakuman: true })).score, 64000);
});
test('四暗刻単騎 / 四暗刻ツモ / シャンポンロンは四暗刻不成立', () => {
  assert.equal(ok(run('111m222p333s444z55m', '5m')).yaku[0].n, '四暗刻単騎');
  assert.equal(ok(run('111m222p333s444z55m', '5m', {}, [], { ...base, doubleYakuman: true })).score, 64000);
  const t = ok(run('111m222p333s444z55m', '1m', { tsumo: true }));
  assert.deepEqual([t.yaku[0].n, t.score], ['四暗刻', 32000]);
  assert.equal(ok(run('111m222p333s444z55m', '1m')).yaku.some((y) => y.n === '四暗刻'), false);
});
test('天和/地和', () => {
  const t = ok(run('234m234567p789s55s', '4p', { tsumo: true, dealer: true, tenhou: true }));
  assert.deepEqual([t.yaku.map((y) => y.n), t.score], [['天和'], 48000]);
  assert.equal(ok(run('234m234567p789s55s', '4p', { tsumo: true, chiihou: true })).score, 32000);
});
test('大三元', () => assert.equal(ok(run('555z666z777z123m11p', '1p')).score, 32000));

// ---- 単独・複合・門前/副露(喰い下がり) ----
test('一盃口 / 対々和+三暗刻 / 三色同刻 / 小三元 / 混老頭七対子', () => {
  assert.deepEqual(han(ok(run('112233m456p789s55s', '6p')), '一盃口'), [1]);
  const t = ok(run('222m444p666s888s11z', '2m'));
  assert.deepEqual([han(t, '三暗刻'), han(t, '対々和')], [[2], [2]]);
  assert.deepEqual(han(ok(run('222m222p222s345m66s', '5m')), '三色同刻'), [2]);
  const s = ok(run('555z666z77z123m456p', '3m'));
  assert.deepEqual([han(s, '小三元'), s.yaku.filter((y) => y.n.startsWith('役牌')).length], [[2], 2]);
  const h = ok(run('1199m1199p1199s11z', '1z'));
  assert.deepEqual([h.totalHan, h.fu, h.score], [4, 25, 6400]);
});
test('純全帯么九3 / 混全帯么九2 / 清一色6+一気通貫2', () => {
  assert.deepEqual(han(ok(run('123m789m123p789p11s', '1s')), '純全帯么九'), [3]);
  assert.deepEqual(han(ok(run('123m789m123p789p11z', '1z')), '混全帯么九'), [2]);
  const c = ok(run('123m456m789m234m55m', '5m'));
  assert.deepEqual([han(c, '清一色'), han(c, '一気通貫')], [[6], [2]]);
});
test('喰い下がり: 混一色3→2 / 一気通貫2→1', () => {
  const o = ok(run('456m789m666m77z', '9m', {}, [M('chi', '1m')]));
  assert.deepEqual([han(o, '混一色'), han(o, '一気通貫'), o.totalHan], [[2], [1], 3]);
  const c = ok(run('123456789666m77z', '9m'));
  assert.deepEqual([han(c, '混一色'), han(c, '一気通貫'), c.totalHan, c.limit], [[3], [2], 5, '満貫']);
});
test('三色同順 副露1飜 / 喰いタンOFFで断么九不成立', () => {
  assert.deepEqual(han(ok(run('123p123s456p99m', '6p', { tsumo: true }, [M('chi', '1m')])), '三色同順'), [1]);
  assert.equal(ok(run('345p888p345s66s', '6s', {}, [M('chi', '2m')])).yaku[0].n, '断么九');
  assert.equal(run('345p888p345s66s', '6s', {}, [M('chi', '2m')], { ...base, kuitan: false }).ok, false);
});
test('ダブ東(連風牌)2飜 / ダブル立直・一発・海底・嶺上・槍槓', () => {
  const d = ok(run('111z234m567p789s55s', '5s', { seatWind: 27 }));
  assert.equal(d.yaku.filter((y) => y.n === '役牌(東)').length, 2);
  const n = (o: Opt) => ok(run('234m234567p789s55s', '4p', o)).yaku.map((y) => y.n);
  assert.deepEqual(n({ riichi: 2, ippatsu: true, tsumo: true, haitei: true }).sort(),
    ['ダブル立直', '一発', '平和', '海底摸月', '門前清自摸和'].sort());
  assert.ok(n({ tsumo: true, rinshan: true }).includes('嶺上開花'));
  assert.ok(n({ chankan: true }).includes('槍槓'));
  assert.ok(n({ haitei: true }).includes('河底撈魚'));
});

// ---- 符 ----
test('符: 暗刻4+雀頭2+嵌張2+門前ロン10=38→40, 立直1飜 1300', () => {
  const r = ok(run('222m345p678s456s77z', '4p', { riichi: 1 }));
  assert.deepEqual([r.fu, r.totalHan, r.score], [40, 1, 1300]);
});
test('符: 門前の暗槓(么九)32符 → 70符 2300', () => {
  const r = ok(run('234p567p789s55s', '4p', { riichi: 1 }, [M('ankan', '1m')]));
  assert.deepEqual([r.fu, r.score], [70, 2300]);
});
test('符: 副露ツモ 22→30符, 500/300', () => {
  const r = ok(run('123p123s456p99m', '6p', { tsumo: true }, [M('chi', '1m')]));
  assert.deepEqual([r.fu, r.payments.map((p) => p.amount)], [30, [500, 300]]);
});
test('符: 複数の待ち解釈から最高符(単騎40符)を採用', () => {
  const r = ok(run('22234m567p678s999s', '2m', { tsumo: true }));
  assert.deepEqual([r.fu, r.payments.map((p) => p.amount)], [40, [700, 400]]);
});

// ---- 親子・ロンツモ・本場供託・満貫以上・ドラ ----
test('親ロン/親ツモ', () => {
  assert.equal(ok(run('234m234567p789s55s', '4p', { riichi: 1, dealer: true })).score, 2900);
  const t = ok(run('234m234567p789s55s', '4p', { riichi: 1, tsumo: true, dealer: true }));
  assert.deepEqual([t.payments, t.score], [[{ from: 'child', amount: 1300, count: 3 }], 3900]);
});
test('本場・供託', () => {
  const r = ok(run('234m234567p789s55s', '4p', { riichi: 1, honba: 2, kyotaku: 1 }));
  assert.deepEqual([r.payments[0].amount, r.score], [2600, 3600]);
  const t = ok(run('234m234567p789s55s', '4p', { riichi: 1, tsumo: true, honba: 2, kyotaku: 1 }));
  assert.deepEqual([t.payments.map((p) => p.amount), t.score], [[1500, 900], 4300]);
});
test('ドラ/裏ドラ/赤ドラ と 満貫・跳満・倍満・三倍満・数え役満', () => {
  const h = '234m234567p678s05s';
  const cases: [string, string, string, number, number][] = [
    ['4s', '', '跳満', 6, 12000], ['444s', '', '倍満', 10, 16000],
    ['444s', '1m', '三倍満', 11, 24000], ['444s', '111m', '数え役満', 13, 32000]];
  for (const [d, u, lim, th, sc] of cases) {
    const r = ok(run(h, '7p', { riichi: 1, dora: d, ura: u }));
    assert.deepEqual([r.limit, r.totalHan, r.score, r.akaDora], [lim, th, sc, 1]);
  }
  const m = ok(run('234m234567p678s55s', '7p', { riichi: 1, dora: '4s' }));
  assert.deepEqual([m.dora, m.yakuHan, m.limit, m.score], [2, 3, '満貫', 8000]);
  assert.equal(ok(run('234m234567p678s55s', '7p', { riichi: 1, dora: '1p', ura: '1m' })).uraDora, 1);
});
test('切り上げ満貫 (4飜30符 7700→8000)', () => {
  assert.equal(ok(run('234m234567p678s05s', '7p', { riichi: 1 })).score, 7700);
  const r = ok(run('234m234567p678s05s', '7p', { riichi: 1 }, [], { ...base, kiriage: true }));
  assert.deepEqual([r.limit, r.score], ['満貫', 8000]);
});
test('七対子: 4枚使いは不可', () => assert.equal(run('1111m2233m4455p66s', '6s').ok, false));

// ---- 異常系 ----
test('役なし(副露・ドラありでも)', () => {
  const r = run('456p789s234p55s', '5s', { dora: '4s' }, [M('chi', '1m')]);
  assert.equal(r.ok, false);
});
test('不正な手牌/鳴き/フラグ', () => {
  assert.throws(() => run('234m234567p789s55s', '9z'));
  assert.equal(run('234m234567p789s55s', '1z').ok, false);
  assert.equal(run('234m234567p789s55s', '4p', { riichi: 1 }, [M('chi', '1m')]).ok, false);
  assert.equal(run('234p567p789s55s', '4p', {}, [{ type: 'chi', tile: 27 }]).ok, false);
  assert.equal(run('234m234567p789s55s', '4p', { rinshan: true }).ok, false);
  assert.equal(run('234m234567p789s55s', '4p', { chankan: true, tsumo: true }).ok, false);
  assert.equal(run('234m234567p789s55s', '4p', { ippatsu: true }).ok, false);
  assert.throws(() => parse('8z'));
  assert.throws(() => parse('12'));
});
