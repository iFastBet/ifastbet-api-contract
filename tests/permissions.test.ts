import {test, expect} from 'bun:test';
import {contract} from '../src/index.js';

test('typed permission catalogue is closed, acyclic and never grants an upper level', () => {
  const types = ['root','dealer','agent','hall'];
  const byKey = new Map(contract.permissions.map(p => [p.key,p]));
  expect(byKey.size).toBe(contract.permissions.length);
  for (const p of contract.permissions) {
    if (p.target_type) for (const actor of p.applies_to) expect(types.indexOf(actor)).toBeLessThanOrEqual(types.indexOf(p.target_type));
    const walk = (key, path = []) => {
      expect(path).not.toContain(key);
      const value = byKey.get(key);
      expect(value).toBeDefined();
      expect(value.target_type === p.target_type || value.key === 'structure.view').toBe(true);
      for (const dependency of value.requires) walk(dependency,[...path,key]);
    };
    walk(p.key);
  }
});
test('language, cashier work and administrative roles are independent', () => {
  const p = key => contract.permissions.find(p=>p.key===key);
  expect(p('hall.tv.language.manage').requires).toEqual([]);
  expect(p('hall.users.create').applies_to).not.toContain('hall');
  expect(p('cashier.bets.create').roles).toEqual(['cashier']);
  expect(p('agent.users.create').applies_to).toEqual(['root','dealer','agent']);
  expect(p('hall.credits.transfer').applies_to).not.toContain('hall');
  expect(p('games.settings.manage')).toBeUndefined();
});
