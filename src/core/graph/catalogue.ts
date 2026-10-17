export interface IndicatorParam {
  name: string;
  defaultValue: unknown;
  typeName: string;
  min: number | null;
  max: number | null;
  step: number | null;
}

export interface IndicatorEntry {
  kind: string;
  family: string;
  inputs: string[];
  outputs: string[];
  params: IndicatorParam[];
  summary: string;
}

const FAMILIES = [
  'moving_average',
  'trend',
  'momentum',
  'volatility',
  'volume',
  'support_resistance',
  'breadth',
  'statistical',
] as const;

function rangeFor(defaultValue: unknown): { min: number | null; max: number | null; step: number | null } {
  if (typeof defaultValue === 'boolean') return { min: null, max: null, step: null };
  if (typeof defaultValue === 'number' && Number.isInteger(defaultValue)) {
    if (defaultValue <= 0) return { min: null, max: null, step: null };
    return { min: 1, max: Math.max(defaultValue * 3, defaultValue + 1), step: 1 };
  }
  if (typeof defaultValue === 'number') {
    const hi = defaultValue > 0 ? defaultValue * 3 : 1.0;
    const step = defaultValue > 0 ? Number((defaultValue / 10).toFixed(6)) || 1.0 : 1.0;
    return { min: 0.0, max: hi, step };
  }
  return { min: null, max: null, step: null };
}

const RAW: Record<string, { family: string; inputs: string[]; outputs: string[]; params: Array<[string, unknown]> }> = {
  sma: { family: 'moving_average', inputs: ['close'], outputs: ['value'], params: [['period', 5]] },
  ema: { family: 'moving_average', inputs: ['close'], outputs: ['value'], params: [['period', 5]] },
  rma: { family: 'moving_average', inputs: ['close'], outputs: ['value'], params: [['period', 14]] },
  wma: { family: 'moving_average', inputs: ['close'], outputs: ['value'], params: [['period', 5]] },
  rsi: { family: 'momentum', inputs: ['close'], outputs: ['value'], params: [['period', 14]] },
  atr: { family: 'volatility', inputs: ['high', 'low'], outputs: ['value'], params: [['period', 14]] },
  macd: { family: 'trend', inputs: ['close'], outputs: ['macd', 'signal', 'histogram'], params: [['fast', 12], ['slow', 26], ['signal', 9]] },
  bollinger: { family: 'volatility', inputs: ['close'], outputs: ['upper', 'middle', 'lower'], params: [['length', 20], ['std', 2.0]] },
  donchian: { family: 'volatility', inputs: ['high', 'low'], outputs: ['upper', 'lower'], params: [['period', 20]] },
};

function build(): IndicatorEntry[] {
  return Object.entries(RAW).map(([kind, spec]) => ({
    kind,
    family: spec.family,
    inputs: [...spec.inputs],
    outputs: [...spec.outputs],
    summary: `${kind} (${spec.family})`,
    params: spec.params.map(([name, defaultValue]) => ({
      name,
      defaultValue,
      typeName: typeof defaultValue === 'number' ? (Number.isInteger(defaultValue) ? 'int' : 'float') : 'str',
      ...rangeFor(defaultValue),
    })),
  }));
}

export interface NodeCatalogue {
  families: string[];
  indicators: IndicatorEntry[];
}

let cached: NodeCatalogue | null = null;

export function catalogue(): NodeCatalogue {
  if (!cached) cached = { families: [...FAMILIES], indicators: build() };
  return cached;
}

/** Look up a single indicator entry by its `kind` (e.g. `sma`, `rsi`). */
export function cataloguelookup(kind: string): IndicatorEntry | undefined {
  return catalogue().indicators.find((entry) => entry.kind === kind);
}
