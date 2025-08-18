/**
 * A simple item grid that manages its own item popup separate from the global popup. Useful for showing items within a sheet.
 */

import ItemPopup from 'app/item-popup/ItemPopup';
import React, { JSX, useCallback, useRef, useState } from 'react';
// import { useNavigate } from 'react-router';
import '../inventory-page/StoreBucket.scss';
import ConnectedInventoryItem from '../inventory/ConnectedInventoryItem';
import { DimItem } from '../inventory/item-types';
import ArmorySheet from './ArmorySheet';

export interface PopupState {
  item: DimItem;
  element: HTMLElement;
}

export default function ItemGrid({
  items,
  noLink,
  directToArmory,
}: {
  items: DimItem[];
  /** Don't allow opening Armory from the header link */
  noLink?: boolean;
  /** Go directly to Armory view instead of showing popup */
  directToArmory?: boolean;
}) {
  const [popup, setPopup] = useState<PopupState | undefined>();
  const [armoryItem, setArmoryItem] = useState<DimItem | undefined>();
  // const navigate = useNavigate();

  const handleDirectClick = useCallback((item: DimItem) => {
    setArmoryItem(item);
  }, []);

  return (
    <div className="sub-bucket">
      {items.map((i) => (
        <BasicItemTrigger
          item={i}
          key={i.index}
          onShowPopup={directToArmory ? undefined : setPopup}
          onDirectClick={directToArmory ? handleDirectClick : undefined}
        >
          {(ref, showPopup) => <ConnectedInventoryItem ref={ref} onClick={showPopup} item={i} />}
        </BasicItemTrigger>
      ))}
      {popup && (
        <ItemPopup
          onClose={() => setPopup(undefined)}
          item={popup.item}
          element={popup.element}
          noLink={noLink}
        />
      )}
      {armoryItem && <ArmorySheet item={armoryItem} onClose={() => setArmoryItem(undefined)} />}
    </div>
  );
}

export function BasicItemTrigger({
  item,
  onShowPopup,
  onDirectClick,
  children,
}: {
  item: DimItem;
  onShowPopup?: (state: PopupState) => void;
  onDirectClick?: (item: DimItem) => void;
  children: (
    ref: React.Ref<HTMLDivElement>,
    showPopup: (e: React.MouseEvent) => void,
  ) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const clicked = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onDirectClick) {
        onDirectClick(item);
      } else if (onShowPopup) {
        onShowPopup({ item, element: ref.current! });
      }
    },
    [item, onShowPopup, onDirectClick],
  );

  return children(ref, clicked) as JSX.Element;
}
