import { calculateScore, MeldType, Result, Fail } from './core';
interface T { uid: number; id: number; aka: boolean }
interface M { type: MeldType; id: number; aka: number }
const SUIT = ['萬', '筒', '索'], HZ = ['東', '南', '西', '北', '白', '發', '中'];
const MN: Record<MeldType, string> = { chi: 'チー', pon: 'ポン', ankan: '暗槓', minkan: '大明槓', kakan: '加槓' };
const init = () => ({ hand: [] as T[], melds: [] as M[], dora: [] as number[], ura: [] as number[], win: -1, sel: -1, uid: 1, mode: 'hand', mtype: 'chi' as MeldType,
  maka: false, tsumo: false, rw: 0, sw: 1, riichi: 0, ippatsu: false, haitei: false, rinshan: false, chankan: false, honba: 0, kyotaku: 0, kuitan: true, kiriage: false });
type St = ReturnType<typeof init>;
let S: St = init(); let res: Result | Fail | null = null, stale = false, busy = false;
const hist: string[] = [];
const $ = (id: string) => document.getElementById(id) as HTMLElement;
const fmt = (n: number) => n.toLocaleString('ja-JP');
const tcls = (id: number) => (id < 27 ? `t${(id / 9) | 0}` : 't3');
const face = (id: number, aka = false) => `<b>${id < 27 ? (id % 9) + 1 : HZ[id - 27]}</b><i>${id < 27 ? (aka ? '赤' : '') + SUIT[(id / 9) | 0] : '&nbsp;'}</i>`;
const used = (s: St) => { const u = Array<number>(34).fill(0); s.hand.forEach((t) => u[t.id]++);
  s.melds.forEach((m) => { const n = m.type === 'chi' ? 0 : m.type === 'pon' ? 3 : 4; if (m.type === 'chi') [0, 1, 2].forEach((k) => u[m.id + k]++); else u[m.id] += n; }); return u; };
const cap = (s: St) => 14 - 3 * s.melds.length;
const winUid = (s: St) => (s.hand.some((t) => t.uid === s.win) ? s.win : Math.max(-1, ...s.hand.map((t) => t.uid)));
const snap = () => JSON.stringify(S);
function mut(f: () => void) { hist.push(snap()); if (hist.length > 60) hist.shift(); f(); if (res) stale = true; render(); }
const sortHand = () => S.hand.sort((a, b) => a.id - b.id || +a.aka - +b.aka || a.uid - b.uid);
const chip = (a: string, v: string, label: string, on = false, dis = false) =>
  `<button class="btn" data-a="${a}" data-v="${v}" aria-pressed="${on}" ${dis ? 'disabled' : ''}>${label}</button>`;
const tb = (a: string, v: string, id: number, aka: boolean, dis: boolean) => `<button class="tile ${tcls(id)} ${aka ? 'red' : ''}" data-a="${a}" data-v="${v}" aria-label="${aka ? '赤' : ''}${face(id).replace(/<[^>]+>/g, '')}" ${dis ? 'disabled' : ''}>${face(id, aka)}</button>`;
const mini = (ids: number[], aka = false) => `<span class="row g mini">${ids.map((id) => `<span class="tile ${tcls(id)} ${aka ? 'red' : ''}">${face(id, aka)}</span>`).join('')}</span>`;
const meldIds = (m: M) => (m.type === 'chi' ? [m.id, m.id + 1, m.id + 2] : Array<number>(m.type === 'pon' ? 3 : 4).fill(m.id));

function render() {
  const n = S.hand.length, c = cap(S), wu = winUid(S), u = used(S), diff = c - n;
  const stTxt = diff > 0 ? `あと${diff}枚入力` : diff < 0 ? `${-diff}枚多い（削除してください）` : '枚数OK ✓';
  $('hand').innerHTML = `<h2><span class="n">①</span>手牌 <span class="status ${diff === 0 ? 'good' : diff < 0 ? 'bad' : ''}">${n}/${c}枚 ${stTxt}</span></h2>
<div class="row g hand tiles ${diff < 0 ? 'err' : ''}">${n ? S.hand.map((t) => `<button class="tile ${tcls(t.id)} ${t.aka ? 'red' : ''} ${S.sel === t.uid ? 'sel' : ''} ${t.uid === wu ? 'win' : ''}" data-a="sel" data-v="${t.uid}" aria-pressed="${S.sel === t.uid}">${face(t.id, t.aka)}<span class="badge">${t.uid === wu ? '和了牌' : '&nbsp;'}</span></button>`).join('') : '<span class="empty">下の「② 牌を選ぶ」から牌をタップして入力</span>'}</div>
<p class="mu" style="margin:6px 0">${S.sel >= 0 ? '選んだ牌を操作：' : '牌をタップで選択（和了牌の指定・削除）。最後に入れた牌が和了牌になります。'}</p>
<div class="row">${chip('win', '', '和了牌にする', false, S.sel < 0)}${chip('del', '', '選んだ牌を削除', false, S.sel < 0)}${chip('undo', '', '↩ 元に戻す', false, !hist.length)}${chip('delLast', '', '1枚削除', false, !n)}${chip('clear', '', '手牌を全消去', false, !n && !S.melds.length)}${chip('reset', '', 'すべてリセット')}</div>
<h3>副露（鳴き）— 手牌とは別枠</h3><div class="row">${S.melds.length ? S.melds.map((m, i) => `<span class="meld"><b>${MN[m.type]}</b>${mini(meldIds(m))}<button class="btn" style="min-height:36px" data-a="delMeld" data-v="${i}" aria-label="${MN[m.type]}を削除">✕</button></span>`).join('') : '<span class="mu">なし（門前）</span>'}</div>`;
  const modes: [string, string][] = [['hand', '手牌'], ['meld', '鳴き'], ['dora', 'ドラ表示牌'], ['ura', '裏ドラ表示牌']];
  const mode = S.mode; const full = n >= c;
  const dis = (id: number) => mode === 'hand' ? full || u[id] >= 4 : mode === 'meld' ? !meldOk(id) : false;
  const meldOk = (id: number) => S.melds.length < 4 && (S.mtype === 'chi' ? id < 27 && id % 9 <= 6 && [0, 1, 2].every((k) => u[id + k] < 4) : S.mtype === 'pon' ? u[id] <= 1 : u[id] === 0);
  let rows = '';
  for (let s = 0; s < 3; s++) rows += `<div class="pal">${Array.from({ length: 9 }, (_, i) => tb('add', `${s * 9 + i}:0`, s * 9 + i, false, dis(s * 9 + i))).join('')}</div>`;
  rows += `<div class="pal" style="margin-top:4px">${Array.from({ length: 7 }, (_, i) => tb('add', `${27 + i}:0`, 27 + i, false, dis(27 + i))).join('')}</div>`;
  const redBtns = mode === 'hand' ? `<h3>赤5</h3><div class="pal">${[4, 13, 22].map((id) => tb('add', `${id}:1`, id, true, full || u[id] >= 4 || S.hand.some((t) => t.id === id && t.aka))).join('')}</div>` : '';
  const hint = { hand: '牌をタップして手牌に追加', meld: '鳴きの種類を選び、牌をタップ（チーは一番小さい牌）', dora: 'ドラ表示牌をタップ（最大5枚）', ura: '裏ドラ表示牌をタップ（立直時のみ有効・最大5枚）' }[mode];
  const ind = (k: 'dora' | 'ura') => S[k].length ? `<h3>${k === 'dora' ? 'ドラ表示牌' : '裏ドラ表示牌'}</h3><div class="row">${S[k].map((id, i) => `<button class="tile ${tcls(id)}" style="width:36px;height:50px" data-a="delInd" data-v="${k}:${i}" aria-label="削除">${face(id)}</button>`).join('')}<span class="mu" style="align-self:center">タップで削除</span></div>` : '';
  $('pal').innerHTML = `<h2><span class="n">②</span>牌を選ぶ</h2><div class="row">${modes.map(([k, l]) => chip('mode', k, l, mode === k)).join('')}</div><p class="mu" style="margin:6px 0">${hint}</p>
${mode === 'meld' ? `<div class="row" style="margin-bottom:6px">${(Object.keys(MN) as MeldType[]).map((k) => chip('mtype', k, MN[k], S.mtype === k)).join('')}${chip('maka', '', '赤5を含む', S.maka)}</div>` : ''}${rows}${redBtns}${ind('dora')}${ind('ura')}`;
  const r2 = (a: string, vals: [string, string][], cur: string, dsb = false) => `<div class="row">${vals.map(([v, l]) => chip(a, v, l, cur === v, dsb)).join('')}</div>`;
  const step = (k: string, v: number) => `<span class="step">${chip('step', `${k}:-1`, '−', false, v <= 0)}<span>${v}</span>${chip('step', `${k}:1`, '＋')}</span>`;
  $('cond').innerHTML = `<h2><span class="n">③</span>和了条件</h2>
<h3>和了方法</h3>${r2('tsumo', [['0', 'ロン'], ['1', 'ツモ']], S.tsumo ? '1' : '0')}
<h3>自風（東＝親）</h3>${r2('sw', [['0', '東(親)'], ['1', '南'], ['2', '西'], ['3', '北']], String(S.sw))}
<h3>場風</h3>${r2('rw', [['0', '東場'], ['1', '南場']], String(S.rw))}
<h3>立直・状況役</h3><div class="row">${chip('riichi', S.riichi === 1 ? '0' : '1', 'リーチ', S.riichi === 1)}${chip('riichi', S.riichi === 2 ? '0' : '2', 'ダブルリーチ', S.riichi === 2)}${chip('flag', 'ippatsu', '一発', S.ippatsu, !S.riichi)}${chip('flag', 'haitei', S.tsumo ? '海底' : '河底', S.haitei)}${chip('flag', 'rinshan', '嶺上開花', S.rinshan, !S.tsumo)}${chip('flag', 'chankan', '槍槓', S.chankan, S.tsumo)}</div>
<h3>本場・供託(本)</h3><div class="row"><span class="step"><b>本場</b>${step('honba', S.honba)}</span><span class="step"><b>供託</b>${step('kyotaku', S.kyotaku)}</span></div>
<details><summary>ルール設定</summary><div class="row">${chip('rule', 'kuitan', '喰いタンあり', S.kuitan)}${chip('rule', 'kiriage', '切り上げ満貫', S.kiriage)}</div></details>`;
  $('calc').innerHTML = `<button class="primary" data-a="calc" ${n === 0 || busy ? 'disabled' : ''}>${busy ? '計算中…' : res && !stale ? '再計算する' : '計算する'}</button>${n === 0 ? '<p class="mu" style="margin:4px 0 0;text-align:center">まず手牌を入力してください</p>' : ''}`;
  renderRes();
}
const HINT: [RegExp, string][] = [[/^手牌は/, '手牌の枚数を指定枚数に合わせてください（牌の追加／削除。鳴きがある場合は手牌が3枚ずつ減ります）'],
  [/役がありません/, 'リーチ・ツモなどの条件を足すか、役のある手牌に変更してください（ドラだけでは和了できません）'], [/5枚以上/, '同じ牌は4枚までです。余分な牌を削除してください'],
  [/和了牌が/, '手牌の牌をタップして「和了牌にする」を押してください'], [/立直/, '鳴きがある手はリーチできません。リーチを外すか鳴きを削除してください'],
  [/不正なチー/, 'チーは数牌の「一番小さい牌」（7以下）を選んでください'], [/嶺上|槍槓|一発/, '和了条件の組み合わせを見直してください']];
function renderRes() {
  const el = $('res'); el.hidden = !res; if (!res) return;
  el.className = stale ? 'stale' : '';
  if (!res.ok) {
    const h = HINT.find(([re]) => re.test((res as Fail).error))?.[1] ?? '入力を見直してください';
    el.innerHTML = `<div class="box err" role="alert"><b>⚠ 計算できません</b><p style="margin:4px 0">${res.error}</p><p class="fix">💡 直し方：${h}</p></div>`; return;
  }
  const r = res, ym = r.totalHan === 0, big = r.limit !== '' && !ym && r.limit !== '満貫';
  const sum = r.fuBreakdown.reduce((a, f) => a + f.f, 0);
  const pl = r.payments.map((p) => p.from === 'discarder' ? `放銃者 <b>${fmt(p.amount)}点</b>` : `${p.from === 'dealer' ? '親' : '子'}${p.count > 1 ? `（各 ×${p.count}）` : ''} <b>${fmt(p.amount)}点</b>`);
  const ex = (t: string, v: string) => `<tr><td>${t}</td><td>${v}</td></tr>`;
  el.innerHTML = `<div class="score ${ym ? 'ym' : ''}"><span class="tag">${r.limit || '通常'}</span><div class="pts">${fmt(r.score)}<small>点</small></div>
<div>${ym ? '役満は飜・符の計算なし' : `${r.totalHan}飜${big ? '' : ` ${r.fu}符`}`}</div></div>
<h3>支払い</h3><table>${r.payments.map((_, i) => ex(['支払う人', ''][0] && pl[i].replace(/ <b>.*/, ''), pl[i].replace(/.* <b>/, '<b>'))).join('')}${S.honba ? ex('本場', `${S.honba}本場込み`) : ''}${S.kyotaku ? ex('供託', `+${fmt(S.kyotaku * 1000)}点`) : ''}<tr class="tot"><td>和了者の受取</td><td>${fmt(r.score)}点</td></tr></table>
<h3>${ym ? '役満' : '役と飜（なぜこの点数か）'}</h3><table>${r.yaku.map((y) => ex(y.n, y.y ? '役満' : `${y.h}飜`)).join('')}
${ym ? '' : [['ドラ', r.dora], ['裏ドラ', r.uraDora], ['赤ドラ', r.akaDora]].map(([k, v]) => (v ? ex(String(k), `${v}飜`) : '')).join('')}
${ym ? '' : `<tr class="tot"><td>合計（役${r.yakuHan}＋ドラ類${r.totalHan - r.yakuHan}）</td><td>${r.totalHan}飜</td></tr>`}</table>
${ym ? '' : `<p class="mu">${r.limit && r.limit !== '満貫' || r.base === 2000 ? `${r.limit}のため基本点 ${fmt(r.base)}` : `基本点 = ${r.fu}符 × 2^(${r.totalHan}+2) = ${fmt(r.base)}`}</p>
<details><summary>符の内訳（${r.fu}符）</summary><table>${r.fuBreakdown.map((f) => ex(f.n, `${f.f}符`)).join('')}<tr class="tot"><td>合計 ${sum} → 10符単位に切り上げ</td><td>${r.fu}符</td></tr></table></details>`}`;
}
function act(a: string, v: string) {
  const [k, x] = v.split(':');
  switch (a) {
    case 'add': { const id = +k, aka = x === '1';
      if (S.mode === 'hand') mut(() => { const t = { uid: S.uid++, id, aka }; S.hand.push(t); sortHand(); S.sel = -1; S.win = t.uid; });
      else if (S.mode === 'meld') mut(() => { const m: M = { type: S.mtype, id, aka: S.maka && meldIds({ type: S.mtype, id, aka: 0 }).some((q) => q < 27 && q % 9 === 4) ? 1 : 0 }; S.melds.push(m); S.maka = false; });
      else { const l = S.mode === 'dora' ? S.dora : S.ura; if (l.length < 5) mut(() => { l.push(id); }); } break; }
    case 'sel': S.sel = S.sel === +k ? -1 : +k; render(); break;
    case 'win': mut(() => { S.win = S.sel; S.sel = -1; }); break;
    case 'del': mut(() => { S.hand = S.hand.filter((t) => t.uid !== S.sel); S.sel = -1; }); break;
    case 'delLast': mut(() => { const mx = Math.max(...S.hand.map((t) => t.uid)); S.hand = S.hand.filter((t) => t.uid !== mx); S.sel = -1; }); break;
    case 'clear': mut(() => { S.hand = []; S.melds = []; S.sel = -1; S.win = -1; }); break;
    case 'reset': mut(() => { const u = S.uid; S = init(); S.uid = u; res = null; stale = false; }); break;
    case 'undo': { const p = hist.pop(); if (p) { S = JSON.parse(p); if (res) stale = true; render(); } break; }
    case 'delMeld': mut(() => { S.melds.splice(+k, 1); }); break;
    case 'delInd': mut(() => { S[k as 'dora' | 'ura'].splice(+x, 1); }); break;
    case 'mode': S.mode = k; render(); break;
    case 'mtype': S.mtype = k as MeldType; render(); break;
    case 'maka': S.maka = !S.maka; render(); break;
    case 'tsumo': mut(() => { S.tsumo = k === '1'; if (S.tsumo) S.chankan = false; else S.rinshan = false; }); break;
    case 'sw': mut(() => { S.sw = +k; }); break;
    case 'rw': mut(() => { S.rw = +k; }); break;
    case 'riichi': mut(() => { S.riichi = +k; if (!S.riichi) S.ippatsu = false; }); break;
    case 'flag': mut(() => { const f = k as 'ippatsu' | 'haitei' | 'rinshan' | 'chankan'; S[f] = !S[f]; }); break;
    case 'step': mut(() => { const f = k as 'honba' | 'kyotaku'; S[f] = Math.max(0, S[f] + +x); }); break;
    case 'rule': mut(() => { const f = k as 'kuitan' | 'kiriage'; S[f] = !S[f]; }); break;
    case 'calc': busy = true; render(); setTimeout(calc, 120); break;
  }
}
function calc() {
  const wu = winUid(S), wt = S.hand.find((t) => t.uid === wu);
  const aka = S.hand.filter((t) => t.aka).length + S.melds.reduce((a, m) => a + m.aka, 0);
  const r = calculateScore({ closed: S.hand.map((t) => t.id), melds: S.melds.map((m) => ({ type: m.type, tile: m.id })), winTile: wt ? wt.id : -1, aka },
    { kuitan: S.kuitan, kiriage: S.kiriage, uraDora: true },
    { tsumo: S.tsumo, dealer: S.sw === 0, roundWind: 27 + S.rw, seatWind: 27 + S.sw, riichi: S.riichi as 0 | 1 | 2, ippatsu: S.ippatsu, haitei: S.haitei,
      rinshan: S.rinshan, chankan: S.chankan, tenhou: false, chiihou: false, doraInd: S.dora, uraInd: S.ura, honba: S.honba, kyotaku: S.kyotaku });
  res = r; stale = false; busy = false; render(); $('res').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
document.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null; if (b && !(b as HTMLButtonElement).disabled) act(b.dataset.a!, b.dataset.v ?? ''); });
render();
