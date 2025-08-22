import { bungieNetPath } from 'app/d2l-ui/BungieImage';
import { DestinyTooltipText } from 'app/d2l-ui/DestinyTooltipText';
import ElementIcon from 'app/d2l-ui/ElementIcon';
import RichDestinyText from 'app/d2l-ui/destiny-symbols/RichDestinyText';
import { t, tl } from 'app/i18next-t';
import { DefItemIcon } from 'app/inventory/ItemIcon';
import { createItemContextSelector, storesSelector } from 'app/inventory/selectors';
import { isTrialsPassage } from 'app/inventory/store/objectives';
import { applySocketOverrides, useSocketOverrides } from 'app/inventory/store/override-sockets';
import { getEvent, getSeason } from 'app/inventory/store/season';
import { getStore } from 'app/inventory/stores-helpers';
import {
  BestPerksButton,
  CompareActionButton,
  LockActionButton,
  TagActionButton,
} from 'app/item-actions/ActionButtons';
import { AmmoIcon } from 'app/item-popup/AmmoIcon';
import BreakerType from 'app/item-popup/BreakerType';
import { KillTrackerInfo } from 'app/item-popup/KillTracker';
import { useD2Definitions, useDefinitions } from 'app/manifest/selectors';
import { ActivityModifier } from 'app/progress/ActivityModifier';
import Objective from 'app/progress/Objective';
import { Reward } from 'app/progress/Reward';
import TraitComboIndicator from 'app/roll-appraiser/TraitComboIndicator';
import { useWeaponRankingData } from 'app/roll-appraiser/useRollAppraiserData';
import { useIsPhonePortrait } from 'app/shell/selectors';
import { RootState } from 'app/store/types';
import { getItemKillTrackerInfo, getItemYear, isD1Item, itemTypeName } from 'app/utils/item-utils';
import { SingleVendorSheetContext } from 'app/vendors/single-vendor/SingleVendorSheetContainer';
import clsx from 'clsx';
import { D2EventInfo } from 'data/d2/d2-event-info-v2';
import { BucketHashes, ItemCategoryHashes } from 'data/d2/generated-enums';
import helmetIcon from 'destiny-icons/armor_types/helmet.svg';
import modificationIcon from 'destiny-icons/general/modifications.svg';
import handCannonIcon from 'destiny-icons/weapons/hand_cannon.svg';
import { use } from 'react';
import { useSelector } from 'react-redux';
import BungieImage from '../d2l-ui/BungieImage';
import { DimItem } from '../inventory/item-types';
import { AppIcon, faCheck } from '../shell/icons';
import ApplyPerkSelection from './ApplyPerkSelection';
import EmblemPreview from './EmblemPreview';
import EnergyMeter from './EnergyMeter';
import ItemDescription from './ItemDescription';
import styles from './ItemDetails.m.scss';
import ItemExpiration from './ItemExpiration';
import ItemPerks from './ItemPerks';
import './ItemPopupBody.scss';
import ItemSockets from './ItemSockets';
import ItemStats from './ItemStats';
import ItemTalentGrid from './ItemTalentGrid';
import MetricCategories from './MetricCategories';
import { WeaponCatalystInfo } from './WeaponCatalystInfo';
import { WeaponCraftedInfo } from './WeaponCraftedInfo';
import { WeaponDeepsightInfo } from './WeaponDeepsightInfo';
import { ItemPopupExtraInfo } from './item-popup';

const defaultExtraInfo: ItemPopupExtraInfo = {};

// SeasonInfo component (copied from Armory)
function SeasonInfo({
  defs,
  item,
  className,
  seasonNum,
}: {
  item: DimItem;
  defs: ReturnType<typeof useD2Definitions>;
  className?: string;
  seasonNum: number;
}) {
  const season = Object.values(defs?.Season.getAll() ?? {}).find(
    (s) => s.seasonNumber === seasonNum,
  );
  const event = getEvent(item);
  return (
    season && (
      <div className={clsx(styles.season, className)}>
        {season.displayProperties?.hasIcon && (
          <BungieImage height={15} width={15} src={season.displayProperties?.icon} />
        )}{' '}
        {season.displayProperties?.name} (
        {t('Armory.Season', {
          season: season?.seasonNumber,
          year: getItemYear(item) ?? '?',
        })}
        ){Boolean(event) && ` - ${D2EventInfo[event!].name}`}
      </div>
    )
  );
}

// TODO: probably need to load manifest. We can take a lot of properties off the item if we just load the definition here.
export default function ItemDetails({
  item: originalItem,
  id,
  extraInfo = defaultExtraInfo,
  actionsModel,
}: {
  item: DimItem;
  id: string;
  extraInfo?: ItemPopupExtraInfo;
  actionsModel?: ReturnType<
    typeof import('app/item-popup/item-popup-actions').buildItemActionsModel
  >;
}) {
  const defs = useDefinitions()!;
  const d2Defs = useD2Definitions();
  const isPhonePortrait = useIsPhonePortrait();
  const itemCreationContext = useSelector(createItemContextSelector);
  const [socketOverrides, onPlugClicked, resetSocketOverrides] = useSocketOverrides();
  const item = defs.isDestiny2
    ? applySocketOverrides(itemCreationContext, originalItem, socketOverrides)
    : originalItem;
  const modTypeIcon = item.itemCategoryHashes.includes(ItemCategoryHashes.ArmorMods)
    ? helmetIcon
    : handCannonIcon;

  const ownerStore = useSelector((state: RootState) => getStore(storesSelector(state), item.owner));
  const weaponRankingData = useWeaponRankingData(item);

  const killTrackerInfo = getItemKillTrackerInfo(item);

  // Armory-style header data
  const itemDef = d2Defs?.InventoryItem.get(item.hash);
  const collectible =
    item.collectibleHash && d2Defs ? d2Defs.Collectible.get(item.collectibleHash) : undefined;
  const screenshot = itemDef?.screenshot;
  const seasonNum = getSeason(item);
  const flavorText = itemDef?.flavorText || itemDef?.displaySource;

  const showVendor = use(SingleVendorSheetContext);

  const missingSocketsMessage =
    item.missingSockets === 'missing'
      ? tl('MovePopup.MissingSockets')
      : tl('MovePopup.LoadingSockets');

  return (
    <div
      id={id}
      role="tabpanel"
      aria-labelledby={`${id}-tab`}
      className={clsx(styles.itemDetailsBody, {
        [styles.hasScreenshot]: screenshot && !isPhonePortrait,
      })}
      style={
        screenshot && !isPhonePortrait
          ? {
              backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.75) 0px, rgba(0,0,0,0) 200px), linear-gradient(180deg, rgba(0,0,0,0) 400px, rgba(11,12,15,0.9) 500px), url("${bungieNetPath(
                screenshot,
              )}")`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      {/* Armory-style header - only show on desktop */}
      {itemDef && d2Defs && !isPhonePortrait && (
        <div className={styles.armoryHeader}>
          <div className={styles.item}>
            <DefItemIcon itemDef={itemDef} />
          </div>
          <h1>{item.name}</h1>
          <div className={styles.headerContent}>
            <div className={styles.subtitle}>
              <ElementIcon element={item.element} className={styles.element} />
              <BreakerType item={item} />
              {item.destinyVersion === 2 && item.ammoType > 0 && <AmmoIcon type={item.ammoType} />}
              <div>{itemTypeName(item)}</div>
              {item.pursuit?.questLine && (
                <div>
                  {t('MovePopup.Subtitle.QuestProgress', {
                    questStepNum: item.pursuit.questLine.questStepNum,
                    questStepsTotal: item.pursuit.questLine.questStepsTotal ?? '?',
                  })}
                </div>
              )}
              {seasonNum >= 0 && <SeasonInfo defs={d2Defs} item={item} seasonNum={seasonNum} />}
            </div>
            <DestinyTooltipText item={item} />
            {item.classified && <div>{t('ItemService.Classified2')}</div>}
            {collectible?.sourceString && (
              <div className={styles.source}>{collectible?.sourceString}</div>
            )}
            {item.description && (
              <p>
                <RichDestinyText text={item.description} />
              </p>
            )}
            {flavorText && <p className={styles.flavor}>{flavorText}</p>}
          </div>
        </div>
      )}

      {/* Mobile: Show classification status after moving other info to static header */}
      {isPhonePortrait && item.classified && (
        <div className={styles.mobileDescriptionSection}>
          <div>{t('ItemService.Classified2')}</div>
        </div>
      )}

      {isPhonePortrait && screenshot && (
        <div className="item-details">
          <BungieImage width="100%" src={screenshot} />
        </div>
      )}

      {/* TODO: Add mobile actions below screenshot */}

      {item.itemCategoryHashes.includes(ItemCategoryHashes.Shaders) && (
        <BungieImage className={styles.itemShader} src={item.icon} width="96" height="96" />
      )}

      {(item.bucket.hash === BucketHashes.Quests ||
        item.itemCategoryHashes.includes(ItemCategoryHashes.Mods_Ornament)) &&
        item.secondaryIcon && (
          <BungieImage
            src={item.secondaryIcon}
            className={clsx(styles.fullImage, {
              [styles.milestoneImage]: item.bucket.hash === BucketHashes.Quests,
            })}
          />
        )}

      <ItemDescription item={item} />

      {!item.stats && Boolean(item.collectibleHash) && defs.isDestiny2 && (
        <div className={clsx('item-details', styles.itemSource)}>
          {defs.Collectible.get(item.collectibleHash!).sourceString}
        </div>
      )}

      {defs.isDestiny2 && item.itemCategoryHashes.includes(ItemCategoryHashes.Emblems) && (
        <div className="item-details">
          <EmblemPreview item={item} />
        </div>
      )}

      {defs.isDestiny2 && item.availableMetricCategoryNodeHashes && (
        <div className="item-details">
          <MetricCategories
            availableMetricCategoryNodeHashes={item.availableMetricCategoryNodeHashes}
          />
        </div>
      )}

      {defs.isDestiny2 && <WeaponCraftedInfo item={item} className="crafted-progress" />}

      {defs.isDestiny2 && <WeaponDeepsightInfo item={item} />}

      {defs.isDestiny2 && <WeaponCatalystInfo item={item} />}

      {/* Mobile action buttons above Enemies Defeated */}
      {isPhonePortrait && actionsModel && (
        <div className={styles.mobileItemActions}>
          <div className={styles.actionButtons}>
            {actionsModel?.taggable && (
              <TagActionButton item={item} label={false} hideKeys={true} />
            )}
            {actionsModel?.lockable && <LockActionButton item={item} label={false} />}
            {actionsModel?.comparable && <CompareActionButton item={item} label={false} />}
            <BestPerksButton item={item} label={false} onPlugClicked={onPlugClicked} />
          </div>
          {item.bucket?.inWeapons && weaponRankingData?.traitComboRanking && (
            <TraitComboIndicator comboData={weaponRankingData.traitComboRanking} />
          )}
        </div>
      )}

      {killTrackerInfo && defs.isDestiny2 && (
        <KillTrackerInfo tracker={killTrackerInfo} showTextLabel className="masterwork-progress" />
      )}

      {item.classified && <div className="item-details">{t('ItemService.Classified2')}</div>}

      {item.stats && (
        <div className="item-details">
          <ItemStats item={item} />
        </div>
      )}

      {isD1Item(item) && item.talentGrid && (
        <div className="item-details">
          <ItemTalentGrid item={item} />
        </div>
      )}

      {item.missingSockets && (
        <div className="item-details warning">{t(missingSocketsMessage)}</div>
      )}

      {defs.isDestiny2 && item.energy && defs && <EnergyMeter item={item} />}
      {item.sockets && <ItemSockets item={item} onPlugClicked={onPlugClicked} />}

      <ApplyPerkSelection
        item={item}
        setSocketOverride={onPlugClicked}
        onApplied={resetSocketOverrides}
      />

      {item.perks && <ItemPerks item={item} />}

      {defs && item.objectives && (
        <div className="item-details">
          {item.objectives.map((objective) => (
            <Objective
              objective={objective}
              key={objective.objectiveHash}
              isTrialsPassage={defs.isDestiny2 && isTrialsPassage(item.hash)}
            />
          ))}
        </div>
      )}

      {item.previewVendor !== undefined &&
        item.previewVendor !== 0 &&
        (extraInfo.characterId ?? (ownerStore && !ownerStore.isVault)) && (
          <div className={styles.itemDescription}>
            <a
              onClick={() =>
                showVendor?.({
                  characterId: extraInfo.characterId ?? ownerStore!.id,
                  vendorHash: item.previewVendor,
                })
              }
            >
              {t('ItemService.PreviewVendor', { type: item.typeName })}
            </a>
          </div>
        )}

      {defs.isDestiny2 && item.pursuit && item.pursuit.rewards.length !== 0 && (
        <div className="item-details">
          <div>{t('MovePopup.Rewards')}</div>
          {item.pursuit.rewards.map((reward) => (
            <Reward key={reward.itemHash} reward={reward} store={ownerStore} itemHash={item.hash} />
          ))}
        </div>
      )}

      {defs.isDestiny2 && item.pursuit && item.pursuit.modifierHashes.length !== 0 && (
        <div className="item-details">
          {item.pursuit.modifierHashes.map((modifierHash) => (
            <ActivityModifier key={modifierHash} modifierHash={modifierHash} />
          ))}
        </div>
      )}

      {extraInfo.mod ? (
        <div className={clsx('item-details', styles.mods)}>
          {extraInfo.owned && (
            <div>
              <img className={styles.ownedIcon} src={modificationIcon} /> {t('MovePopup.OwnedMod')}
            </div>
          )}
          {extraInfo.acquired && (
            <div>
              <img className={styles.acquiredIcon} src={modTypeIcon} /> {t('MovePopup.AcquiredMod')}
            </div>
          )}
        </div>
      ) : (
        (extraInfo.owned || extraInfo.acquired) && (
          <div className="item-details">
            {extraInfo.owned && (
              <div>
                <AppIcon className={styles.ownedIcon} icon={faCheck} /> {t('MovePopup.Owned')}
              </div>
            )}
            {extraInfo.acquired && (
              <div>
                <AppIcon className={styles.acquiredIcon} icon={faCheck} /> {t('MovePopup.Acquired')}
              </div>
            )}
          </div>
        )
      )}

      <ItemExpiration item={item} />
      <DestinyTooltipText item={item} />
    </div>
  );
}
