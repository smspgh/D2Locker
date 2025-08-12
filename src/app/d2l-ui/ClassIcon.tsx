import { AppIcon, globeIcon, hunterIcon, titanIcon, warlockIcon } from 'app/shell/icons';
import d2lHunterProportionalIcon from 'app/shell/icons/custom/HunterProportional';
import d2lTitanProportionalIcon from 'app/shell/icons/custom/TitanProportional';
import d2lWarlockProportionalIcon from 'app/shell/icons/custom/WarlockProportional';
import { DestinyClass } from 'bungie-api-ts/destiny2';

const classIcons = {
  [DestinyClass.Hunter]: hunterIcon,
  [DestinyClass.Titan]: titanIcon,
  [DestinyClass.Warlock]: warlockIcon,
  [DestinyClass.Unknown]: globeIcon,
  [DestinyClass.Classified]: globeIcon,
} as const;

const classIconsProportional = {
  [DestinyClass.Hunter]: d2lHunterProportionalIcon,
  [DestinyClass.Titan]: d2lTitanProportionalIcon,
  [DestinyClass.Warlock]: d2lWarlockProportionalIcon,
  [DestinyClass.Unknown]: globeIcon,
  [DestinyClass.Classified]: globeIcon,
} as const;

/**
 * Displays a class icon given a class type.
 */
export default function ClassIcon({
  classType,
  proportional,
  className,
}: {
  classType: DestinyClass;
  proportional?: boolean;
  className?: string;
}) {
  return (
    <AppIcon
      icon={(proportional ? classIconsProportional : classIcons)[classType]}
      className={className}
    />
  );
}
