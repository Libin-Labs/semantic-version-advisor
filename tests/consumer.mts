import {
  adviseVersion,
  type ApiDescriptor,
  type CompatibilityReport,
} from '@lp-labs/semantic-version-advisor';

const descriptor: ApiDescriptor = {
  members: [{ name: 'value', kind: 'type', valueType: 'string' }],
};
const report: CompatibilityReport = adviseVersion(descriptor, descriptor);
void report;
