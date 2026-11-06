import assert from 'node:assert/strict';
import test from 'node:test';
import { adviseVersion } from '../dist/esm/index.js';

const fn = (name, parameters = [], returns = 'string') => ({
  name,
  kind: 'function',
  parameters,
  returns,
});

test('classifies additions, removals, descriptor edits, and no-op snapshots', () => {
  const before = { members: [fn('read', [{ name: 'id', type: 'string' }])] };
  const addition = adviseVersion(before, { members: [...before.members, fn('write')] });
  assert.equal(addition.compatible, true);
  assert.equal(addition.recommendation, 'minor');
  assert.deepEqual(
    addition.changes.map((change) => change.code),
    ['member-added'],
  );
  const breaking = adviseVersion(before, {
    members: [fn('read', [{ name: 'id', type: 'number' }], 'void')],
  });
  assert.equal(breaking.compatible, false);
  assert.equal(breaking.recommendation, 'major');
  assert.deepEqual(
    breaking.changes.map((change) => change.code),
    ['parameter-type-changed', 'return-type-changed'],
  );
  assert.deepEqual(adviseVersion(before, before), {
    compatible: true,
    recommendation: 'patch',
    changes: [],
  });
  assert.equal(
    adviseVersion({ members: [{ name: 'X', kind: 'type', valueType: 'A' }] }, { members: [] })
      .changes[0].code,
    'member-removed',
  );
});

test('recognizes required versus optional parameter changes and exact value labels', () => {
  const optionalBefore = { members: [fn('run')] };
  const optionalAfter = {
    members: [fn('run', [{ name: 'mode', type: 'string', optional: true }])],
  };
  assert.equal(adviseVersion(optionalBefore, optionalAfter).recommendation, 'minor');
  assert.equal(
    adviseVersion(
      { members: [fn('run', [{ name: 'mode', type: 'string', optional: true }])] },
      { members: [fn('run', [{ name: 'mode', type: 'string' }])] },
    ).changes[0].code,
    'parameter-required',
  );
  assert.equal(
    adviseVersion(
      { members: [{ name: 'Config', kind: 'type', valueType: '{a:string}' }] },
      { members: [{ name: 'Config', kind: 'type', valueType: '{a:number}' }] },
    ).changes[0].code,
    'value-type-changed',
  );
});

test('validates explicit descriptors and bounded input', () => {
  assert.throws(
    () => adviseVersion({ members: [] }, { members: [] }, { maxMembers: 0 }),
    RangeError,
  );
  assert.throws(
    () => adviseVersion({ members: [fn('x'), fn('x')] }, { members: [] }),
    /Duplicate API member/,
  );
  assert.throws(() => adviseVersion({ members: [fn('x', [], '')] }, { members: [] }), /returns/);
  assert.throws(
    () =>
      adviseVersion(
        { members: [fn('x', [{ name: 'v', type: 'string', optional: 'yes' }])] },
        { members: [] },
      ),
    /parameter descriptor/,
  );
  assert.throws(
    () => adviseVersion({ members: [] }, { members: [fn('x'), fn('y')] }, { maxMembers: 1 }),
    /member limit/,
  );
});
