import { t } from 'app/i18next-t';
import { AppIcon, faIcon } from 'app/shell/icons';
import { querySelector } from 'app/shell/selectors';
import { useSetSetting } from 'app/settings/hooks';
import Switch from 'app/d2l-ui/form/Switch';
import { faFlag } from '@fortawesome/free-solid-svg-icons';
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
      setSearchQuery(newQuery);
    } else {
      // Add the filter
      const newQuery = query ? `${query} is:newgear` : 'is:newgear';
      setSearchQuery(newQuery);
    }
  };

  return (
    <div className={styles.container}>
      <Switch
        checked={isNewGearEnabled}
        onChange={handleToggleNewGear}
        label={
          <>
            <AppIcon icon={faIcon(faFlag)} />
            {t('LoadoutBuilder.LimitToNewGear')}
          </>
        }
      />
    </div>
  );
});

export default NewFeaturedGearFilter;