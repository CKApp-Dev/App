// 校園: everything that is not a daily tab. The newest 校網 announcements
// (unread first, then pinned), then 交通 with the followed stations' numbers,
// 建北特約, 校慶紀念品 and 選擇障礙小幫手, each pushed in this tab's stack.
// Layout per docs/design/native-ui.md, "校園 (Campus)".
import { router } from "expo-router";

import { HeaderActions } from "@/components/header-actions";
import { icons } from "@/components/icons";
import { useCommute } from "@/features/home/use-commute";
import { openNews } from "@/features/news/news-actions";
import { groupNews, newsSubtitle, newsTags } from "@/features/news/news-view";
import { useSchoolNews } from "@/features/news/use-school-news";
import { useNewsStore } from "@/store/news";
import { useTransportStore } from "@/store/transport";
import { usePalette } from "@/theme/palette";
import { ListScreen, Row, Section, TextBlock } from "@/ui";

/** Announcements listed here; the rest are one tap away in 校網. */
const LATEST = 3;

/** Keeps a read row's title in line with the unread ones beside their dots. */
const NO_DOT = "#00000000";

const openAllNews = () => router.push("/(tabs)/campus/news");

export default function CampusScreen() {
  const palette = usePalette();
  // Polls like 校網 itself, only while this screen is focused.
  const { query, partialFailure, refetch } = useSchoolNews();
  const pinned = useNewsStore((state) => state.pinned);
  const lastClearedTime = useNewsStore((state) => state.lastClearedTime);
  const youbikeCount = useTransportStore((state) => state.youbike.length);
  const metroCount = useTransportStore((state) => state.metro.length);
  // The followed stations' numbers, fetched once (not polled) while 校園 is open.
  const commute = useCommute({
    enabled: youbikeCount + metroCount > 0,
    live: false,
  });

  const groups = query.data
    ? groupNews(query.data, pinned, lastClearedTime)
    : null;
  const pinnedTitles = new Set(pinned.map((item) => item.title));
  const shown = groups
    ? [...groups.unread, ...groups.pinned].slice(0, LATEST)
    : [];
  const unreadTitles = new Set(groups?.unread.map((item) => item.title) ?? []);

  let newsFooter: string | undefined;
  if (query.isError && !query.data) newsFooter = "校網目前無法讀取。";
  else if (partialFailure)
    newsFooter = `「${partialFailure.feeds.join("、")}」暫時無法更新，先顯示上次的內容。`;

  // The first followed station of each kind, as on the 現在 card, or the
  // counts while there is no line to show.
  const transportSummary = commute.cardLines.length
    ? commute.cardLines.map((line) => `${line.name} ${line.value}`).join(" · ")
    : `${youbikeCount} 個 YouBike 站點 · ${metroCount} 個捷運車站`;

  return (
    <>
      <HeaderActions
        right={[
          {
            kind: "icon",
            key: "search",
            label: "搜尋校網",
            icon: icons.search,
            onPress: openAllNews,
          },
        ]}
      />
      {/* onRefresh from the first render: the iOS List is rebuilt if it appears later. */}
      <ListScreen
        onRefresh={() => Promise.allSettled([refetch(), commute.refetch()])}
      >
        <Section
          title="校網"
          prominent
          titleBadge={
            groups && groups.unread.length > 0
              ? `${groups.unread.length} 則未讀`
              : undefined
          }
          action={{ label: "全部", onPress: openAllNews }}
          footer={newsFooter}
          footerAction={
            newsFooter
              ? { label: "重試", onPress: () => void refetch() }
              : undefined
          }
        >
          {shown.map((item) => {
            const unread = unreadTitles.has(item.title);
            const { tags, title } = newsTags(item.title);
            const subtitle = [
              newsSubtitle(item),
              pinnedTitles.has(item.title) ? "已釘選" : "",
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <Row
                key={item.title}
                title={title}
                titleLines={3}
                tags={tags}
                strong={unread}
                subtitle={subtitle}
                dotColor={
                  unread
                    ? palette.scheme === "dark"
                      ? "#8EAEFF"
                      : "#03328D"
                    : NO_DOT
                }
                accessibilityLabel={[
                  unread ? "未讀" : "",
                  ...tags,
                  title,
                  subtitle,
                ]
                  .filter(Boolean)
                  .join("，")}
                onPress={() => void openNews(item)}
              />
            );
          })}
          {groups && shown.length === 0 ? (
            <TextBlock text="沒有未讀或釘選的消息。" secondary />
          ) : null}
        </Section>

        <Section title="交通" prominent>
          <Row
            title="YouBike 與捷運"
            subtitle={transportSummary}
            icon={icons.bike}
            accessory="chevron"
            onPress={() => router.push("/(tabs)/campus/transport")}
          />
        </Section>

        <Section title="學生福利" prominent>
          <Row
            title="建北特約"
            subtitle="合作店家優惠"
            icon={icons.store}
            accessory="chevron"
            onPress={() => router.push("/(tabs)/campus/promo")}
          />
          <Row
            title="校慶紀念品"
            subtitle="紀念品商店"
            icon={icons.bag}
            accessory="chevron"
            onPress={() => router.push("/(tabs)/campus/souvenir")}
          />
          <Row
            title="建中舞會門票"
            subtitle="CK PARTY NIGHT"
            icon={icons.ticket}
            accessory="chevron"
            onPress={() => router.push("/(tabs)/campus/tickets")}
          />
        </Section>

        <Section title="工具" prominent>
          <Row
            title="選擇障礙小幫手"
            subtitle="輸入選項，幫你抽一個"
            icon={icons.help}
            accessory="chevron"
            onPress={() => router.push("/(tabs)/campus/help")}
          />
        </Section>
      </ListScreen>
    </>
  );
}
