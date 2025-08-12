import { DimItem } from 'app/inventory/item-types';
import React, { createContext, useContext } from 'react';

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
    <ArmorySearchContext.Provider value={{ filteredWeapons, allWeapons }}>
      {children}
    </ArmorySearchContext.Provider>
  );
}

export function useArmorySearch() {
  const context = useContext(ArmorySearchContext);
  return context;
}