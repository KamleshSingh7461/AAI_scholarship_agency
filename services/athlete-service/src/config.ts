import { loadConfig } from '@aci/nest-common';

export const config = loadConfig('athlete', {});
export type AthleteConfig = typeof config;
