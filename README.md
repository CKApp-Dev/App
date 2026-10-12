# CK APP 校園行動應用程式

**語言 / Language：** 中文（本頁）｜[English](README.en.md)

CK APP 是建中第 77 屆學生彭可翰和楊晨諺於 2024 年開發的校園應用程式，協助學生查看課表、安排待辦、查詢交通與探索附近美食。

目前程式已改為 **React Native + TypeScript + Expo SDK 57**。Android 互動控制項使用 Material 3 / Jetpack Compose，iOS 使用 SwiftUI 控制項與原生導覽；跨平台畫面邏輯仍共用 React Native。`package.json` 的版本目前是 **4.0.1**，正式版本與建置編號由 `app.config.ts` 決定。

介面跟著上課鐘聲設計：校徽的倒三角只用來指出「現在」，滿版的建中藍只給「今天」最上方的「現在」卡片。iOS 分頁使用系統大標題，標題下方一行顯示日期、班級或週次；美食的熱食部／附近切換放在導覽列。各畫面的版面與元件對照見 [設計規格](docs/design/native-ui.md)。

## 功能

分頁固定為五個：

| 分頁   | 內容                                                                                                                                   |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 今天   | 「現在」卡片（鐘聲軌、上下課倒數、放假與考試日），今日待辦與活動、午餐、回家、釘選的校網消息；右上角班級按鈕開啟設定                   |
| 課表   | 整週一張課表（每節一格、每個科目各有自己的顏色，標出現在這節與放假日）；自訂科目、單雙週輪替、備註、顏色與重新匯入                     |
| 行事曆 | 月曆（「假」「考」標記、年級篩選）、當日活動與待辦、接下來、所有待辦與分類管理                                                         |
| 美食   | 熱食部：當天菜色與價格（飯類在前）、日期週列與放假標示，可看原始菜單圖片。附近：地圖、營業中／我的最愛篩選、綽號與距離、收藏與隨機選店 |
| 校園   | 校網（未讀、標籤、釘選、搜尋）、交通（YouBike 與北捷）、建北特約、校慶紀念品、選擇障礙小幫手                                           |

| 其他          | 內容                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| 首次開啟      | 「你是哪一班？」：依年級選班級，或先看看之後再選                                                     |
| 設定          | 班級、「今天」顯示項目、行事曆年級篩選、重設本機資料、關於                                           |
| 小工具（iOS） | 「現在」小工具：主畫面小／中尺寸（鐘聲軌、倒數、接下來的課）與鎖定畫面；iOS 建置預設包含 |

## 架構與資料

| 路徑                            | 用途                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `src/app/`                      | Expo Router 路由、原生 Stack 與功能分頁                                         |
| `src/features/`                 | 每項功能的畫面、資料轉換與 hooks                                                |
| `src/features/registry.ts`      | 固定的五個分頁與校園裡的功能                                                    |
| `src/ui/`                       | 原生 UI 元件：同一份介面（`types.ts`），iOS 以 SwiftUI、Android 以 Compose 實作 |
| `src/components/`               | 導覽列按鈕、分頁列與圖示對照                                                    |
| `src/widgets/`                  | iOS「現在」小工具的版面與時間軸                                                 |
| `src/theme/`、`src/navigation/` | 平台色彩、原生導覽與深色模式                                                    |
| `src/store/`                    | Zustand 狀態，透過 Expo SQLite 儲存                                             |
| `src/lib/`                      | HTTP timeout、遠端資料驗證／快取、日期與儲存工具                                |
| `assets/`                       | App 圖示、啟動畫面與其他靜態圖檔                                                |
| `app.config.ts`、`plugins/`     | App 身分、版本、原生設定、環境變數與 config plugin                              |
| `.github/workflows/`            | Android／iOS 建置、簽署與測試通路上傳                                           |
| `tools/`、`docs/`               | 資料處理工具、設計規格與歷史決策紀錄                                            |

課表、餐廳、校方行事曆與菜單來自 [Data repo](https://github.com/CKApp-Dev/Data)。JSON 資料經過格式驗證後儲存快取，更新失敗時可先顯示上次內容。菜單每週一份 `menus/<週一>.json`（各日菜色與價格），另有每日圖片，檔名使用當地日期的週一加上星期序號，例如 `menus/2026-10-05_4.png`；沒有 JSON 的週次改顯示圖片。

遠端請求直接由原生 App 發出。校網每 2 分鐘更新；校網與交通輪詢會依畫面焦點／前景狀態暫停。分頁固定為今天、課表、行事曆、美食、校園：熱食部在美食裡，校網、交通、特約、紀念品與小幫手在校園裡。新安裝先顯示「你是哪一班？」；從舊版匯入時若已有班級則略過。

上課、下課與放假都由課表的鐘聲時間與校方行事曆推算（`src/features/home/now.ts`、`src/features/todo/school-days.ts`）：一節課在鐘響時結束，行事曆列出的放假日與考試日會取代當天的課。熱食部菜色來自 Data repo 由學校菜單試算表產生的 JSON，App 不從圖片辨識菜色。

設定中的資料重設會還原個人 store 與設定，並清空記憶體查詢資料。遠端 JSON 快取、菜單圖片磁碟快取與紀念品網站資料不會一併刪除。

`ios/` 與 `android/` 是 Expo 生成且不提交的專案。持久的原生設定應修改 `app.config.ts` 或 config plugin，再重新生成。參考 [Expo 原生專案生成說明](https://docs.expo.dev/workflow/continuous-native-generation/)。

`expo-build-properties` 已啟用 `ios.enableSceneSupport`，讓生成專案採用 iOS scene lifecycle，支援 Xcode 27／iOS 27。變更後須重新生成與編譯，參考 [Expo scene lifecycle 說明](https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md)。

## 開發

需要 Node.js 24.12.0+ 與 Yarn Classic。Android 需要 Android Studio／SDK 與 Java 21；iOS 需要 macOS、Xcode 與 CocoaPods。SDK 57 目前原生預設為 Android API 24+、iOS 16.4+。

```bash
git clone https://github.com/CK-APP-Org/CK_app.git
cd CK_app
yarn install --frozen-lockfile
cp .env.example .env.local
```

依 `.env.example` 設定後，從 repo 根目錄執行：

```bash
yarn android --device # 選擇模擬器／裝置，編譯並啟動 Android
yarn ios --device     # 選擇模擬器／裝置，編譯並啟動 iOS
yarn start         # 啟動 Metro，供已安裝的開發版本使用
```

原生依賴或 App 設定改動後，可執行 `npx expo prebuild --clean` 重新生成；這會覆寫生成資料夾中的手動變更。地圖與原生控制項須在原生 App 驗證。

### 在 macOS 使用 Android Studio

指令是 `yarn android`（拼字為 **android**）。先在 Android Studio 的 Device Manager 建立並啟動模擬器，再從 repo 根目錄執行 `yarn android --device`。也可連接已啟用 USB 偵錯的 Android 手機；建置前以 `adb devices` 確認裝置已列出。參考 [Expo Android Studio 設定](https://docs.expo.dev/workflow/android-studio-emulator/)。

Android debug 版本以 **CK APP Dev**（`org.capacitor.quasar.ckapp.dev`）安裝，可與商店版並存，資料各自獨立。這可避免商店版與本機 debug APK 簽署金鑰不同時的 `INSTALL_FAILED_UPDATE_INCOMPATIBLE`。若 `android/` 已存在，先套用一次設定再重新編譯：

```bash
npx expo prebuild --platform android --no-install
yarn android --device
```

Release 版本維持 `org.capacitor.quasar.ckapp`；iOS 維持既有 App 身分。若要本機建置 Android release，使用 `npx expo run:android --variant release`，讓 Expo 啟動 release 的 application ID。更新原本 App 與驗證舊版資料匯入，仍須使用原本的金鑰簽署。參考 [Expo 版本啟動選項](https://docs.expo.dev/guides/local-app-development/#local-builds-with-android-product-flavors)。

若 Android Maps 金鑰限制了套件名稱與簽署憑證，也須允許 Dev 套件及其 debug 憑證。參考 [Expo App 版本設定](https://docs.expo.dev/build-reference/variants/)。

若終端機找不到 SDK，將以下設定加入 `~/.zshrc`，路徑依 Android Studio 顯示的 SDK 位置調整，再開啟新的終端機：

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
```

若要直接用 Android Studio 建置，先執行 `npx expo prebuild --platform android`，再用 Android Studio 開啟生成的 `android/` 資料夾，將 Gradle JDK 設為 JDK 21，執行 `app` configuration。另開終端機保持 `yarn start` 運行，提供 debug App 的 JavaScript。原生依賴或 App 設定改動後須重新生成與編譯。

### iOS 前置設定與 CocoaPods

Android Studio 提供 Android 工具；iOS 建置使用 Xcode。先開啟 Xcode 完成初始設定，在 **Settings → Locations** 選擇其 Command Line Tools，並在 **Settings → Components** 安裝 iOS 模擬器 runtime，再執行 `yarn ios --device` 選擇模擬器或已連接的 iPhone。參考 [Expo iOS 模擬器設定](https://docs.expo.dev/workflow/ios-simulator/)。

建置前確認 `pod --version` 可執行。若 CocoaPods 已安裝為使用者 gem，但 `PATH` 找不到 `pod`，將其執行檔目錄加入 `~/.zshrc`，再開啟新的終端機：

```bash
export PATH="$(ruby -r rubygems -e 'puts Gem.user_dir')/bin:$PATH"
```

尚未安裝 CocoaPods 時，依 [CocoaPods 安裝說明](https://guides.cocoapods.org/using/getting-started.html) 設定；已有 [Homebrew](https://formulae.brew.sh/formula/cocoapods) 時也可使用 `brew install cocoapods`。`spawn brew ENOENT` 代表 Expo 的備援安裝流程找不到 Homebrew；請先檢查現有的 CocoaPods 安裝與 `PATH`。

`yarn start` 只啟動 Metro，不會編譯原生模組。新增原生依賴後須重新編譯 App；JavaScript 重新載入無法替已安裝的 App 加入缺少的原生模組。參考 [Expo 本機建置流程](https://docs.expo.dev/guides/local-app-development/)。

### iPhone 小工具

iOS 建置預設包含「現在」小工具。若舊建置的加入小工具列表沒有 CK APP，請重新產生 iOS 專案並安裝原生建置：

```bash
npx expo prebuild --platform ios
yarn ios --device
```

安裝後先開啟 CK APP 一次，再長按主畫面，選 **編輯 → 加入小工具**，搜尋 **CK APP**。支援主畫面小／中尺寸，以及鎖定畫面的單行／矩形尺寸。Expo Go 無法安裝此擴充，JavaScript 重新載入也無法替既有建置加入小工具。參考 [Expo Widgets 設定](https://docs.expo.dev/versions/v57.0.0/sdk/widgets/)。

實機建置可將 `IOS_TEAM_ID` 設為 Apple Developer 團隊，或在 Xcode 為 **CKAPP** 與 **ExpoWidgetsTarget** 選擇相同團隊。兩個目標都使用 App Group `group.org.capacitor.quasar.ckapp`。只有本機簽署設定不支援 App Groups 時才設 `ENABLE_WIDGETS=0`；該建置不會包含 iPhone 小工具。

| 環境變數                           | 用途                                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `METRO_API_USER`、`METRO_API_PASS` | 北捷 API 帳密，向維護者索取                                                                                                               |
| `GOOGLE_MAPS_API_KEY`              | Android Maps SDK 金鑰；未設定時顯示提示，仍可使用餐廳／站點列表，iOS 使用 Apple Maps                                                      |
| `ENABLE_WIDGETS`                   | iOS 預設包含小工具；設為 `0` 可在本機停用。實機建置需要 App Group，以及主程式和擴充各自的描述檔 |
| `IOS_TEAM_ID`                      | 選填；本機實機建置使用的 Apple Developer 團隊，會套用到主程式與小工具；CI 使用發佈團隊 |
| `APP_VERSION`                      | 選填；覆寫 `package.json` 版本，CI 由 tag／套件版本設定                                                                                   |
| `BUILD_NUMBER`                     | 選填；本機預設 `1`，CI 使用 workflow run number                                                                                           |

`.env.local` 不提交。北捷帳密與 Maps 金鑰會隨 App 打包，不能視為伺服器端秘密；若需保護帳密，必須另建後端。

## 驗證

```bash
yarn typecheck
yarn test --runInBand
yarn lint
```

Jest 檢查日期、課表、「現在」卡片狀態、行事曆、營業時間、RSS、交通與小工具時間軸等純邏輯。測試不取代原生操作驗證：請確認雙平台的輸入、分頁、sheet、地圖、離線快取、淺色／深色模式與 App 重啟後的資料保存。介面改動以 iOS 模擬器與 Android 模擬器各看一次，元件須同時有 SwiftUI 與 Compose 實作（見 [設計規格](docs/design/native-ui.md)）。

## 發版與簽署

[Android workflow](.github/workflows/build_android.yml) 與 [iOS workflow](.github/workflows/build_ios.yml) 在推送 `vX.Y.Z` tag 或手動執行時，會先跑 lint／型別／測試，再生成原生專案並建置。**兩種方式都會上傳到 Google Play internal 或 TestFlight**；tag 另會附加檔案到 GitHub Release。一般分支 push 與 `[deploy]` commit 前綴不會觸發這兩個 workflow。

Tag 版本必須是數字型 `major.minor.patch`；手動執行採 `package.json` 版本。`BUILD_NUMBER` 使用各 workflow 的 run number，維護者須確認高於既有商店 build。App 身分維持 `org.capacitor.quasar.ckapp`。

Android 由 Gradle 使用既有 `PLAY_SIGNING_KEY`、`PLAY_SIGNING_KEY_ALIAS`、`PLAY_SIGNING_KEY_STORE_PASSWORD`、`PLAY_SIGNING_KEY_PASSWORD` 簽署 APK／AAB；`SERVICE_ACCOUNT_JSON` 負責 Play 上傳。iOS 使用 `BUILD_CERTIFICATE_BASE64`、`P12_PASSWORD`、`BUILD_PROVISION_PROFILE_BASE64`、`KEYCHAIN_PASSWORD`，保留 `Github Actions` profile 與 team `FJX3SGU9AL`。TestFlight 使用既有 `APPSTORE_API_PRIVATE_KEY` secret、`APPSTORE_ISSUER_ID` 與 `APPSTORE_API_KEY_ID` variables。建置也需要前述 API 設定。原生簽署流程可參考 [Expo release build 文件](https://docs.expo.dev/guides/local-app-production/)。

iOS 發佈另需 `BUILD_WIDGET_PROVISION_PROFILE_BASE64`，內容為 `org.capacitor.quasar.ckapp.ExpoWidgetsTarget` 的 App Store distribution 描述檔。先註冊 `group.org.capacitor.quasar.ckapp` 並在主程式與小工具的 App ID 啟用，再重新產生兩份描述檔。既有主程式描述檔 secret 也須更新，並保留 production Push Notifications。CI 會驗證兩份描述檔、分別簽署兩個目標，將小工具隨 App 一起匯出。

## 發布更新前必須完成的項目

**舊版資料匯入需要實機驗證。** 新版 Zustand 使用 Expo SQLite，與舊版 Capacitor WebView 的 localStorage 分開。`src/features/legacy-import` 會在首次啟動時以隱藏 WebView 讀取舊版的待辦、活動、課表修改、班級、最愛、釘選、追蹤車站與設定，轉換後合併到新版（不覆蓋新版已建立的資料），詳見 [docs/native-rewrite-progress.md](docs/native-rewrite-progress.md)。正式提供既有使用者更新前，必須在 Android 與 iOS 上以實際的舊版（例如 3.4.0）安裝、建立資料後升級，確認資料完整匯入。

網路來源首次讀取失敗且沒有快取時，功能會顯示錯誤／空白狀態。商店簽署、舊版資料匯入與雙平台實機操作仍需要完整發布驗證。

## 貢獻與聯絡

請先閱讀 [貢獻指南](CONTRIBUTING.md)。官方 Gmail：ckappofficial@gmail.com；[Instagram](https://www.instagram.com/ckappofficial/)；[官方網站](https://ckapp-tw.web.app/)。
