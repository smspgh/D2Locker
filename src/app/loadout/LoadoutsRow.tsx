import { ConfirmButton } from 'app/d2l-ui/ConfirmButton';
import { t } from 'app/i18next-t';
import { DimStore } from 'app/inventory/store-types';
import { applyLoadout } from 'app/loadout-drawer/loadout-apply';
import { copyAndEditLoadout, editLoadout } from 'app/loadout-drawer/loadout-events';
import { deleteLoadout } from 'app/loadout/actions';
import { Loadout } from 'app/loadout/loadout-types';
import { AppIcon, deleteIcon } from 'app/shell/icons';
import { useThunkDispatch } from 'app/store/thunk-dispatch';
import { useStreamDeckSelection } from 'app/stream-deck/stream-deck';
import { ReactNode, memo, useMemo } from 'react';
import LoadoutView from './LoadoutView';

/**
 * A single row in the Loadouts page.
 */
export default memo(function LoadoutRow({
  loadout,
  store,
  saved,
  equippable,
  onShare,
  onSnapshotInGameLoadout,
}: {
  loadout: Loadout;
  store: DimStore;
  saved: boolean;
  equippable: boolean;
  onSnapshotInGameLoadout: () => void;
}) {
  const dispatch = useThunkDispatch();

  const streamDeckDeepLink = $featureFlags.elgatoStreamDeck
    ? // eslint-disable-next-line
      useStreamDeckSelection({
        options: { type: 'loadout' as const, loadout, store },
        equippable,
      })
    : undefined;

  const actionButtons = useMemo(() => {
    const handleDeleteClick = () => dispatch(deleteLoadout(loadout.id));

    const handleApply = () =>
      dispatch(applyLoadout(store, loadout, { allowUndo: true, onlyMatchingClass: true }));

    const handleEdit = () => editLoadout(loadout, store.id);
    const handleCopyAndEdit = () => copyAndEditLoadout(loadout, store.id);

    const actionButtons: ReactNode[] = [];

    if (equippable) {
      actionButtons.push(
        <button key="apply" type="button" className="d2l-button" onClick={handleApply}>
          {t('Loadouts.Apply')}
        </button>,
      );
    }

    actionButtons.push(
      <button key="edit" type="button" className="d2l-button" onClick={handleEdit}>
        {saved ? t('Loadouts.EditBrief') : t('Loadouts.SaveLoadout')}
      </button>,
    );

    if (equippable) {
      // add button here to copy and edit the loadout
      actionButtons.push(
        <button key="copyAndEdit" type="button" className="d2l-button" onClick={handleCopyAndEdit}>
          {t('Loadouts.CopyAndEdit')}
        </button>,
      );
    }


    if (streamDeckDeepLink) {
      actionButtons.push(
        <a href={streamDeckDeepLink} target="_blank">
          <button key="open-on-stream-deck" type="button" className="d2l-button">
            {t('Loadouts.OpenOnStreamDeck')}
          </button>
        </a>,
      );
    }

    if (saved) {
      actionButtons.push(
        <ConfirmButton key="delete" danger onClick={handleDeleteClick}>
          <AppIcon icon={deleteIcon} title={t('Loadouts.Delete')} />
        </ConfirmButton>,
      );
    } else {
      actionButtons.push(
        <button
          key="snapshot"
          type="button"
          className="d2l-button"
          onClick={onSnapshotInGameLoadout}
        >
          {t('Loadouts.Snapshot')}
        </button>,
      );
    }

    return actionButtons;
  }, [
    dispatch,
    equippable,
    loadout,
    onSnapshotInGameLoadout,
    saved,
    store,
    streamDeckDeepLink,
  ]);

  return (
    <LoadoutView
      loadout={loadout}
      store={store}
      actionButtons={actionButtons}
      hideShowModPlacements={!equippable}
    />
  );
});
