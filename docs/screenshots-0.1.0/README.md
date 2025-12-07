# Screenshots 0.1.0

Expected files:

- 01-login.png
- 02-dashboard.png
- 03-site-detail.png
- 04-device-detail-telemetry.png
- 05-device-detail-history.png
- 06-device-detail-last-command.png
- 07-alerts-list.png
- 08-alert-detail.png
- 09-profile.png
- 10-dashboard-offline.png (optional)

Capture commands (run while emulator is open and screen is on):
```bash
adb exec-out screencap -p > docs/screenshots-0.1.0/01-login.png
adb exec-out screencap -p > docs/screenshots-0.1.0/02-dashboard.png
# ...and so on for each page
```
