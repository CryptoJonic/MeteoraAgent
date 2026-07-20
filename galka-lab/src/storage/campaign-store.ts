import type {
  CampaignConfig,
  CampaignResult,
  CampaignState,
  StoredReplayState,
} from '../core/types';

const ACTIVE_KEY = 'galka-lab:active-replay:v1';
const RESULTS_KEY = 'galka-lab:campaign-results:v1';
const CONFIGS_KEY = 'galka-lab:campaign-configs:v1';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function campaignResultFromState(state: CampaignState): CampaignResult {
  if (state.status !== 'COMPLETED' && state.status !== 'STOPPED') {
    throw new Error('Only a finalized campaign can be stored as a result.');
  }
  if (state.completedAt === null || state.finalUsdc === null || state.finalPnlUsdc === null) {
    throw new Error('Final campaign accounting is incomplete.');
  }
  return {
    id: state.config.id,
    symbol: state.config.symbol,
    status: state.status,
    startedAt: state.config.startTime,
    completedAt: state.completedAt,
    galkaPrice: state.config.galkaPrice,
    lowerPrice: state.config.lowerPrice,
    rangePct: state.config.rangePct,
    finalUsdc: state.finalUsdc,
    finalPnlUsdc: state.finalPnlUsdc,
    maxDrawdownUsdc: state.maxDrawdownUsdc,
    maxDrawdownPct: state.maxDrawdownPct,
    durationSeconds: Math.max(0, state.completedAt - state.config.startTime),
    lowestPrice: state.lowestPrice,
    deepestPoolReached: state.deepestPoolReached,
  };
}

export class CampaignStore {
  public loadActive(): StoredReplayState | null {
    return readJson<StoredReplayState | null>(ACTIVE_KEY, null);
  }

  public saveActive(state: StoredReplayState): void {
    writeJson(ACTIVE_KEY, state);
  }

  public clearActive(): void {
    localStorage.removeItem(ACTIVE_KEY);
  }

  public listResults(): CampaignResult[] {
    return readJson<CampaignResult[]>(RESULTS_KEY, []);
  }

  public addResult(result: CampaignResult): void {
    const results = this.listResults().filter((candidate) => candidate.id !== result.id);
    results.unshift(result);
    writeJson(RESULTS_KEY, results.slice(0, 500));
  }

  public listConfigs(): CampaignConfig[] {
    return readJson<CampaignConfig[]>(CONFIGS_KEY, []);
  }

  public saveConfig(config: CampaignConfig): void {
    const configs = this.listConfigs().filter((candidate) => candidate.id !== config.id);
    configs.unshift(config);
    writeJson(CONFIGS_KEY, configs.slice(0, 100));
  }
}
