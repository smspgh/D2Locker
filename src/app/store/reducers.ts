import { currentAccountSelector } from 'app/accounts/selectors';
import { clarity } from 'app/clarity/reducer';
import { inGameLoadouts } from 'app/loadout/ingame/reducer';
import { streamDeck } from 'app/stream-deck/reducer';
import { vendors } from 'app/vendors/reducer';
import { Reducer, combineReducers } from 'redux';
import { PayloadAction } from 'typesafe-actions';
import { accounts } from '../accounts/reducer';
import { compare } from '../compare/reducer';
import { DimApiState, d2lApi, initialState as d2lApiInitialState } from '../d2l-api/reducer';
import { farming } from '../farming/reducer';
import { inventory } from '../inventory/reducer';
import { loadouts } from '../loadout/reducer';
import { manifest } from '../manifest/reducer';
import { shell } from '../shell/reducer';
import { wishLists } from '../wishlists/reducer';
import { RootState } from './types';

const reducer: Reducer<RootState> = (state, action) => {
  const combinedReducers = combineReducers({
    accounts,
    inventory,
    shell,
    loadouts,
    wishLists,
    farming,
    manifest,
    vendors,
    compare,
    clarity,
    inGameLoadouts,
    streamDeck,
    // Dummy reducer to get the types to work
    d2lApi: (state: DimApiState = d2lApiInitialState) => state,
  });

  const intermediateState = combinedReducers(state, action);

  // Run the D2L API reducer last, and provide the current account along with it
  const d2lApiState = d2lApi(
    intermediateState.d2lApi,
    action as PayloadAction<any, any>,
    currentAccountSelector(intermediateState),
  );

  if (intermediateState.d2lApi !== d2lApiState) {
    return {
      ...intermediateState,
      d2lApi: d2lApiState,
    };
  }

  return intermediateState;
};

export default reducer;
