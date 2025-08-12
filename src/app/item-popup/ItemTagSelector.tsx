import KeyHelp from 'app/d2l-ui/KeyHelp';
import Select, { Option } from 'app/d2l-ui/Select';
import { t, tl } from 'app/i18next-t';
import { setTag } from 'app/inventory/actions';
import { tagSelector } from 'app/inventory/selectors';
import { AppIcon, clearIcon } from 'app/shell/icons';
import { useThunkDispatch } from 'app/store/thunk-dispatch';
// import { compareBy } from 'app/utils/comparators';
import clsx from 'clsx';
import { useSelector } from 'react-redux';
import { TagInfo, TagValue, tagConfig } from '../inventory/d2l-item-info';
import { DimItem } from '../inventory/item-types';
import styles from './ItemTagSelector.m.scss';

interface Props {
  item: DimItem;
  className?: string;
  hideKeys?: boolean;
  hideButtonLabel?: boolean;
}

export default function ItemTagSelector({ item, className, hideKeys, hideButtonLabel }: Props) {
  const dispatch = useThunkDispatch();
  const rawTag = useSelector(tagSelector(item));
  
  // Ensure tag is valid - if it's not in our current tagConfig, treat as undefined
  const tag = rawTag && rawTag in tagConfig ? rawTag : undefined;

  const onChange = (tag?: TagValue) => dispatch(setTag(item, tag));

  // Create options based on whether item has a tag
  const dropdownOptions: Option<TagValue>[] = [];
  
  if (tag) {
    // If item has a tag, show Clear Tag option first
    dropdownOptions.push({
      key: 'clear',
      content: <TagOption tagOption={{
        type: undefined,
        label: tl('Tags.ClearTag'),
        icon: clearIcon,
        hotkey: 'shift+0',
        sortOrder: -1,
      }} hideKeys={hideKeys} />,
      value: undefined,
    });
  }
  
  // Always show Keep and Junk options
  dropdownOptions.push({
    key: 'keep',
    content: <TagOption tagOption={tagConfig.keep} hideKeys={hideKeys} />,
    value: 'keep',
  });
  
  dropdownOptions.push({
    key: 'junk',
    content: <TagOption tagOption={tagConfig.junk} hideKeys={hideKeys} />,
    value: 'junk',
  });

  // For items with no tag, we need to provide custom button content
  const buttonContent = tag ? undefined : (
    <div className={styles.item}>
      <div className={styles.null} />
      <span>{t('Tags.TagItem')}</span>
    </div>
  );

  return (
    <Select<TagValue>
      options={dropdownOptions}
      value={tag}
      onChange={onChange}
      hideSelected={true}
      className={clsx(className, styles.itemTagSelector, 'item-tag-selector', {
        [styles.minimized]: hideButtonLabel,
      })}
    >
      {buttonContent}
    </Select>
  );
}

function TagOption({ tagOption, hideKeys }: { tagOption: TagInfo; hideKeys?: boolean }) {
  return (
    <div className={styles.item}>
      {tagOption.icon ? <AppIcon icon={tagOption.icon} /> : <div className={styles.null} />}
      <span>{t(tagOption.label)}</span>
      {!hideKeys && tagOption.hotkey && (
        <KeyHelp combo={tagOption.hotkey} className={styles.keyHelp} />
      )}
    </div>
  );
}
