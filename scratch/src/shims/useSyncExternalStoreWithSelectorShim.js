import { useSyncExternalStoreWithSelector } from 'use-sync-external-store/shim/with-selector';

// zustand/esm/traditional.mjs expects a default export from this module path.
const withSelectorDefault = { useSyncExternalStoreWithSelector };

export { useSyncExternalStoreWithSelector };
export default withSelectorDefault;
