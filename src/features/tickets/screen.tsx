// 建中舞會門票: the ticket shop is a website, so it stays in a WebView,
// with 在瀏覽器開啟 in the header and the kit's empty state when the shop
// cannot load.
import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import { HeaderActions } from "@/components/header-actions";
import { icons } from "@/components/icons";
import { openWebsite } from "@/lib/open-link";
import { usePalette } from "@/theme/palette";
import { EmptyState, ListScreen, Section } from "@/ui";

const STORE_URL = "https://tickets.cksc.tw/auth";

const isWebUrl = (url: string) => /^https?:\/\//i.test(url);

export default function TicketsScreen() {
  const palette = usePalette();
  const [failed, setFailed] = useState(false);
  // Bumped by 重試 to remount the WebView, which starts over at the shop.
  const [attempt, setAttempt] = useState(0);
  // The page on screen (or the one that failed), so 在瀏覽器開啟 continues
  // where the user is rather than at the shop's front page.
  const [pageUrl, setPageUrl] = useState(STORE_URL);

  function openInBrowser() {
    void openWebsite(pageUrl);
  }

  function retry() {
    setFailed(false);
    setPageUrl(STORE_URL);
    setAttempt((count) => count + 1);
  }

  return (
    <>
      <HeaderActions
        right={[
          {
            kind: "icon",
            key: "browser",
            label: "在瀏覽器開啟",
            icon: icons.openExternal,
            onPress: openInBrowser,
          },
        ]}
      />
      {failed ? (
        <ListScreen>
          <Section plain>
            <EmptyState
              icon={icons.error}
              title="目前無法載入購票系統。"
              action={{ label: "重試", onPress: retry }}
              secondaryAction={{
                label: "在瀏覽器開啟",
                onPress: openInBrowser,
              }}
            />
          </Section>
        </ListScreen>
      ) : (
        <View style={[styles.fill, { backgroundColor: palette.background }]}>
          <WebView
            key={attempt}
            source={{ uri: STORE_URL }}
            style={styles.fill}
            startInLoadingState
            renderLoading={() => (
              <ActivityIndicator style={StyleSheet.absoluteFill} />
            )}
            onNavigationStateChange={(navigation) => {
              if (isWebUrl(navigation.url)) setPageUrl(navigation.url);
            }}
            onError={() => setFailed(true)}
            onHttpError={(event) => {
              if (event.nativeEvent.statusCode >= 400) setFailed(true);
            }}
            // Stay on the web: other schemes (intents, app links) are not followed.
            onShouldStartLoadWithRequest={(request) =>
              isWebUrl(request.url) || request.url === "about:blank"
            }
          />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
