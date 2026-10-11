import { Linking } from 'react-native';

import { pushAvailability, pushController } from './registration';
import { usePushStore } from './store';

export function usePushSettings() {
  const state = usePushStore();
  const unavailable = pushAvailability();
  const status = unavailable ?? state.status;
  return {
    status,
    optedIn: state.optedIn,
    busy: status === 'busy',
    error: state.error,
    canEnable: !unavailable,
    pendingSync: state.pendingDisable.length > 0,
    enable: pushController.enable,
    disable: pushController.disable,
    openSettings: () => Linking.openSettings(),
  };
}
