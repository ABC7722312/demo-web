// 牌ID: 0-8 萬, 9-17 筒, 18-26 索, 27-30 東南西北, 31 白 32 發 33 中
export type MeldType = 'chi' | 'pon' | 'ankan' | 'minkan' | 'kakan';
export interface Meld { type: MeldType; tile: number } // tile: 順子は最小牌
export interface Hand { closed: number[]; melds: Meld[]; winTile: number; aka: number }
export interface Rule { kuitan: boolean; kiriage: boolean; uraDora: boolean; doubleYakuman?: boolean }
export interface Win {
  tsumo: boolean; dealer: boolean; roundWind: number; seatWind: number; riichi: 0 | 1 | 2;
  ippatsu: boolean; haitei: boolean; rinshan: boolean; chankan: boolean; tenhou: boolean; chiihou: boolean;
  doraInd: number[]; uraInd: number[]; honba: number; kyotaku: number;
}
export interface Y { n: string; h: number; y?: boolean; dbl?: boolean }
export interface Pay { from: 'discarder' | 'dealer' | 'child'; amount: number; count: number }
export interface Result {
  ok: true; yaku: Y[]; yakuHan: number; dora: number; uraDora: number; akaDora: number; totalHan: number;
  fu: number; fuBreakdown: { n: string; f: number }[]; base: number; limit: string; score: number; payments: Pay[];
}
export interface Fail { ok: false; error: string }

export function parse(s: string): { tiles: number[]; aka: number } {
  const tiles: number[] = []; let aka = 0; let buf: number[] = [];
  for (const ch of s.replace(/\s/g, '')) {
    if (/[0-9]/.test(ch)) { buf.push(+ch); continue; }
    const o = 'mpsz'.indexOf(ch);
    if (o < 0) throw new Error(`不正な文字: ${ch}`);
    for (const n of buf) {
      if (o === 3 && (n === 0 || n > 7)) throw new Error('字牌は1〜7z');
      if (n === 0) { aka++; tiles.push(o * 9 + 4); } else tiles.push(o * 9 + n - 1);
    }
    buf = [];
  }
  if (buf.length) throw new Error('末尾に種別(m/p/s/z)がありません');
  return { tiles, aka };
}

const isTerm = (t: number) => t >= 27 || t % 9 === 0 || t % 9 === 8;
const isDragon = (t: number) => t >= 31;
export function doraOf(ind: number): number {
  if (ind < 27) return ind - (ind % 9) + ((ind % 9) + 1) % 9;
  if (ind < 31) return 27 + ((ind - 27 + 1) % 4);
  return 31 + ((ind - 31 + 1) % 3);
}

interface G { k: 'seq' | 'tri' | 'kan'; t: number; open: boolean }
const has = (g: G, x: number) => (g.k === 'seq' ? x >= g.t && x <= g.t + 2 : g.t === x);
const gTerm = (g: G) => (g.k === 'seq' ? g.t % 9 === 0 || g.t % 9 === 6 : isTerm(g.t));

function sets(c: number[], need: number, acc: G[], out: G[][]): void {
  if (!need) { out.push(acc.slice()); return; }
  const i = c.findIndex((x) => x > 0);
  if (i < 0) return;
  if (c[i] >= 3) { c[i] -= 3; acc.push({ k: 'tri', t: i, open: false }); sets(c, need - 1, acc, out); acc.pop(); c[i] += 3; }
  if (i < 27 && i % 9 < 7 && c[i + 1] > 0 && c[i + 2] > 0) {
    c[i]--; c[i + 1]--; c[i + 2]--; acc.push({ k: 'seq', t: i, open: false });
    sets(c, need - 1, acc, out); acc.pop(); c[i]++; c[i + 1]++; c[i + 2]++;
  }
}

interface Ctx { gs: G[]; pair: number; std: boolean; tiles: number[]; menzen: boolean; w: Win; rule: Rule; win: number; winIdx: number; nm: number }
type YakuFn = (c: Ctx) => Y[];
const o = (c: Ctx, closed: number, open: number) => (c.menzen ? closed : open);
const seqs = (c: Ctx) => c.gs.filter((g) => g.k === 'seq');
const tris = (c: Ctx) => c.gs.filter((g) => g.k !== 'seq');
const suitsOf = (c: Ctx) => new Set(c.tiles.filter((t) => t < 27).map((t) => Math.floor(t / 9)));
const honors = (c: Ctx) => c.tiles.some((t) => t >= 27);

// 役の定義テーブル（1関数=1役群）。役満は y:true, h=倍数
export const YAKU: YakuFn[] = [
  (c) => (c.tiles.every((t) => t >= 27) ? [{ n: '字一色', h: 1, y: true }] : []),
  (c) => (c.std && tris(c).filter((g) => isDragon(g.t)).length === 3 ? [{ n: '大三元', h: 1, y: true }] : []),
  (c) => (c.std && c.menzen && tris(c).filter((g) => !g.open).length === 4
    ? [c.winIdx === -1 ? { n: '四暗刻単騎', h: 1, y: true, dbl: true } : { n: '四暗刻', h: 1, y: true }] : []),
  (c) => (c.tiles.every((t) => t < 27 && isTerm(t)) ? [{ n: '清老頭', h: 1, y: true }] : []),
  (c) => (c.tiles.every((t) => [19, 20, 21, 23, 25, 32].includes(t)) ? [{ n: '緑一色', h: 1, y: true }] : []),
  (c) => {
    if (!c.std) return [];
    const wn = tris(c).filter((g) => g.t >= 27 && g.t <= 30).length;
    const pw = c.pair >= 27 && c.pair <= 30;
    return wn === 4 ? [{ n: '大四喜', h: 1, y: true, dbl: true }] : wn === 3 && pw ? [{ n: '小四喜', h: 1, y: true }] : [];
  },
  (c) => {
    const k = c.gs.filter((g) => g.k === 'kan').length;
    return k === 4 ? [{ n: '四槓子', h: 1, y: true }] : k === 3 ? [{ n: '三槓子', h: 2 }] : [];
  },
  (c) => {
    if (!c.menzen || c.nm || suitsOf(c).size !== 1 || honors(c)) return [];
    const k = Array.from({ length: 9 }, (_, i) => c.tiles.filter((t) => t % 9 === i).length);
    const base = [3, 1, 1, 1, 1, 1, 1, 1, 3];
    if (!base.every((n, i) => k[i] >= n)) return [];
    const pure = k.every((n, i) => n - (i === c.win % 9 ? 1 : 0) === base[i]);
    return [{ n: pure ? '純正九蓮宝燈' : '九蓮宝燈', h: 1, y: true, dbl: pure }];
  },
  (c) => (c.tiles.every(isTerm) && (!c.std || !seqs(c).length) ? [{ n: '混老頭', h: 2 }] : []),
  (c) => (c.w.tenhou ? [{ n: '天和', h: 1, y: true }] : []),
  (c) => (c.w.chiihou ? [{ n: '地和', h: 1, y: true }] : []),
  (c) => (c.w.riichi === 2 ? [{ n: 'ダブル立直', h: 2 }] : c.w.riichi === 1 ? [{ n: '立直', h: 1 }] : []),
  (c) => (c.w.riichi && c.w.ippatsu ? [{ n: '一発', h: 1 }] : []),
  (c) => (c.menzen && c.w.tsumo ? [{ n: '門前清自摸和', h: 1 }] : []),
  (c) => (c.w.haitei ? [{ n: c.w.tsumo ? '海底摸月' : '河底撈魚', h: 1 }] : []),
  (c) => (c.w.rinshan ? [{ n: '嶺上開花', h: 1 }] : []),
  (c) => (c.w.chankan ? [{ n: '槍槓', h: 1 }] : []),
  (c) => (c.tiles.every((t) => !isTerm(t)) && (c.menzen || c.rule.kuitan) ? [{ n: '断么九', h: 1 }] : []),
  (c) => (c.std ? tris(c).filter((g) => isDragon(g.t) || g.t === c.w.seatWind || g.t === c.w.roundWind)
    .flatMap((g) => [g.t >= 31 ? 1 : 0, g.t === c.w.seatWind ? 1 : 0, g.t === c.w.roundWind ? 1 : 0].filter(Boolean)
      .map(() => ({ n: `役牌(${['東', '南', '西', '北', '白', '發', '中'][g.t - 27]})`, h: 1 }))) : []),
  (c) => {
    if (!c.std || !c.menzen) return [];
    const k = new Map<number, number>();
    seqs(c).forEach((g) => k.set(g.t, (k.get(g.t) ?? 0) + 1));
    const n = [...k.values()].reduce((a, v) => a + (v >= 2 ? Math.floor(v / 2) : 0), 0);
    return n >= 2 ? [{ n: '二盃口', h: 3 }] : n === 1 ? [{ n: '一盃口', h: 1 }] : [];
  },
  (c) => (c.std && !seqs(c).length ? [{ n: '対々和', h: 2 }] : []),
  (c) => (c.std && tris(c).filter((g) => !g.open).length === 3 ? [{ n: '三暗刻', h: 2 }] : []),
  (c) => {
    if (!c.std) return [];
    const r: Y[] = [];
    for (let n = 0; n < 7; n++) if ([0, 9, 18].every((b) => seqs(c).some((g) => g.t === b + n))) r.push({ n: '三色同順', h: o(c, 2, 1) });
    for (let n = 0; n < 9; n++) if ([0, 9, 18].every((b) => tris(c).some((g) => g.t === b + n))) r.push({ n: '三色同刻', h: 2 });
    for (const b of [0, 9, 18]) if ([0, 3, 6].every((d) => seqs(c).some((g) => g.t === b + d))) r.push({ n: '一気通貫', h: o(c, 2, 1) });
    return r;
  },
  (c) => {
    if (!c.std) return [];
    const all = (c.gs.every((g) => gTerm(g)) && isTerm(c.pair));
    if (!all) return [];
    if (!seqs(c).length) return [];
    return [honors(c) ? { n: '混全帯么九', h: o(c, 2, 1) } : { n: '純全帯么九', h: o(c, 3, 2) }];
  },
  (c) => {
    if (!c.std) return [];
    const d = tris(c).filter((g) => isDragon(g.t)).length;
    return d === 2 && isDragon(c.pair) ? [{ n: '小三元', h: 2 }] : [];
  },
  (c) => (suitsOf(c).size === 1 && c.tiles.some((t) => t >= 27) ? [{ n: '混一色', h: o(c, 3, 2) }]
    : suitsOf(c).size === 1 ? [{ n: '清一色', h: o(c, 6, 5) }] : []),
];

interface Cand { yaku: Y[]; fu: number; fuB: { n: string; f: number }[]; han: number; ym: number; tiles: number[] }

function fuOf(c: Ctx, winIdx: number, yaku: Y[]): { fu: number; b: { n: string; f: number }[] } {
  const w = c.w; const b: { n: string; f: number }[] = [{ n: '副底', f: 20 }];
  const g = c.gs; const w14 = winIdx;
  const yp = c.pair >= 31 || c.pair === w.seatWind || c.pair === w.roundWind;
  let ryan = false;
  const wtile = c.win;
  let wait = 0;
  if (w14 < 0) wait = 2;
  else if (g[w14].k === 'seq') {
    const t = g[w14].t;
    if (wtile === t + 1 || (wtile === t && t % 9 === 6) || (wtile === t + 2 && t % 9 === 0)) wait = 2;
    else ryan = true;
  }
  if (c.menzen && g.every((x) => x.k === 'seq') && !yp && ryan) {
    yaku.push({ n: '平和', h: 1 });
    return { fu: w.tsumo ? 20 : 30, b: [{ n: '平和', f: w.tsumo ? 20 : 30 }] };
  }
  if (c.menzen && !w.tsumo) b.push({ n: '門前ロン', f: 10 });
  if (w.tsumo) b.push({ n: 'ツモ', f: 2 });
  const pf = (c.pair >= 31 ? 2 : 0) + (c.pair === w.seatWind ? 2 : 0) + (c.pair === w.roundWind ? 2 : 0);
  if (pf) b.push({ n: '雀頭', f: pf });
  g.forEach((x) => {
    if (x.k === 'seq') return;
    const f = (x.open ? 2 : 4) * (isTerm(x.t) ? 2 : 1) * (x.k === 'kan' ? 4 : 1);
    b.push({ n: `${x.open ? '明' : '暗'}${x.k === 'kan' ? '槓' : '刻'}`, f });
  });
  if (wait) b.push({ n: '待ち', f: 2 });
  let fu = Math.ceil(b.reduce((a, x) => a + x.f, 0) / 10) * 10;
  if (fu === 20 && !w.tsumo) fu = 30;
  return { fu, b };
}

function evaluate(c0: Ctx, win: number, winIdx: number): Cand | null {
  const c: Ctx = { ...c0, win, winIdx };
  const all = YAKU.flatMap((f) => f(c));
  const ym = all.filter((y) => y.y).reduce((a, y) => a + y.h * (y.dbl && c.rule.doubleYakuman ? 2 : 1), 0);
  const yaku = ym ? all.filter((y) => y.y) : all;
  const { fu, b } = fuOf(c, winIdx, yaku);
  const han = yaku.reduce((a, y) => a + y.h, 0);
  if (ym) return { yaku: yaku.filter((y) => y.y), fu, fuB: b, han, ym, tiles: c.tiles };
  return { yaku, fu, fuB: b, han, ym, tiles: c.tiles };
}

const up100 = (x: number) => Math.ceil(x / 100) * 100;
function limitOf(han: number, fu: number, ym: number, rule: Rule): { base: number; limit: string } {
  if (ym) return { base: 8000 * ym, limit: ym > 1 ? `${ym}倍役満` : '役満' };
  let base = fu * 2 ** (han + 2);
  if (rule.kiriage && base === 1920) base = 2000;
  if (han >= 13) return { base: 8000, limit: '数え役満' };
  if (han >= 11) return { base: 6000, limit: '三倍満' };
  if (han >= 8) return { base: 4000, limit: '倍満' };
  if (han >= 6) return { base: 3000, limit: '跳満' };
  if (han >= 5 || base >= 2000) return { base: 2000, limit: '満貫' };
  return { base, limit: '' };
}

function payments(base: number, w: Win): { pay: Pay[]; total: number } {
  const h = w.honba;
  if (!w.tsumo) {
    const a = up100(base * (w.dealer ? 6 : 4)) + 300 * h;
    return { pay: [{ from: 'discarder', amount: a, count: 1 }], total: a };
  }
  if (w.dealer) {
    const a = up100(base * 2) + 100 * h;
    return { pay: [{ from: 'child', amount: a, count: 3 }], total: a * 3 };
  }
  const d = up100(base * 2) + 100 * h; const k = up100(base) + 100 * h;
  return { pay: [{ from: 'dealer', amount: d, count: 1 }, { from: 'child', amount: k, count: 2 }], total: d + 2 * k };
}

export function calculateScore(hand: Hand, rule: Rule, w: Win): Result | Fail {
  const fail = (error: string): Fail => ({ ok: false, error });
  const m = hand.melds;
  if (m.length > 4) return fail('鳴きは最大4つ');
  if (hand.closed.length !== 14 - 3 * m.length) return fail(`手牌は${14 - 3 * m.length}枚必要(現在${hand.closed.length}枚)`);
  if (!hand.closed.includes(hand.winTile)) return fail('和了牌が手牌に含まれていません');
  const meldTiles = m.flatMap((x) => (x.type === 'chi' ? [x.tile, x.tile + 1, x.tile + 2]
    : Array<number>(x.type === 'pon' ? 3 : 4).fill(x.tile)));
  for (const x of m) {
    if (x.type === 'chi' && (x.tile >= 27 || x.tile % 9 > 6)) return fail('不正なチー');
    if (x.tile < 0 || x.tile > 33) return fail('不正な牌');
  }
  const tiles = [...hand.closed, ...meldTiles];
  const cnt = Array<number>(34).fill(0);
  tiles.forEach((t) => cnt[t]++);
  if (cnt.some((n) => n > 4)) return fail('同一牌が5枚以上あります');
  const menzen = m.every((x) => x.type === 'ankan');
  if (w.riichi && !menzen) return fail('副露している手で立直はできません');
  if (w.rinshan && !w.tsumo) return fail('嶺上開花はツモ和了のみ');
  if (w.chankan && w.tsumo) return fail('槍槓はロン和了のみ');
  if (w.ippatsu && !w.riichi) return fail('一発は立直が必要');
  if ((w.tenhou && !(w.tsumo && w.dealer)) || (w.chiihou && !(w.tsumo && !w.dealer))) return fail('天和は親のツモ、地和は子のツモのみ');
  const kinds = hand.closed.length;
  const cc = Array<number>(34).fill(0);
  hand.closed.forEach((t) => cc[t]++);
  const cands: Cand[] = [];
  const base: Ctx = { gs: [], pair: -1, std: true, tiles, menzen, w, rule, win: hand.winTile, winIdx: -1, nm: m.length };
  const melded: G[] = m.map((x) => ({ k: x.type === 'chi' ? 'seq' : x.type === 'pon' ? 'tri' : 'kan', t: x.tile, open: x.type !== 'ankan' && x.type !== 'chi' ? true : x.type === 'chi' }));
  for (let p = 0; p < 34; p++) {
    if (cc[p] < 2) continue;
    cc[p] -= 2; const outs: G[][] = []; sets(cc, 4 - m.length, [], outs); cc[p] += 2;
    for (const o2 of outs) {
      const gs = [...melded, ...o2];
      const idxs = o2.map((g, i) => (has(g, hand.winTile) ? i + m.length : -1)).filter((i) => i >= 0);
      if (p === hand.winTile) idxs.push(-1);
      for (const wi of idxs) {
        const g2 = gs.map((g, i) => (i === wi && g.k === 'tri' && !w.tsumo ? { ...g, open: true } : g));
        const r = evaluate({ ...base, gs: g2, pair: p }, hand.winTile, wi);
        if (r) cands.push(r);
      }
    }
  }
  if (!m.length && kinds === 14) {
    const pairs = cc.filter((n) => n === 2).length;
    if (pairs === 7) {
      const r = evaluate({ ...base, gs: [], pair: -1, std: false }, hand.winTile, -1);
      if (r) { r.yaku.unshift({ n: '七対子', h: 2 }); r.han += 2; r.fu = 25; r.fuB = [{ n: '七対子', f: 25 }]; cands.push(r); }
    }
    const ko = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
    if (ko.every((t) => cc[t] >= 1) && cc.filter((_, i) => !ko.includes(i)).every((n) => n === 0)) {
      const t13 = cc[hand.winTile] === 2;
      cands.push({ yaku: [{ n: t13 ? '国士無双十三面待ち' : '国士無双', h: 1, y: true, dbl: t13 }], fu: 0, fuB: [], han: 0, ym: t13 && rule.doubleYakuman ? 2 : 1, tiles });
    }
  }
  const pool = cands.filter((r) => r.han > 0 || r.ym > 0);
  if (!pool.length) return fail('役がありません（ドラのみでは和了できません）');
  const doraT = w.doraInd.map(doraOf), uraT = w.riichi ? w.uraInd.map(doraOf) : [];
  const count = (ts: number[]) => ts.reduce((a, d) => a + cnt[d], 0);
  const dora = count(doraT), ura = rule.uraDora ? count(uraT) : 0;
  let best: Result | null = null;
  for (const r of pool) {
    const yakuman = r.ym > 0;
    const th = yakuman ? 0 : r.han + dora + ura + hand.aka;
    const { base: b, limit } = limitOf(th, r.fu, r.ym, rule);
    const { pay, total } = payments(b, w);
    const res: Result = {
      ok: true, yaku: r.yaku, yakuHan: yakuman ? 0 : r.han, dora: yakuman ? 0 : dora, uraDora: yakuman ? 0 : ura,
      akaDora: yakuman ? 0 : hand.aka, totalHan: th, fu: r.fu, fuBreakdown: r.fuB, base: b, limit, score: total + w.kyotaku * 1000, payments: pay,
    };
    if (!best || res.score > best.score || (res.score === best.score && res.totalHan > best.totalHan)) best = res;
  }
  return best as Result;
}
