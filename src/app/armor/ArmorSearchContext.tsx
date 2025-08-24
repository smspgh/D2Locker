import { DimItem } from 'app/inventory/item-types';
import { createContext, ReactNode, use, useMemo } from 'react';

interface ArmorSearchContextType {
  filteredArmor: DimItem[];
  allArmor: DimItem[];
}

const ArmorSearchContext = createContext<ArmorSearchContextType | undefined>(undefined);

export function ArmorSearchProvider({
  filteredArmor,
  allArmor,
  children,
}: {
  filteredArmor: DimItem[];
  allArmor: DimItem[];
  children: ReactNode;
}) {
  const contextValue = useMemo(() => ({ filteredArmor, allArmor }), [filteredArmor, allArmor]);

  return <ArmorSearchContext value={contextValue}>{children}</ArmorSearchContext>;
}

export function useArmorSearch() {
  const context = use(ArmorSearchContext);
  if (!context) {
    throw new Error('useArmorSearch must be used within ArmorSearchProvider');
  }
  return context;
}

export function useOptionalArmorSearch() {
  return use(ArmorSearchContext);
}
