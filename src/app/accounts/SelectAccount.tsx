import { t } from 'app/i18next-t';
import { accountRoute } from 'app/routes';
import { AppIcon, signOutIcon } from 'app/shell/icons';
import { useThunkDispatch } from 'app/store/thunk-dispatch';
import { chainComparator, compareBy, reverseComparator } from 'app/utils/comparators';
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router';
import Account from './Account';
import styles from './SelectAccount.m.scss';
import { logOut } from './platforms';
import { accountsSelector } from './selectors';

/**
 * The large "select accounts" page shown when the user has not yet selected an account.
 */
export default function SelectAccount({ path }: { path?: string }) {
  const accounts = useSelector(accountsSelector);
  const sortedAccounts = accounts.toSorted(
    chainComparator(
      reverseComparator(compareBy((a) => a.destinyVersion)), // 2 before 1
      reverseComparator(compareBy((a) => a.lastPlayed.getTime())),
    ),
  );

  const navigate = useNavigate();

  // Auto-select the first Destiny 2 account (destinyVersion === 2)
  useEffect(() => {
    const destiny2Account = sortedAccounts.find((account) => account.destinyVersion === 2);
    if (destiny2Account) {
      navigate(accountRoute(destiny2Account) + (path ?? ''));
    }
  }, [sortedAccounts, navigate, path]);

  const bungieName = sortedAccounts[0]?.displayName;

  const dispatch = useThunkDispatch();
  const onLogOut = async () => {
    await dispatch(logOut());
    await navigate('/login');
  };

  return (
    <div className={styles.accountSelect}>
      <h1>{t('Accounts.Choose', { bungieName })}</h1>
      <div className={styles.accountList}>
        {sortedAccounts.map((account) => (
          <Link
            key={`${account.membershipId}-${account.destinyVersion}`}
            className={styles.account}
            to={accountRoute(account) + (path ?? '')}
          >
            <Account className={styles.accountDetails} account={account} />
          </Link>
        ))}
      </div>
      <p>
        {t('Accounts.MissingAccountWarning')} {t('Accounts.SwitchAccounts')}
      </p>
      <div onClick={onLogOut} role="button">
        <AppIcon icon={signOutIcon} />
        &nbsp;
        {t('Settings.LogOut')}
      </div>
    </div>
  );
}
