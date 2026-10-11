// The 現在 widget: Home Screen (small, medium) and Lock Screen (rectangular,
// inline) views of what is happening at school now, drawn by the widget
// extension from the timeline the app writes (./now-timeline.ts). The layout
// is a 'widget' function: Babel turns it into source text that the extension
// runs with @expo/ui's SwiftUI views and modifiers as globals, so it may use
// those and its arguments only (colours are written out for that reason).
// Countdowns use the timer style (22:08): the relative style spells out
// minutes and seconds in the device language and wraps.
import { Capsule, HStack, Image, Rectangle, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  opacity,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type Widget, type WidgetEnvironment } from 'expo-widgets';

import type { NowWidgetProps } from './now-timeline';

function NowWidgetLayout(props: NowWidgetProps, environment: WidgetEnvironment) {
  'widget';
  // WidgetKit asks for a placeholder with empty props before reading a timeline.
  if (!props.title) {
    props = { eyebrow: 'CK APP', title: '選擇班級', next: '打開 App 選擇班級' };
  }
  // The 現在 card's colours (theme/brand.ts): CK navy, lifted in dark mode;
  // white, 78% white, and 45% white for the rail ahead of now.
  const navy = environment.colorScheme === 'dark' ? '#17377F' : '#03328D';
  const white = foregroundStyle('#FFFFFF');
  const soft = foregroundStyle('#FFFFFFC7');
  const open = widgetURL('ckapp:///home');
  // A timer text takes all the width it is offered; this keeps 後下課 beside it (room for 1:10:00).
  const TIMER_WIDTH = frame({ maxWidth: 64, alignment: 'leading' });

  if (environment.widgetFamily === 'accessoryInline') {
    return <Text modifiers={[open]}>{`${props.eyebrow} ${props.title}`}</Text>;
  }

  if (environment.widgetFamily === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[containerBackground('#00000000', 'widget'), open]}>
        <HStack spacing={4}>
          <Image systemName="arrowtriangle.down.fill" modifiers={[font({ size: 9 })]} />
          <Text modifiers={[font({ textStyle: 'headline' }), lineLimit(1)]}>{`${props.eyebrow} ${props.title}`}</Text>
        </HStack>
        {props.until ? (
          <HStack spacing={2}>
            <Text date={new Date(props.until)} dateStyle="timer" modifiers={[font({ textStyle: 'subheadline' }), monospacedDigit(), TIMER_WIDTH]} />
            <Text modifiers={[font({ textStyle: 'subheadline' })]}>{props.untilLabel ?? ''}</Text>
          </HStack>
        ) : null}
        {props.next ? <Text modifiers={[font({ textStyle: 'caption' }), lineLimit(1)]}>{props.next}</Text> : null}
      </VStack>
    );
  }

  const medium = environment.widgetFamily === 'systemMedium';
  // The bell rail: one bar per period (passed white, ahead 45% white: 3.5:1
  // on the navy), a 空堂 a thin bar and lunch a short dash, so the kinds
  // differ by shape, not only by colour; the 倒三角 over the period in session.
  const rail = props.rail?.length ? (
    <HStack spacing={2} alignment="bottom">
      {props.rail.map((mark, index) => (
        <VStack key={`${index}`} spacing={2}>
          <Image
            systemName="arrowtriangle.down.fill"
            modifiers={[font({ size: 6 }), white, opacity(mark.state === 'now' ? 1 : 0)]}
          />
          <Capsule
            modifiers={[
              foregroundStyle(mark.state === 'ahead' ? '#FFFFFF73' : '#FFFFFF'),
              frame(
                mark.kind === 'lunch'
                  ? { width: 6, height: 2 }
                  : { maxWidth: Infinity, height: mark.kind === 'free' ? 2 : 4 },
              ),
            ]}
          />
        </VStack>
      ))}
    </HStack>
  ) : null;

  const now = (
    <VStack alignment="leading" spacing={2}>
      <HStack spacing={6}>
        <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), soft, lineLimit(1)]}>{props.eyebrow}</Text>
        {medium && props.detail ? (
          <Text modifiers={[font({ textStyle: 'subheadline' }), monospacedDigit(), soft, lineLimit(1)]}>{props.detail}</Text>
        ) : null}
      </HStack>
      <Text modifiers={[font({ textStyle: 'title', weight: 'bold' }), white, lineLimit(2), minimumScaleFactor(0.6)]}>
        {props.title}
      </Text>
      <Spacer />
      {rail}
      {props.until ? (
        <HStack spacing={3}>
          <Text
            date={new Date(props.until)}
            dateStyle="timer"
            modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), monospacedDigit(), white, TIMER_WIDTH]}
          />
          <Text modifiers={[font({ textStyle: 'subheadline', weight: 'semibold' }), white]}>{props.untilLabel ?? ''}</Text>
        </HStack>
      ) : props.next ? (
        <Text modifiers={[font({ textStyle: 'caption' }), soft, lineLimit(2), minimumScaleFactor(0.8)]}>{props.next}</Text>
      ) : null}
    </VStack>
  );

  if (!medium || !props.upcoming?.length) {
    return (
      <VStack alignment="leading" modifiers={[containerBackground(navy, 'widget'), open]}>
        {now}
      </VStack>
    );
  }

  // Medium: now on the left, the rest of the day on the right.
  return (
    <HStack spacing={12} modifiers={[containerBackground(navy, 'widget'), open]}>
      {now}
      <Rectangle modifiers={[foregroundStyle('#FFFFFF38'), frame({ width: 0.5 })]} />
      <VStack alignment="leading" spacing={6}>
        {props.upcoming.map((item) => (
          <HStack key={`${item.time}-${item.title}`} spacing={6}>
            <Text modifiers={[font({ textStyle: 'subheadline' }), white, lineLimit(1)]}>{item.title}</Text>
            <Spacer />
            <Text modifiers={[font({ textStyle: 'subheadline' }), monospacedDigit(), soft]}>{item.time}</Text>
          </HStack>
        ))}
        <Spacer />
      </VStack>
    </HStack>
  );
}

let widget: Widget<NowWidgetProps> | null = null;

/** The 現在 widget's handle, created on first use (only in builds with the widget extension). */
export function nowWidget(): Widget<NowWidgetProps> {
  widget ??= createWidget<NowWidgetProps>('NowWidget', NowWidgetLayout);
  return widget;
}
