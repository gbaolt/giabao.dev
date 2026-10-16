export const GENERATE_GAPS = [
  'nest-trpc',
  'biome',
  'start-orpc',
] as const;

export type GenerateGapCode = (typeof GENERATE_GAPS)[number];

export class GenerateError extends Error {
  readonly code: GenerateGapCode;

  constructor(code: GenerateGapCode, message: string) {
    super(message);
    this.name = 'GenerateError';
    this.code = code;
  }
}
