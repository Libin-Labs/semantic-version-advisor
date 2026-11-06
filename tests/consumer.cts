import { adviseVersion, type AdvisorOptions } from '@lp-labs/semantic-version-advisor';

const options: AdvisorOptions = { maxMembers: 10 };
const recommendation: 'patch' | 'minor' | 'major' = adviseVersion(
  { members: [] },
  { members: [] },
  options,
).recommendation;
void recommendation;
