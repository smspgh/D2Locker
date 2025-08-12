export let readyResolve: (value?: unknown) => void;
/** this promise is resolved when the initial big load of D2L API data is completed */
export const settingsReady = new Promise((resolve) => (readyResolve = resolve));
