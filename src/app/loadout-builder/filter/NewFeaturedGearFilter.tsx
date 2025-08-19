import { faFlag } from '@fortawesome/free-solid-svg-icons';
import Switch from 'app/d2l-ui/Switch';
import { t } from 'app/i18next-t';
import { useSetSetting } from 'app/settings/hooks';
import { AppIcon } from 'app/shell/icons';
import { querySelector } from 'app/shell/selectors';
import { memo } from 'react';
import { useSelector } from 'react-redux';
import styles from './NewFeaturedGearFilter.m.scss';

const NewFeaturedGearFilter = memo(function NewFeaturedGearFilter() {
  const query = useSelector(querySelector);
  const [, setSearchQuery] = useSetSetting('searchQuery');

  const isNewGearEnabled = query.includes('is:newgear') || query.includes('is:featured');

  const handleToggleNewGear = () => {
    if (isNewGearEnabled) {
      // Remove the filter
      const newQuery = query
        .replace(/\s*is:newgear\s*/g, ' ')
        .replace(/\s*is:featured\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      (setSearchQuery as (value: string) => void)(newQuery);
    } else {
      // Add the filter
      const newQuery = query ? `${query} is:newgear` : 'is:newgear';
      (setSearchQuery as (value: string) => void)(newQuery);
    }
  };

  return (
    <div className={styles.container}>
      <Switch checked={isNewGearEnabled} onChange={handleToggleNewGear} name="newGearFilter" />
      <label htmlFor="newGearFilter">
        <AppIcon icon={faFlag as import('@fortawesome/fontawesome-svg-core').IconDefinition} />
        {t('LoadoutBuilder.LimitToNewGear')}
      </label>
    </div>
  );
});

export default NewFeaturedGearFilter;
