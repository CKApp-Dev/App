// 建中舞會門票 on the web: the ticket shop is a website of its own, so this
// page links to it instead of framing it.
import { icons } from "@/components/icons";
import { openWebsite } from "@/lib/open-link";
import { ButtonRow, ListScreen, Section, TextBlock } from "@/ui";

const STORE_URL = "https://tickets.cksc.tw/auth";

export default function TicketsScreen() {
  return (
    <ListScreen>
      <Section title="建中舞會門票">
        <TextBlock text="CK PARTY NIGHT" />
        <ButtonRow
          label="前往建中舞會購票系統"
          icon={icons.openExternal}
          onPress={() => void openWebsite(STORE_URL)}
        />
      </Section>
    </ListScreen>
  );
}
