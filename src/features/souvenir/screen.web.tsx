// 校慶紀念品 on the web: the shop is a website of its own, so this page links
// to it instead of framing it.
import { icons } from "@/components/icons";
import { openWebsite } from "@/lib/open-link";
import { ButtonRow, ListScreen, Section, TextBlock } from "@/ui";

const STORE_URL = "https://souvenir.cksc.tw/auth";

export default function SouvenirScreen() {
  return (
    <ListScreen>
      <Section title="校慶紀念品">
        <TextBlock text="今日我以建中為榮，明日建中以我為榮。" />
        <ButtonRow
          label="前往紀念品商店"
          icon={icons.openExternal}
          onPress={() => void openWebsite(STORE_URL)}
        />
      </Section>
    </ListScreen>
  );
}
