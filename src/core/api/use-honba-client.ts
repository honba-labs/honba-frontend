import { useMemo } from 'react';
import { HonbaClient } from './generated/client';

export const useHonbaClient = () => {
  return useMemo(() => new HonbaClient({}), []);
};
