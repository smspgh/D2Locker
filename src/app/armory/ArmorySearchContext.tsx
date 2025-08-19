import { DimItem } from 'app/inventory/item-types';
import React, { createContext, use, useMemo } from 'react';

interface ArmorySearchContextType {
  filteredWeapons: DimItem[];
  allWeapons: DimItem[];
}

const ArmorySearchContext = createContext<ArmorySearchContextType | undefined>(undefined);

export function ArmorySearchProvider({
  children,
  filteredWeapons,
  allWeapons,
}: {
  children: React.ReactNode;
  filteredWeapons: DimItem[];
  allWeapons: DimItem[];
}) {
  const value = useMemo(() => ({ filteredWeapons, allWeapons }), [filteredWeapons, allWeapons]);

  return <ArmorySearchContext value={value}>{children}</ArmorySearchContext>;
}

export function useArmorySearch() {
  const context = use(ArmorySearchContext);
  return context;
}
