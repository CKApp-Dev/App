import { requireOptionalNativeModule } from 'expo';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import type { NowInput } from '@/features/home/now';

import { nowTimeline } from './now-timeline';

/**
 * Check the installed binary before importing expo-widgets: its iOS entry
 * throws when ExpoWidgets is missing (Expo Go or a build made before adding
 * the dependency). The extension and App Group are included by default at
 * prebuild; ENABLE_WIDGETS=0 opts out locally. Unsupported builds and other
 * platforms never load the widget layout.
 */
export const WIDGETS_ENABLED = Platform.OS === 'ios'
  && Boolean(requireOptionalNativeModule<{ widgetsDirectory: string }>('ExpoWidgets')?.widgetsDirectory);

let timelineWritten = false;

function widgetHandle() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- The layout imports the optional native module.
  const { nowWidget } = require('./now-widget') as typeof import('./now-widget');
  return nowWidget();
}

/**
 * Register the layout at launch, including while the welcome screen is open
 * or the timetable is unavailable. Keep a saved timeline; only seed an empty
 * installation so the widget gallery has useful content before setup.
 */
export function useInitializeNowWidget() {
  useEffect(() => {
    if (!WIDGETS_ENABLED) return;
    const widget = widgetHandle();
    void widget.getTimeline().then((entries) => {
      // A timetable may have arrived while the native read was in flight.
      if (entries.length || timelineWritten) {
        widget.reload();
        return;
      }
      widget.updateSnapshot({ eyebrow: 'CK APP', title: '選擇班級', next: '打開 App 選擇班級' });
      timelineWritten = true;
    }).catch((error: unknown) => {
      console.warn('Unable to initialize the 現在 widget', error);
    });
  }, []);
}

/**
 * Rewrites the 現在 widget's timeline (the next 36 hours, one entry per bell)
 * whenever what it shows changes, and once a day while 今天 is open. Without
 * the app being opened the widget still runs to the end of that timeline.
 */
export function useNowWidget(input: Omit<NowInput, 'now'> | null, dayKey: string) {
  const { periods, rows, semesterStart, events, term, grade } = input ?? {};
  useEffect(() => {
    if (!WIDGETS_ENABLED || !periods || !rows || semesterStart === undefined || !events || term === undefined || grade === undefined) return;
    widgetHandle().updateTimeline(nowTimeline({ periods, rows, semesterStart, events, term, grade }, new Date()));
    timelineWritten = true;
  }, [periods, rows, semesterStart, events, term, grade, dayKey]);
}
