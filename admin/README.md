# CK APP 公告管理網站

獨立的 React / TypeScript / Vite 專案，輸出為 `dist/`，部署至 [GitHub Pages](https://ChrisSun0731.github.io/CK-App-Admin/)。公告寫入與 App 共用的 `announcements` Firestore collection，擁有者可另在帳戶管理頁邀請公告管理員。它是獨立的網站專案，不會為 App 使用者新增登入流程。

## 開發與驗證

```sh
npm ci
npm test
npm run build
npm run dev
```

在獨立的 `ChrisSun0731/CK-App-Admin` 倉庫根目錄執行以上指令；若使用 App 倉庫的來源，先進入 `admin/`。

網站預設使用使用者提供的 `src/firebase-config.json` 公開 Firebase Web 設定（`ck-app-database`）；不使用 Analytics。切換專案時，修改該公開設定，或複製 `.env.example` 為 `.env.local` 並設定 `VITE_FIREBASE_*` 覆寫值。環境變數在建置時寫入，改動後須重新建置部署。這些是公開瀏覽器設定；服務帳戶私鑰不得放入網站。

## GitHub Pages 部署

1. 將本網站目錄的來源置於 `ChrisSun0731/CK-App-Admin` 倉庫根目錄（`package.json`、`src/`、`index.html` 與 `.github/workflows/pages.yml` 均在根目錄）；不包含 `node_modules/`、`dist/`、本機環境檔或 `.openai/`。
2. 在 GitHub 倉庫 Settings → Pages → Build and deployment 選擇 **GitHub Actions**。
3. 推送至 `main`，或手動執行 **Deploy admin website to GitHub Pages** 工作流程。它會安裝依賴、執行測試、建置、上傳 `dist/` 並部署至 `github-pages` environment。
4. 工作流程以 `actions/configure-pages` 的 `base_path` 設定 Vite 的 `ADMIN_BASE_PATH`，支援 `/CK-App-Admin/` 子路徑與自訂網域。手動建置可執行 `ADMIN_BASE_PATH=/CK-App-Admin/ npm run build`；本機預設 `/`。
5. 確認 Firebase Authorized domains 包含 `chrissun0731.github.io`；授權的是主機名稱，不包含路徑。

工作流程使用官方 `checkout@v7`、`setup-node@v7`、`configure-pages@v5`、`upload-pages-artifact@v4`、`deploy-pages@v4`。參考 [GitHub Pages 自訂工作流程](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)、[checkout](https://github.com/actions/checkout/releases) 與 [setup-node](https://github.com/actions/setup-node/releases)。網站建置與部署不需要 Firebase 服務帳戶；排程發布程式的憑證另行設定，不能放入公開設定或網站產物。

## 登入與管理員權限

1. 在 Firebase Console → Authentication → Sign-in method 啟用 Google，設定專案支援電子郵件。
2. 在 Authentication → Settings → Authorized domains 加入 `chrissun0731.github.io`。若保留其他網站鏡像，也需各別加入其網域。本機開發另加入 `localhost` 與 `127.0.0.1`；新專案可能不會自動授權本機網域。
3. 首位擁有者先使用 Google 登入以建立 Firebase Auth 帳戶；尚未授權或邀請的帳戶只會看到權限不足畫面。
4. 專案管理者從可信任的伺服器，使用 Firebase Admin SDK 為擁有者 UID 同時設定自訂宣告 `admin: true`、`accountManager: true`。後端專案提供授權腳本；網站無法自行授予這兩個角色，也不會根據電子郵件網域授權。
5. 完成擁有者授權後，在權限不足畫面點選「重新確認權限」或重新登入；已登入的網站右上角也有重新確認權限按鈕。更新後，上方會出現「帳戶管理」頁籤。只有 `admin` 與 `accountManager` 兩個宣告都為布林值 `true` 才能管理邀請。
6. 一般公告管理員由擁有者在「帳戶管理」輸入 Google 電子郵件邀請，不需要另行設定 custom claims。網站會監聽該已驗證 Google 帳戶自己的邀請資料；實際讀寫權限仍由後端 Firestore Rules 保護。

一般登入使用 Google 彈出式視窗。若瀏覽器阻擋，畫面會引導允許視窗後重試。`VITE_FIREBASE_ENABLE_REDIRECT=true` 可開啟整頁登入備援按鈕，但 **啟用前必須先依 Firebase 的第三方儲存限制指南完成同源 auth helper、反向代理或對應 Firebase Hosting 設定**。一般 GitHub Pages 靜態網域不會自動提供 `/__/auth/*` helper，因此預設關閉整頁登入。詳見 [Google 登入文件](https://firebase.google.com/docs/auth/web/google-signin)、[redirect 設定指南](https://firebase.google.com/docs/auth/web/redirect-best-practices)及 [custom claims](https://firebase.google.com/docs/auth/admin/custom-claims)。

## 帳戶管理與邀請

- 擁有者可在「帳戶管理」新增邀請、篩選已啟用或已停用的邀請、編輯顯示名稱、停用或重新啟用權限，以及確認後移除邀請。
- 邀請建立的是登入資格，不會寄送電子郵件，也不會預先建立 Firebase Authentication 使用者。請自行將網站連結提供給對方；受邀者首次以該 Google 帳戶登入時，才會建立登入帳戶。
- 電子郵件會去除前後空格並轉為小寫，最多 254 個字元；不接受路徑、控制字元、內部空白或無效格式。Google 郵件的點號與 `+` 別名不會被合併，必須填入登入後實際顯示的電子郵件。
- 顯示名稱可空白，最多 120 個字元，只用於邀請名單，不會變更對方的 Google 個人資料。
- 一般受邀管理員只能管理公告，不能讀取其他邀請、邀請別人、修改自己的權限或設定密碼。
- 對只透過邀請授權的管理員，停用或移除邀請會立即撤銷資料庫的管理權限；網站收到自己的邀請變更後會清除公告編輯與管理畫面。移除邀請不會刪除 Google 帳戶、Firebase Authentication 使用者或既有公告。
- 目前擁有者以受保護卡片顯示，不列為一般受邀管理員，也不能邀請自己。擁有者原本的專案角色獨立於邀請名單，不會因停用或移除邀請而失去權限；變更擁有者角色須由可信任的 Firebase Admin 環境處理。

邀請儲存在 `adminAccounts/{normalizedLowercaseEmail}`，文件 ID 與 `email` 相同：

```ts
{
  email: string,
  displayName: string,
  enabled: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdBy: string // 邀請擁有者的 Firebase Auth UID
}
```

新增邀請以伺服器時間設定 `createdAt` / `updatedAt`；更新僅改動顯示名稱或啟用狀態與 `updatedAt`，保留原始電子郵件、建立時間與建立者。

## 公告流程

- 標題最多 120 個字元，純文字內容最多 10,000 個字元，延伸連結可空白或使用 HTTPS，最多 2,048 個字元。
- 日期時間輸入一律以 `Asia/Taipei`（UTC+8）解讀，與管理員瀏覽器的時區無關。
- 「儲存草稿」建立或更新 `draft`，不會自動發布。
- 「排程發布」儲存 `scheduled` 與未來的 `publishAt`。
- 「立即發布」也儲存 `scheduled`，`publishAt` 設為現在；網站不直接設定 `published`，由可信任的排程後端發布與推播。
- 後端以 GitHub Actions 排程約每 5 分鐘檢查到期公告並設定 `published` / `publishedAt`，App 會取得已發布公告並收到裝置通知（取決於裝置授權、連線與系統投遞情況）。GitHub 排程可能延遲或略過，無法保證精確發布時間；「立即發布」也會等待下一輪排程。詳見 [GitHub 排程事件限制](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)。
- 公開倉庫若連續 60 天沒有倉庫活動，GitHub 會自動停用排程工作流程；專案管理者須定期確認 Actions 執行紀錄，停用時從 Actions 重新啟用。詳見 [排程自動停用條件](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)。
- 只有草稿及排程公告可編輯；已發布公告只能封存。封存時僅更新 `status` 與 `updatedAt`。
- 公告列表即時同步最近 200 則資料；數字統計也以這 200 則為範圍。沒有示範或假資料。
- 同時編輯時，儲存前會檢查 `updatedAt`，避免覆寫其他管理員已完成的變更。

Firestore schema：

```ts
{
  title: string,
  body: string,
  url: string,
  status: 'draft' | 'scheduled' | 'published' | 'archived',
  publishAt: Timestamp,
  publishedAt: Timestamp | null,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  createdBy: string // Firebase Auth UID
}
```

新建公告使用伺服器時間設定 `createdAt` / `updatedAt`，`publishedAt` 為 `null`。規則、排程發布與裝置推播功能位於 `firebase/`（App 倉庫為根目錄 `firebase/`，獨立網站倉庫亦放在 `firebase/`）。Firestore Rules 需部署、排程工作流程需另外設定可信任憑證；只發布這個靜態網站不會啟用排程。此方案不使用 Cloud Functions。
