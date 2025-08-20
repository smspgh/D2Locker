import Sheet from 'app/d2l-ui/Sheet';
import UserGuideLink from 'app/d2l-ui/UserGuideLink';
import { t } from 'app/i18next-t';
import { editLoadout } from 'app/loadout-drawer/loadout-events';
import { AppIcon, refreshIcon } from 'app/shell/icons';
import { useIsPhonePortrait } from 'app/shell/selectors';
import { isiOSBrowser } from 'app/utils/browsers';
import { errorMessage } from 'app/utils/errors';
import { useEffect, useState } from 'react';
import styles from './LoadoutImportSheet.m.scss';
import { decodeShareUrl, getDecodedLoadout } from './loadout-import';

const placeHolder = `https://d2l.gg/bwipb2a/, https://app.destinyitemmanager.com/loadouts?loadout=...`;

export default function LoadoutImportSheet({
  currentStoreId,
  onClose,
}: {
  currentStoreId: string;
  onClose: () => void;
}) {
  const [shareUrl, setShareUrl] = useState<string>('');
  const [state, setState] = useState<'ok' | 'fetching' | string>('ok');
  const isPhonePortrait = useIsPhonePortrait();
  // On iOS at least, focusing the keyboard pushes the content off the screen
  const nativeAutoFocus = !isPhonePortrait && !isiOSBrowser();

  useEffect(() => {
    if (!shareUrl) {
      // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
      setState(() => 'ok');
      return;
    }
    const decodedUrl = decodeShareUrl(shareUrl);
    if (!decodedUrl) {
      // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
      setState(() => t('Loadouts.Import.BadURL'));
      return;
    }
    // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
    setState(() => 'fetching');
    let canceled = false;
    (async () => {
      try {
        const loadout = await getDecodedLoadout(decodedUrl);
        if (!canceled) {
          setState('ok');
          editLoadout(loadout, currentStoreId, { fromExternal: true });
          onClose();
        }
      } catch (e) {
        if (!canceled) {
          setState(`${t('Loadouts.Import.Error')} ${errorMessage(e)}`);
        }
      }
    })();
    return () => {
      canceled = true;
    };
  }, [currentStoreId, onClose, shareUrl]);

  return (
    <Sheet
      onClose={onClose}
      header={
        <>
          <h1>{t('Loadouts.ImportLoadout')}</h1>
          <UserGuideLink topic="Share-Loadouts" />
        </>
      }
      sheetClassName={styles.sheet}
    >
      <div className={styles.body}>
        <span>{t('Loadouts.Import.PasteHere')}</span>
        <div className={styles.fields}>
          <input
            value={shareUrl}
            onChange={(e) => setShareUrl(e.target.value)}
            placeholder={placeHolder}
            autoFocus={nativeAutoFocus}
          />
          {state !== 'ok' &&
            (state === 'fetching' ? (
              <span>
                <AppIcon icon={refreshIcon} spinning={true} />
              </span>
            ) : state.includes('404') ? (
              t('Loadouts.Import.Error404')
            ) : (
              state
            ))}
        </div>
      </div>
    </Sheet>
  );
}
