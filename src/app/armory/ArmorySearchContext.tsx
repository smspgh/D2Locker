import { DimItem } from 'app/inventory/item-types';
import React, { createContext, use } from 'react';

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
  return (
    <ArmorySearchContext value={{ filteredWeapons, allWeapons }}>{children}</ArmorySearchContext>
  );
}

export function useArmorySearch() {
  const context = use(ArmorySearchContext);
  return context;
}
