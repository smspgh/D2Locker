import { IconDefinition, IconName, IconPrefix } from '@fortawesome/fontawesome-svg-core';

export const makeCustomIcon = (
  name: string,
  width: number,
  height: number,
  pathData: string,
): IconDefinition => ({
  iconName: `d2l${name}` as unknown as IconName,
  prefix: 'd2l' as IconPrefix,
  icon: [width, height, [], '', pathData],
});
