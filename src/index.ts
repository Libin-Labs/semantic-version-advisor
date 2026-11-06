export type ApiMember = Readonly<{
  name: string;
  kind: 'function' | 'type' | 'constant';
  parameters?: readonly Readonly<{ name: string; type: string; optional?: boolean }>[];
  returns?: string;
  valueType?: string;
}>;

export type ApiDescriptor = Readonly<{ members: readonly ApiMember[] }>;
export type CompatibilityChange = Readonly<{
  code: string;
  member: string;
  breaking: boolean;
  detail: string;
}>;
export type CompatibilityReport = Readonly<{
  compatible: boolean;
  recommendation: 'patch' | 'minor' | 'major';
  changes: readonly CompatibilityChange[];
}>;
export type AdvisorOptions = Readonly<{ maxMembers?: number; maxParameters?: number }>;

const bounded = (value: number | undefined, fallback: number, key: string): number => {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 1) {
    throw new RangeError(`${key} must be a positive safe integer`);
  }
  if ((key === 'maxMembers' && result > 100_000) || (key === 'maxParameters' && result > 1000)) {
    throw new RangeError(`${key} exceeds its hard limit`);
  }
  return result;
};

function validate(
  descriptor: ApiDescriptor,
  limit: number,
  maxParameters: number,
): Map<string, ApiMember> {
  if (!descriptor || typeof descriptor !== 'object' || !Array.isArray(descriptor.members)) {
    throw new TypeError('descriptor.members must be an array');
  }
  if (descriptor.members.length > limit) throw new RangeError('API member limit exceeded');
  const members = new Map<string, ApiMember>();
  for (const member of descriptor.members) {
    if (
      !member ||
      typeof member !== 'object' ||
      typeof member.name !== 'string' ||
      member.name.length === 0 ||
      member.name.length > 256 ||
      !['function', 'type', 'constant'].includes(member.kind)
    ) {
      throw new TypeError('Each API member needs a bounded name and supported kind');
    }
    if (members.has(member.name)) throw new TypeError(`Duplicate API member: ${member.name}`);
    if (member.kind === 'function') {
      if (member.parameters !== undefined && !Array.isArray(member.parameters)) {
        throw new TypeError(`Parameters for ${member.name} must be an array`);
      }
      if ((member.parameters?.length ?? 0) > maxParameters)
        throw new RangeError(`Too many parameters for ${member.name}`);
      const parameterNames = new Set<string>();
      for (const parameter of member.parameters ?? []) {
        if (
          !parameter ||
          typeof parameter.name !== 'string' ||
          typeof parameter.type !== 'string' ||
          parameter.name.length === 0 ||
          parameter.name.length > 256 ||
          parameter.type.length === 0 ||
          parameter.type.length > 512 ||
          (parameter.optional !== undefined && typeof parameter.optional !== 'boolean')
        ) {
          throw new TypeError(`Invalid parameter descriptor for ${member.name}`);
        }
        if (parameterNames.has(parameter.name)) {
          throw new TypeError(`Duplicate parameter ${parameter.name} for ${member.name}`);
        }
        parameterNames.add(parameter.name);
      }
      if (
        typeof member.returns !== 'string' ||
        member.returns.length === 0 ||
        member.returns.length > 512
      ) {
        throw new TypeError(`Function ${member.name} requires an explicit returns descriptor`);
      }
    } else if (
      typeof member.valueType !== 'string' ||
      member.valueType.length === 0 ||
      member.valueType.length > 512
    ) {
      throw new TypeError(`Member ${member.name} requires an explicit valueType descriptor`);
    }
    members.set(member.name, member);
  }
  return members;
}

export function adviseVersion(
  before: ApiDescriptor,
  after: ApiDescriptor,
  options: AdvisorOptions = {},
): CompatibilityReport {
  if (!options || typeof options !== 'object') throw new TypeError('options must be an object');
  const maxMembers = bounded(options.maxMembers, 1000, 'maxMembers');
  const maxParameters = bounded(options.maxParameters, 100, 'maxParameters');
  const previous = validate(before, maxMembers, maxParameters);
  const current = validate(after, maxMembers, maxParameters);
  const changes: CompatibilityChange[] = [];
  const add = (code: string, member: string, breaking: boolean, detail: string): void => {
    changes.push(Object.freeze({ code, member, breaking, detail }));
  };

  for (const [name, oldMember] of previous) {
    const newMember = current.get(name);
    if (!newMember) {
      add('member-removed', name, true, 'An explicitly described API member was removed.');
      continue;
    }
    if (oldMember.kind !== newMember.kind) {
      add('kind-changed', name, true, 'The explicitly described member kind changed.');
      continue;
    }
    if (oldMember.kind === 'function' && newMember.kind === 'function') {
      const oldParams = oldMember.parameters ?? [];
      const newParams = newMember.parameters ?? [];
      for (let i = 0; i < Math.min(oldParams.length, newParams.length); i++) {
        if (oldParams[i]!.type !== newParams[i]!.type) {
          add(
            'parameter-type-changed',
            name,
            true,
            `Parameter ${i + 1} has a different type label.`,
          );
        }
        if (oldParams[i]!.optional && !newParams[i]!.optional) {
          add('parameter-required', name, true, `Parameter ${i + 1} is now required.`);
        }
      }
      if (newParams.slice(oldParams.length).some((parameter) => !parameter.optional)) {
        add('required-parameter-added', name, true, 'A required parameter was added.');
      }
      if (oldMember.returns !== newMember.returns) {
        add(
          'return-type-changed',
          name,
          true,
          'The explicitly described return type label changed.',
        );
      }
      if (
        newParams.length > oldParams.length &&
        !newParams.slice(oldParams.length).some((p) => !p.optional)
      ) {
        add('optional-parameter-added', name, false, 'Only optional parameters were added.');
      }
    } else if (
      oldMember.kind !== 'function' &&
      newMember.kind !== 'function' &&
      oldMember.valueType !== newMember.valueType
    ) {
      add('value-type-changed', name, true, 'The explicitly described value type label changed.');
    }
  }
  for (const name of current.keys()) {
    if (!previous.has(name))
      add('member-added', name, false, 'A new explicitly described member was added.');
  }
  const breaking = changes.some((change) => change.breaking);
  return Object.freeze({
    compatible: !breaking,
    recommendation: breaking ? 'major' : changes.length > 0 ? 'minor' : 'patch',
    changes: Object.freeze(changes),
  });
}
