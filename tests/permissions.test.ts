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
test('cashier work and administrative roles are independent; TV has no permission', () => {
  const p = key => contract.permissions.find(p=>p.key===key);
  expect(p('hall.tv.language.manage')).toBeUndefined();
  expect(p('hall.users.manage').applies_to).not.toContain('hall');
  expect(p('cashier.bets.create').roles).toEqual(['cashier']);
  expect(p('agent.users.create').applies_to).toEqual(['root','dealer','agent']);
  expect(p('hall.credits.transfer').applies_to).not.toContain('hall');
  expect(p('games.settings.manage')).toBeUndefined();
});

test('manager and cashier management each combine writes behind a separate view permission', () => {
  for (const family of ['users', 'cashiers']) {
    const permissions = contract.permissions.filter(p => p.target_type === 'hall' && p.action.startsWith(family + '.'));
    expect(permissions.map(p => p.action)).toEqual([`${family}.view`, `${family}.manage`]);
    expect(permissions[1].requires).toEqual([`hall.${family}.view`]);
  }
  const manager = contract.permissions.find(p => p.key === 'hall.users.manage');
  expect(manager.applies_to).toEqual(['root', 'dealer', 'agent']);
  expect(manager.relation).toBe('descendant');
});
