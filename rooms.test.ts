import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomRepo, Store, Summary, dateName, cleanName, validState } from '../src/rooms.ts';
import { newPlayers } from '../src/table.ts';

const fake = (): Store & { m: Map<string, string>; fail: boolean } => {
  const m = new Map<string, string>(); const o = { m, fail: false,
    getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { if (o.fail) throw new Error('QuotaExceeded'); m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } };
  return o;
};
const sum = (n: string): Summary => ({ players: [{ name: n, seat: 0, points: 25000 }], rw: 0, honba: 0, kyotaku: 0, hands: 0 });

test('作成日の年月日が既定の記録名 / 空名は既定名 / 30字まで', () => {
  assert.equal(dateName(new Date(2026, 9, 7)), '2026年10月7日');
  const r = new RoomRepo(fake()); const now = new Date(2026, 0, 2, 3, 4).getTime();
  assert.equal(r.create('  ', '{}', sum('a'), now).name, '2026年1月2日');
  assert.equal(cleanName('あ'.repeat(40), 'x').length, 30);
});
test('各記録は固有ID・独立保存（保存/改名/削除が他へ影響しない）', () => {
  const r = new RoomRepo(fake()); const a = r.create('A', '{"x":"A1"}', sum('A'), 1), b = r.create('B', '{"x":"B1"}', sum('B'), 2);
  assert.notEqual(a.id, b.id);
  r.save(a.id, '{"x":"A2"}', sum('A2'), 5);
  assert.equal(r.load(a.id)!.raw, '{"x":"A2"}'); assert.equal(r.load(b.id)!.raw, '{"x":"B1"}');
  assert.equal(r.load(b.id)!.meta.summary.players[0].name, 'B'); assert.equal(r.load(b.id)!.meta.updatedAt, 2);
  r.rename(b.id, 'B改', 9); assert.deepEqual(r.list().map((m) => m.name), ['B改', 'A']);
  r.remove(a.id); assert.equal(r.load(a.id), null); assert.equal(r.list().length, 1); assert.equal(r.load(b.id)!.raw, '{"x":"B1"}');
});
test('一覧は最終更新の新しい順 / rev増加', () => {
  const r = new RoomRepo(fake()); const a = r.create('A', '{}', sum('A'), 1), b = r.create('B', '{}', sum('B'), 2);
  r.save(a.id, '{"v":1}', sum('A'), 10); assert.deepEqual(r.list().map((m) => m.name), ['A', 'B']); assert.equal(r.load(a.id)!.meta.rev, 2);
  assert.equal(r.load(b.id)!.meta.rev, 1);
});
test('複製は独立（コピーの変更が元に影響しない）', () => {
  const r = new RoomRepo(fake()); const a = r.create('A', '{"x":1}', sum('A'), 1); const c = r.duplicate(a.id, 3)!;
  assert.equal(c.name, 'Aのコピー'); assert.notEqual(c.id, a.id);
  r.save(c.id, '{"x":2}', sum('C'), 4); assert.equal(r.load(a.id)!.raw, '{"x":1}'); assert.equal(r.duplicate('none', 1), null);
});
test('壊れた一覧・欠損・容量超過でも既存データを壊さない', () => {
  const st = fake(); const r = new RoomRepo(st); const a = r.create('A', '{"x":1}', sum('A'), 1);
  st.m.set('mj.rooms.v1', '{broken'); assert.deepEqual(r.list(), []);
  st.m.set('mj.rooms.v1', JSON.stringify([{ id: 1 }, { ...a }])); assert.equal(r.list().length, 1);
  st.fail = true; assert.throws(() => r.save(a.id, '{"x":2}', sum('A'), 9)); assert.equal(r.load(a.id)!.raw, '{"x":1}');
  assert.throws(() => r.save('none', '{}', sum('x'), 1));
});
test('状態の検証: 正常/座席重複/人数違い/欠損', () => {
  const ok = { S: { players: newPlayers(), hand: [], melds: [], history: [] }, hist: [] };
  assert.equal(validState(ok), true);
  const dup = structuredClone(ok); dup.S.players[1].seat = 0; assert.equal(validState(dup), false);
  const three = structuredClone(ok); three.S.players.pop(); assert.equal(validState(three), false);
  assert.equal(validState(null), false); assert.equal(validState({ S: {}, hist: [] }), false); assert.equal(validState({ ...ok, hist: 1 }), false);
});
