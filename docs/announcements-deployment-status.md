# Announcement deployment status

Verified on 2026-10-12 (Asia/Taipei).

- Firebase project: `ck-app-database` (`253500838094`); billing enabled.
- Cloud Run service: `ck-announcements`, `us-central1`.
- Ready revision: `ck-announcements-00001-9zb`, serving all traffic.
- Source: Notification commit `d8d49213427ef421a217ddf6a15f82dd207ea0bf`.
- Image build: `1da22d27-6a75-4ed0-aa27-a9678f6e10c1` (successful).
- Public worker endpoint: `https://ck-announcements-soumqsptrq-uc.a.run.app/run`.
- Runtime identity: `ck-announcements@ck-app-database.iam.gserviceaccount.com`.
- Minimum instances: 0; maximum instances: 1; request CPU allocation enabled.
- Firebase ID-token verification and current administrator membership authorize work.
- Cloud Scheduler API remains disabled. Remote GitHub announcement workflow allows manual dispatch only.
- GitHub repository variable `VITE_ANNOUNCEMENTS_WORKER_URL` points to this endpoint.

Live endpoint verification returned 204 for CORS preflight, 401 for missing/invalid tokens, and 403 for the wrong origin. These requests stop before worker execution. No announcement publication or push delivery was triggered during setup. Real publication remains an explicit administrator action.

Admin website deployment: [Pages run 38207863286](https://github.com/CKApp-Dev/Notification/actions/runs/38207863286) completed successfully. The live `https://notification.cksc.tw/assets/index-DDbkgyIV.js` bundle was verified to contain the configured worker endpoint at 13:26 (Asia/Taipei).

Future publication times do not create automatic jobs. Due announcements, delivery retries and delayed receipt checks require a later explicit processing action. Successful processing does not guarantee device display.
