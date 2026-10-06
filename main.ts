import { calculateScore, parse, Meld, MeldType, Rule, Win } from './core';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const val = (id: string) => ($(id) as HTMLInputElement).value;
const chk = (id: string) => ($(id) as HTMLInputElement).checked;
const names = ['m', 'p', 's', 'z'];
const pal = $('pal');
for (const [si, s] of names.entries()) for (let n = 1; n <= (si === 3 ? 7 : 9); n++) {
  const b = document.createElement('button'); b.textContent = `${n}${s}`;
  b.onclick = () => { const f = document.activeElement as HTMLInputElement; const t = f?.dataset?.tile ? f : $<HTMLInputElement>('hand'); t.value += b.textContent; };
  pal.appendChild(b);
}
$('go').onclick = () => {
  const out = $('out');
  try {
    const hp = parse(val('hand')); const melds: Meld[] = []; let aka = hp.aka;
    for (const tok of val('melds').split(/\s+/).filter(Boolean)) {
      const [type, t] = tok.split(':'); const p = parse(t); aka += p.aka;
      if (!['chi', 'pon', 'ankan', 'minkan', 'kakan'].includes(type)) throw new Error(`不正な鳴き種別: ${type}`);
      melds.push({ type: type as MeldType, tile: Math.min(...p.tiles) });
    }
    const rule: Rule = { kuitan: chk('kuitan'), kiriage: chk('kiriage'), uraDora: true };
    const w: Win = {
      tsumo: chk('tsumo'), dealer: chk('dealer'), roundWind: 27 + +val('rw'), seatWind: 27 + +val('sw'),
      riichi: +val('riichi') as 0 | 1 | 2, ippatsu: chk('ippatsu'), haitei: chk('haitei'), rinshan: chk('rinshan'),
      chankan: chk('chankan'), tenhou: false, chiihou: false, doraInd: parse(val('dora')).tiles, uraInd: parse(val('ura')).tiles,
      honba: +val('honba'), kyotaku: +val('kyotaku'),
    };
    const r = calculateScore({ closed: hp.tiles, melds, winTile: parse(val('win')).tiles[0], aka }, rule, w);
    if (!r.ok) { out.className = 'err'; out.textContent = r.error; return; }
    out.className = '';
    const pay = r.payments.map((p) => `${{ discarder: '放銃者', dealer: '親', child: '子' }[p.from]} ${p.amount}点${p.count > 1 ? ` ×${p.count}` : ''}`).join(' / ');
    out.innerHTML = `<h2>${r.limit.includes('役満') && r.totalHan === 0 ? r.limit : `${r.limit} ${r.totalHan}飜 ${r.fu}符`} = ${r.score}点</h2>
<p>役: ${r.yaku.map((y) => `${y.n}(${y.y ? '役満' : y.h + '飜'})`).join('、')}</p>
<p>ドラ ${r.dora} / 裏 ${r.uraDora} / 赤 ${r.akaDora}（役 ${r.yakuHan}飜）</p>
<p>符: ${r.fuBreakdown.map((f) => `${f.n} ${f.f}`).join(' + ') || '—'}　基本点 ${r.base}</p><p>支払い: ${pay}</p>`;
  } catch (e) { out.className = 'err'; out.textContent = (e as Error).message; }
};
