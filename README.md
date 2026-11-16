# SpendSnap PWA

A lightweight, mobile-first expense tracker designed for GitHub Pages.

## Included
- Five quick-entry categories: Online Orders, Petrol, Bike Expense, Food, Other Expense
- Dashboard totals for today and the current month
- Recent activity, searchable history, category summary
- Local device storage (localStorage)
- CSV export
- PWA manifest, app icon and offline service worker

## Deploy to GitHub Pages
1. Create a new GitHub repository.
2. Upload all four files from this folder to the repository root.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select `main` and `/ (root)`, then Save.
6. Open the published HTTPS URL on your Android phone in Chrome.
7. Choose **Install app** or **Add to Home screen** from Chrome's menu.

## Notes
- Expenses are stored only in the browser on this device. Clearing site data can erase them.
- Export a CSV backup from the Summary screen periodically.
- GitHub Pages must be accessed over HTTPS for PWA installation and service worker support.
