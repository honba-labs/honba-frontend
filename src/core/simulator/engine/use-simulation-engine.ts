import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChartBar } from '../chart-data';
import type { StrategyGraphShape } from '../../graph/model';
import { ReplayController } from './replay-controller';
import { clearSandboxPortfolio } from './portfolio-adapter';
import type { SimulationEngineState } from './types';

export function useSimulationEngine(
  bars: readonly ChartBar[],
  strategy: StrategyGraphShape,
  symbol: string = 'TCS',
  exchange: string = 'NSE',
  initialCapital: number = 100_000,
  accountId: string = 'acc-sandbox-primary',
) {
  const controllerRef = useRef<ReplayController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = new ReplayController();
  }

  const controller = controllerRef.current;
  const [engineState, setEngineState] = useState<SimulationEngineState>(() => controller.getState());
  const [visibleBars, setVisibleBars] = useState<ChartBar[]>(() => [...bars]);

  // Set up callbacks
  useEffect(() => {
    controller.setCallbacks({
      onStateChange: (state) => setEngineState(state),
      onBarChange: (_barIndex, visible) => setVisibleBars(visible),
    });
  }, [controller]);

  const lastInitKey = useRef<string>('');
  const initKey = `${symbol}|${exchange}|${bars.length}|${bars[0]?.time ?? 0}|${bars[bars.length - 1]?.time ?? 0}|${initialCapital}|${accountId}`;

  // Initialize or re-initialize when underlying dataset or instrument actually changes
  useEffect(() => {
    if (bars.length > 0 && lastInitKey.current !== initKey) {
      lastInitKey.current = initKey;
      controller.init([...bars], strategy, symbol, exchange, initialCapital, accountId);
      setVisibleBars([...bars]);
    }
  }, [initKey, bars, strategy, symbol, exchange, initialCapital, accountId, controller]);

  const play = useCallback(() => controller.play(), [controller]);
  const pause = useCallback(() => controller.pause(), [controller]);
  const step = useCallback(() => controller.step(), [controller]);
  const reset = useCallback(() => {
    controller.reset();
  }, [controller]);
  const instant = useCallback(() => controller.instantRunToEnd(), [controller]);
  const setSpeed = useCallback((speed: number) => controller.setSpeed(speed), [controller]);
  const scrub = useCallback((index: number) => controller.jumpToBar(index), [controller]);
  const toggleMultiTimeframe = useCallback(() => {
    controller.setMultiTimeframe(!engineState.multiTimeframe, engineState.secondaryTimeframe);
  }, [controller, engineState.multiTimeframe, engineState.secondaryTimeframe]);
  const setSecondaryTimeframe = useCallback((tf: string) => {
    controller.setMultiTimeframe(true, tf);
  }, [controller]);
  const selectAccount = useCallback((accId: string) => {
    controller.setAccountId(accId);
  }, [controller]);

  const clearPortfolio = useCallback(() => {
    clearSandboxPortfolio(engineState.selectedAccountId);
    controller.reset();
  }, [controller, engineState.selectedAccountId]);

  return {
    engineState,
    visibleBars: engineState.status === 'idle' ? bars : visibleBars,
    play,
    pause,
    step,
    reset,
    instant,
    setSpeed,
    scrub,
    toggleMultiTimeframe,
    setSecondaryTimeframe,
    selectAccount,
    clearPortfolio,
  };
}
