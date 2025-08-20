import { ReactElement, ReactNode, cloneElement } from 'react';

/** places a divider between each element of arr */
export function addDividers<T extends React.ReactNode>(
  arr: T[],
  divider: ReactElement,
): ReactNode[] {
  return arr.flatMap((e, i) => [
    // eslint-disable-next-line @eslint-react/no-clone-element, @eslint-react/no-array-index-key
    i ? cloneElement(divider, { key: `divider-position-${i}` }) : null,
    e,
  ]);
}
