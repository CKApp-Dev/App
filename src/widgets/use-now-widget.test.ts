import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { NowInput } from '@/features/home/now';

import { nowTimeline } from './now-timeline';
import type { NowWidgetProps } from './now-timeline';

let mockPlatform = 'ios';
let mockNativeModule: { widgetsDirectory: string } | null = null;
const mockNativeLookup = jest.fn(() => mockNativeModule);
const mockLayoutLoads = jest.fn();
const mockUpdateTimeline = jest.fn();
const mockUpdateSnapshot = jest.fn();
const mockReload = jest.fn();
const mockGetTimeline = jest.fn(() => Promise.resolve([] as { date: Date; props: NowWidgetProps }[]));
const mockEffects: (() => void)[] = [];

jest.mock('expo', () => ({ requireOptionalNativeModule: mockNativeLookup }));
jest.mock('react-native', () => ({ Platform: { get OS() { return mockPlatform; } } }));
jest.mock('react', () => ({ useEffect: (effect: () => void) => mockEffects.push(effect) }));

// An eager import reproduces the startup failure in a binary without ExpoWidgets.
jest.mock('expo-widgets', () => { throw new Error("Cannot find native module 'ExpoWidgets'"); });
jest.mock('./now-widget', () => {
  mockLayoutLoads();
  if (!mockNativeModule?.widgetsDirectory) throw new Error('Widget layout loaded without native support');
  return { nowWidget: () => ({ updateTimeline: mockUpdateTimeline, updateSnapshot: mockUpdateSnapshot, getTimeline: mockGetTimeline, reload: mockReload }) };
});

const INPUT: Omit<NowInput, 'now'> = {
  periods: [], rows: [], semesterStart: null, events: [], term: '', grade: null,
};
const NOW = new Date(2026, 9, 8, 8, 0);

function loadHook() {
  return jest.requireActual<typeof import('./use-now-widget')>('./use-now-widget');
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(NOW);
  mockPlatform = 'ios';
  mockNativeModule = null;
  mockEffects.length = 0;
  mockGetTimeline.mockResolvedValue([]);
});

afterEach(() => { jest.useRealTimers(); });

describe('optional Now widget', () => {
  test.each(['ios', 'android', 'web'])('skips launch initialization without native widget support on %s', (platform) => {
    mockPlatform = platform;
    const hook = loadHook();
    hook.useInitializeNowWidget();
    expect(() => mockEffects[0]()).not.toThrow();
    expect(mockLayoutLoads).not.toHaveBeenCalled();
    expect(mockGetTimeline).not.toHaveBeenCalled();
    expect(mockUpdateSnapshot).not.toHaveBeenCalled();
  });

  test('registers the widget and seeds its gallery on first launch before choosing a class or loading data', async () => {
    mockNativeModule = { widgetsDirectory: 'file:///widget-group' };
    const hook = loadHook();
    hook.useInitializeNowWidget();
    mockEffects[0]();
    expect(mockLayoutLoads).toHaveBeenCalledTimes(1);
    await mockGetTimeline.mock.results[0].value;
    expect(mockUpdateSnapshot).toHaveBeenCalledWith({ eyebrow: 'CK APP', title: '選擇班級', next: '打開 App 選擇班級' });
    expect(mockUpdateTimeline).not.toHaveBeenCalled();
  });

  test('keeps the saved timetable when launching without data', async () => {
    mockNativeModule = { widgetsDirectory: 'file:///widget-group' };
    mockGetTimeline.mockResolvedValue(nowTimeline(INPUT, NOW));
    const hook = loadHook();
    hook.useInitializeNowWidget();
    mockEffects[0]();
    await mockGetTimeline.mock.results[0].value;
    expect(mockReload).toHaveBeenCalledTimes(1);
    expect(mockUpdateSnapshot).not.toHaveBeenCalled();
    expect(mockUpdateTimeline).not.toHaveBeenCalled();
  });

  test('does not overwrite a new timetable if the initial empty read finishes later', async () => {
    mockNativeModule = { widgetsDirectory: 'file:///widget-group' };
    let completeRead!: (entries: { date: Date; props: NowWidgetProps }[]) => void;
    mockGetTimeline.mockImplementationOnce(() => new Promise((resolve) => { completeRead = resolve; }));
    const hook = loadHook();
    hook.useInitializeNowWidget();
    hook.useNowWidget(INPUT, '2026-10-08');
    mockEffects[0]();
    mockEffects[1]();
    completeRead([]);
    await mockGetTimeline.mock.results[0].value;
    expect(mockUpdateTimeline).toHaveBeenCalledTimes(1);
    expect(mockUpdateSnapshot).not.toHaveBeenCalled();
  });

  test('loads and runs without ExpoWidgets in the installed iOS binary', () => {
    const hook = loadHook();
    expect(hook.WIDGETS_ENABLED).toBe(false);
    hook.useNowWidget(INPUT, '2026-10-08');
    expect(() => mockEffects[0]()).not.toThrow();
    expect(mockLayoutLoads).not.toHaveBeenCalled();
    expect(mockUpdateTimeline).not.toHaveBeenCalled();
  });

  test('skips iOS builds without the widget App Group directory', () => {
    mockNativeModule = { widgetsDirectory: '' };
    const hook = loadHook();
    expect(hook.WIDGETS_ENABLED).toBe(false);
    hook.useNowWidget(INPUT, '2026-10-08');
    mockEffects[0]();
    expect(mockLayoutLoads).not.toHaveBeenCalled();
    expect(mockUpdateTimeline).not.toHaveBeenCalled();
  });

  test.each(['android', 'web'])('never looks up the iOS module on %s', (platform) => {
    mockPlatform = platform;
    mockNativeModule = { widgetsDirectory: 'file:///widget-group' };
    const hook = loadHook();
    expect(hook.WIDGETS_ENABLED).toBe(false);
    hook.useNowWidget(INPUT, '2026-10-08');
    mockEffects[0]();
    expect(mockNativeLookup).not.toHaveBeenCalled();
    expect(mockLayoutLoads).not.toHaveBeenCalled();
  });

  test('defers the supported widget layout until data is available', () => {
    mockNativeModule = { widgetsDirectory: 'file:///widget-group' };
    const hook = loadHook();
    expect(hook.WIDGETS_ENABLED).toBe(true);
    expect(mockLayoutLoads).not.toHaveBeenCalled();
    hook.useNowWidget(null, '2026-10-08');
    mockEffects[0]();
    expect(mockLayoutLoads).not.toHaveBeenCalled();
    expect(mockUpdateTimeline).not.toHaveBeenCalled();
  });

  test('updates the timeline in an iOS binary with widget support', () => {
    mockNativeModule = { widgetsDirectory: 'file:///widget-group' };
    const hook = loadHook();
    hook.useNowWidget(INPUT, '2026-10-08');
    expect(mockLayoutLoads).not.toHaveBeenCalled();
    mockEffects[0]();
    expect(mockLayoutLoads).toHaveBeenCalledTimes(1);
    expect(mockUpdateTimeline).toHaveBeenCalledWith(nowTimeline(INPUT, NOW));
  });
});
