const noop = async () => {};

export function usePushSettings() {
  return {
    status: 'unsupported' as const,
    optedIn: false,
    busy: false,
    error: null as string | null,
    canEnable: false,
    pendingSync: false,
    enable: noop,
    disable: noop,
    openSettings: noop,
  };
}
