# @lp-labs/semantic-version-advisor

Suggest a semantic-version increment by comparing two caller-supplied API descriptor snapshots.
This is a structural checklist, not a TypeScript parser or type checker. It has zero runtime or peer
dependencies.

## Install

```bash
npm install @lp-labs/semantic-version-advisor
```

## Quickstart

```js
import { adviseVersion } from '@lp-labs/semantic-version-advisor';

const before = {
  members: [
    {
      name: 'read',
      kind: 'function',
      parameters: [{ name: 'id', type: 'string' }],
      returns: 'Record',
    },
  ],
};
const after = {
  members: [
    {
      name: 'read',
      kind: 'function',
      parameters: [{ name: 'id', type: 'string' }],
      returns: 'Record',
    },
    {
      name: 'write',
      kind: 'function',
      parameters: [{ name: 'value', type: 'Record' }],
      returns: 'void',
    },
  ],
};
const report = adviseVersion(before, after);
if (report.recommendation !== 'minor')
  throw new Error('An added API member suggests a minor increment');
```

## Public API and types

- `adviseVersion(before, after, options?)` returns `CompatibilityReport`.
- `ApiDescriptor` is `{ members: readonly ApiMember[] }`. Each member has a unique bounded `name`
  and `kind`: `function`, `type`, or `constant`. Functions explicitly list `parameters` (name,
  opaque type label, optional flag) and a `returns` type label. Types/constants provide a
  `valueType` label.
- `AdvisorOptions` bounds `maxMembers` (default 1000, hard maximum 100000) and `maxParameters`
  (default 100, hard maximum 1000).
- `CompatibilityChange` contains a stable `code`, affected `member`, `breaking` boolean, and
  non-sensitive explanatory `detail`.
- `CompatibilityReport` contains `compatible`, `recommendation` (`patch`, `minor`, or `major`), and
  the ordered changes.

The runtime export is `adviseVersion`; `ApiMember`, `ApiDescriptor`, `CompatibilityChange`,
`CompatibilityReport`, and `AdvisorOptions` are type-only exports.

## Rules, customization, and scope

Removed members, changed kinds, changed exact type labels, changed return labels, required new
parameters, and parameters becoming required are treated as breaking (`major`). New members and
added optional parameters are non-breaking (`minor`). No reported changes means `patch`. Multiple
findings are returned; duplicate reports for a member are possible when several independently
breaking facets changed.

Callers decide how to construct and normalize descriptors. Type labels are compared as exact
strings; they are not parsed, resolved, or checked for TypeScript assignability. The advisor does
not inspect source, overloads, generics, declarations, runtime behavior, dependency versions, or
consumer usage, and it cannot guarantee real-world compatibility. Review its recommendation
against your own compatibility policy.

Malformed descriptors/members, duplicate names, and missing explicit labels throw `TypeError`.
Member/parameter and configured limits throw `RangeError`; limits must be positive safe integers.

## Support

If this library is useful to you, consider supporting its maintenance with a [donation via PayPal](https://www.paypal.me/LibinPrasanth).

## Author

Created by [Libin Prasanth](https://www.linkedin.com/in/libinprasanth/). Connect on LinkedIn for updates and discussion.
