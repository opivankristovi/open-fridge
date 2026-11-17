# Open Fridge

An Android app for tracking what's in a shared household fridge. You scan a product's barcode, take a photo and set its expiry date, and the app warns you before something goes off. Fresh produce and opened packages are tracked by how long they've been in the fridge or open. The app's UI is in Dutch.

## 1. Supabase (one-time setup)

1. Create a free project at <https://supabase.com>.
2. Open **SQL Editor**, paste the whole of `supabase/migrations/0001_init.sql`, and click **Run**. This creates the tables, the security rules (row-level security), and the private `photos` bucket.
3. Go to **Project Settings → API** and copy the **Project URL** and the **publishable / anon key**.
4. Copy `.env.example` to `.env` and fill both values in. The anon key is meant to sit in the app; the database rules protect your data. Never put the `service_role` key in the app.
5. Optional: if you don't want to confirm accounts by email, turn off **Authentication → Sign In / Providers → Email → Confirm email**.

## 2. Run on your phone (development)

```bash
npm install
npx expo start
```

Install **Expo Go** from the Play Store, then scan the QR code (phone and PC must be on the same Wi-Fi). If a firewall blocks it, use `npx expo start --tunnel`.

Expo Go is fine for trying out scanning, the list and sharing. Background re-sync does not run in Expo Go, and notifications are limited there, so test notifications with the APK (step 3).

## 3. Installable APK

```bash
npm install -g eas-cli
eas login

eas build -p android --profile preview
```

`eas.json` is already set up so the `preview` profile builds an APK. Builds run in the cloud, and EAS asks you to set the `.env` values as EAS environment variables (`eas env:create`).

## How it works

- **Households:** the first person creates one, and the others join with the 6-character code shown under *Instellingen*.
- **Expiry:** the earliest of three dates counts:
  - the printed date
  - the opened date plus the "houdbaar na openen" days
  - for products without a printed date, the date added plus the "vers" days

  Defaults per category can be changed in *Instellingen*.
- **Notifications** are local on each phone. They're scheduled at your chosen hour, *n* days before an item expires and again on its last day. They re-sync whenever the app opens, whenever a household member changes something (realtime), and about every 12 hours in the background.

## Development

```bash
npm test
npx tsc --noEmit
npx expo-doctor
```
