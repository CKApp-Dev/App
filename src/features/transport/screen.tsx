// Transport hub. Each destination owns its location or saved-station queries.
import { router } from 'expo-router';

import { icons } from '@/components/icons';
import { ListScreen, Row, Section } from '@/ui';

export default function TransportScreen() {
  return (
    <ListScreen>
      <Section title="交通">
        <Row
          title="附近交通"
          subtitle="尋找附近三個 YouBike 站點與最近的捷運站"
          icon={icons.location}
          accessory="chevron"
          onPress={() => router.push('/(tabs)/campus/transport/nearby')}
        />
        <Row
          title="YouBike"
          subtitle="常用站點的可借車輛與可還車位"
          icon={icons.bike}
          accessory="chevron"
          onPress={() => router.push('/(tabs)/campus/transport/youbike')}
        />
        <Row
          title="捷運"
          subtitle="常用車站的即時到站與車廂擁擠資訊"
          icon={icons.metro}
          accessory="chevron"
          onPress={() => router.push('/(tabs)/campus/transport/metro')}
        />
      </Section>
    </ListScreen>
  );
}
