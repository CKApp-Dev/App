# 貢獻指南

**語言 / Language：** 中文（本頁）｜[English](CONTRIBUTING.en.md)

先閱讀 [README](README.md) 了解 React Native 架構、設定與目前發布限制。

## 本機開發

使用 Node.js 24.12.0+ 與 Yarn Classic，從 repo 根目錄執行：

```bash
yarn install --frozen-lockfile
cp .env.example .env.local
yarn android --device
# macOS 裝有 Xcode 與 CocoaPods 時，也可執行 yarn ios --device
```

Android Studio、SDK／JDK 設定與 macOS CocoaPods 疑難排解請見 [README 開發說明](README.md#開發)。`yarn start` 提供 JavaScript 給已安裝的原生 debug App；新增原生依賴後須重新編譯。

Android debug 版本以 **CK APP Dev**（`org.capacitor.quasar.ckapp.dev`）安裝，與商店版的資料各自獨立。若已有生成的 `android/`，先執行一次 `npx expo prebuild --platform android --no-install` 套用 debug 身分。Release 與 iOS 的 App 身分維持不變。

修改依賴或 App 原生設定後，以 `npx expo prebuild --clean` 重新生成原生專案。`ios/` 與 `android/` 不提交；需要長期保留的變更應寫入 `app.config.ts` 或 config plugin。

## 修改功能

1. 在 `src/features/<feature>/` 維護畫面、hooks 與純邏輯。時間、狀態這類規則寫成畫面外的純函式，才能測試。
2. 路由放在 `src/app/`。分頁固定為五個（`src/features/registry.ts` 的 `TABS`）。
3. 新功能放進既有分頁：每天用的放在對應分頁裡，其他的加到校園（`src/app/(tabs)/campus/` 與 `CAMPUS_SCREENS`）。
4. 持久狀態使用 `src/store/` 的 Zustand store 與 `src/lib/storage.ts`。不要在畫面中直接改動陣列；使用 store action。
5. 畫面只用 `@/ui` 的元件：`ListScreen` 裡只有 `Section`，`Section` 裡是列與區塊。不要在其中直接放 React Native 或 `@expo/ui` 的元件；地圖、圖片等 React Native 內容用 `Embedded`。需要新元件或新屬性時，先在 `src/ui/types.ts` 定義，再分別實作 `src/ui/ios/`（SwiftUI）與 `src/ui/android/`（Compose），並更新 [設計規格](docs/design/native-ui.md) 的對照表。`src/ui/kit.tsx` 供 TypeScript 使用，只重新匯出 Android 元件；Metro 依原生平台選用對應實作。
6. 導覽列按鈕、選單與切換檢視（例如美食的熱食部／附近）用 `src/components/header-actions` 的 `HeaderActions`；圖示加在 `src/components/icons.ts`，同時給 SF Symbol 與 Material Symbol。分頁標題下方的一行用 `ListScreen` 的 `subtitle`。

### 設計原則

介面依 [設計規格](docs/design/native-ui.md)。改畫面時：

- 倒三角只代表「現在」；滿版建中藍只給「今天」的「現在」卡片。
- 文字、背景與分隔線用系統語意色，跟著淺色／深色模式與「增加對比」。課表顏色只來自 `src/features/schedule/cell-colors.ts`（使用者可選的七色）與 `subject-colors.ts`（每個科目各自的顏色），文字與底色對比至少 4.5:1。文字一律用系統文字樣式（`textStyle`），不要用固定字級（`font({ size })` 不會跟著動態字體縮放）。
- 狀態一定有文字，不只靠顏色，例如「營業中」旁的圓點。
- 時間、價格與數量用等寬數字。
- 位置固定，只有內容跟著時間變。
- 可點的元件都要有無障礙標籤，選取狀態要讓 VoiceOver／TalkBack 念出來。

### 「現在」卡片與小工具

上課、下課與放假的判斷在 `src/features/home/now.ts`；iOS 小工具的時間軸（`src/widgets/now-timeline.ts`）用同一份狀態，改其中一邊時兩邊的測試都要跟著更新。小工具版面（`src/widgets/now-widget.tsx`）是 `'widget'` 函式，只能使用 `@expo/ui` 的 SwiftUI 元件、修飾符與函式參數。擴充程式不支援的修飾符（例如 `fixedSize`）會讓小工具變成空白，而且不會顯示錯誤，所以改版面後要以 `ENABLE_WIDGETS=1` 建置，把小工具加到模擬器主畫面確認。

日期鍵使用當地 `YYYY-MM-DD`，透過 `src/lib/dates.ts` 處理；不要以 `toISOString()` 產生日曆日期或菜單週一。遠端資料應有驗證器、錯誤狀態與快取策略；輪詢須在不需要時暫停。

## 修改資料

| 資料               | 修改位置                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 班級課表           | Data repo 的 `schedules/gaoyi_schedules.json`、`gaoer_schedules.json`、`gaosan_schedules.json`                              |
| 餐廳               | Data repo 的 `restaurantData.json`，含名稱、座標與營業時間                                                                  |
| 校方行事曆         | Data repo 的 `calendar/<學期>.json`，目前為 `calendar/115-1.json`；來源與格式以 `src/features/todo/school-calendar.ts` 為準 |
| 菜單               | Data repo 的 `menus/<週一日期>.json`（每週菜色）與 `menus/<週一日期>_<1至5>.png`（每日圖片）                                |
| 北捷靜態站點／路線 | `src/features/transport/metro-lines.ts`                                                                                     |

資料來源是 [CKApp-Dev/Data](https://github.com/CKApp-Dev/Data)。更新資料時先對照功能內的驗證器；`tools/` 的歷史轉檔工具不保證符合目前格式，使用前須檢查輸出。

## 檢查與 PR

在新分支開發並發 PR。提交前執行：

```bash
yarn typecheck
yarn test --runInBand
yarn lint
```

與日期、資料解析或狀態規則有關的變更，應以有意義的回歸測試覆蓋。純邏輯測試放在對應功能附近的 `*.test.ts`；使用 `@jest/globals`，目前 Jest 不需要啟動原生 UI。

在 Android 與 iOS 驗證受影響流程，特別是原生輸入、sheet／dialog、工具列、地圖、離線與重啟後持久資料。改介面時在 iOS 模擬器與 Android 模擬器各看一次，並檢查深色模式與較大的文字大小；版面改變時一併更新設計規格。PR 描述請寫清楚問題、結果、驗證方式及尚未測試的限制，介面改動附上兩個平台的截圖。

## 版本與發布

本機版本來自 `package.json`。`app.config.ts` 接受 `APP_VERSION` 與 `BUILD_NUMBER`；不要手動改生成的 Gradle 或 Xcode 版本。

`vX.Y.Z` tag 與手動執行 build workflow 都會建置、簽署並上傳至 Google Play internal／TestFlight。Tag 必須是數字型 `major.minor.patch`；手動版本來自套件版本，build number 是 workflow run number。一般分支 push 或 `[deploy]` commit 前綴不會觸發發布。

簽署帳密／金鑰存放 GitHub Secrets；本機 API 設定放 `.env.local`。不要提交私鑰、provisioning profile 或真正的 API 帳密。

**舊版 Capacitor WebView localStorage 由 `src/features/legacy-import` 在首次啟動時匯入。** 修改 store 結構或預設值時，請一併更新該資料夾的轉換／合併邏輯與測試。發布前必須在 Android 與 iOS 上以實際舊版升級驗證匯入結果。

## 聯絡

ckappofficial@gmail.com｜[Instagram](https://www.instagram.com/ckappofficial/)｜[官方網站](https://ckapp-tw.web.app/)
