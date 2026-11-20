# Open Fridge

Open Fridge is an Android app that keeps track of what is in your fridge. You scan a product's barcode, take a photo, enter the date printed on the package, and the app warns you before the food goes off. Several people can share one fridge, each on their own phone.

Android only (iOS is not configured or tested). The app interface is in Dutch.

## Features

- Scan a barcode with the camera. The product name, brand and picture are looked up on Open Food Facts.
- Take a photo of the item.
- Set the printed expiry date with a date picker.
- Fresh products and opened packages are tracked by days in the fridge or days since opening. Each category has a default number of days, and you can change these defaults per household. For opened packages you can also choose "tot datum op verpakking" (until the date on the package).
- The list is sorted by expiry date and uses colours to show the status of each item.
- Local notifications before an item expires. You choose how many days before and at what time, per phone.
- History of what you ate and what you threw away.
- Households: several phones share one fridge using a 6-character invite code. Data is stored in Supabase (accounts, database with row-level security, realtime updates, private photo storage).
- Dark mode: Systeem, Licht or Donker, chosen per phone.

## What it costs

For normal household use, nothing.

- **Supabase** (database, accounts, photo storage): the free plan needs no payment card. It includes about 500 MB of database and 1 GB of file storage. Free projects are paused after about a week without activity. If that happens, open the Supabase dashboard and click the restore button. No data is lost.
- **Open Food Facts** (product data): free, and no API key is needed.
- **Notifications**: they are created on each phone. No push notification service is used, so there is nothing to pay for.
- **EAS Build** (building the APK in the cloud): the free Expo plan includes a limited number of builds per month.

## Build your own copy

These steps assume you have never built an app before. You will end up with an APK file (an installable Android app) that talks to your own free Supabase project.

### 1. What you need

- [Node.js](https://nodejs.org) (the LTS version)
- [git](https://git-scm.com)
- A free [Supabase](https://supabase.com) account
- A free [Expo](https://expo.dev) account
- An Android phone

Windows note: if PowerShell says that running scripts is disabled when you use `npx`, type `npx.cmd` instead of `npx` in every command below.

### 2. Get the code

```bash
git clone https://github.com/opivankristovi/open-fridge.git
cd open-fridge
npm install
```

### 3. Set up Supabase

1. In Supabase, create a new project. Pick any name and region, and save the database password somewhere safe.
2. Open **SQL Editor** in the left menu. Open the file `supabase/migrations/0001_init.sql` from this repository, copy all of it, paste it into the editor and click **Run**. Do this once. It creates the tables, the security rules and the private `photos` storage bucket.
3. Go to **Authentication**, then **Sign In / Providers**, then **Email**, and turn **off** "Confirm email". The app has no screen for handling confirmation links. With the setting on, the link in the email opens `localhost` on your phone and fails. Turning it off is safe: row-level security means an account can only see the households it belongs to, so a fake email address gives access to nothing.
4. Go to **Project Settings**, then **API Keys**, and note two values:
   - **Project URL**: the base address, like `https://xxxx.supabase.co`. Do not use the one ending in `/rest/v1/`.
   - **Publishable key**: starts with `sb_publishable_`. If your project shows the older "anon" key instead, that works too.

Warning: never put the **secret** key or the `service_role` key in the app or in `.env`. Those keys bypass all security rules. Only the publishable (anon) key is meant to be inside an app.

### 4. Add your keys

Copy `.env.example` to `.env` and fill in both values:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

The `.env` file is listed in `.gitignore`, so it is not committed to git.

### 5. Try it in Expo Go (optional)

1. Install the **Expo Go** app from the Play Store.
2. Start the development server:

   ```bash
   npx expo start
   ```

3. Scan the QR code with Expo Go. The phone and the PC must be on the same Wi-Fi network. If a firewall blocks the connection, try `npx expo start --tunnel`.

Expo Go is fine for trying out scanning, the list and sharing. Background re-sync and some notification behaviour are only reliable in a real build (next step).

### 6. Build an installable APK with EAS

1. Log in to your Expo account:

   ```bash
   npx eas-cli@latest login
   ```

2. Open `app.json` and delete two things. They belong to the original author's Expo account and will make the build fail for you:
   - the line `"owner": "opivankristovi"` (and the comma before it, so the JSON stays valid)
   - the `"eas": { "projectId": "..." }` block inside `"extra"` (keep the rest of `"extra"`)
3. Link the project to your own Expo account:

   ```bash
   npx eas-cli@latest init
   ```

4. Give the build your two Supabase values. The `.env` file is not uploaded to the cloud build, so store them as EAS environment variables for the `preview` environment (the `preview` profile in `eas.json` uses it). Use `--visibility plaintext`, because these values end up inside the app anyway:

   ```bash
   npx eas-cli@latest env:set preview --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxxx.supabase.co" --visibility plaintext
   npx eas-cli@latest env:set preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "sb_publishable_..." --visibility plaintext
   ```

   Older versions of EAS CLI call this command `env:create` (same arguments).
5. Start the build:

   ```bash
   npx eas-cli@latest build -p android --profile preview
   ```

   The build runs in the cloud and can take several minutes. When it finishes, EAS prints a link. Open it and download the `.apk`.

Optional: the app's Android package name is `be.openfridge.app` (`android.package` in `app.json`). Change it if you want your build to be installable next to someone else's build of the same app. Do this before the first build.

## Installing the APK on a phone

For the people who will use the app:

1. Copy or download the `.apk` file to the phone and open it from the Files app.
2. When Android asks, allow "install unknown apps" for the app you opened the file from (for example Files or Chrome).
3. If Google Play Protect warns about an unknown developer, tap **More details**, then **Install anyway**.

First use:

1. Create an account with any email address and a password.
2. One person creates a household. Everyone else chooses "Deelnemen met code" and types the 6-character code shown in **Instellingen** on the first phone.
3. Allow the camera when you add your first item, and allow notifications. Without that permission there are no expiry warnings.

## How it works

For developers.

### Data model (Supabase)

The schema is in `supabase/migrations/0001_init.sql`.

- `households`: name and invite code.
- `household_members`: which user belongs to which household (role `owner` or `member`).
- `items`: the products in the fridge, including status (`in_fridge`, `consumed`, `discarded`), expiry date, opened date and shelf-life days.
- `household_products`: a shared memory of products by barcode.
- `household_settings`: per-household category defaults, stored as JSON.

Security:

- Row-level security is on for every table. A row is visible only to members of its household, checked by the security-definer function `is_member(household_id)`.
- Households are created and joined only through the functions `create_household`, `join_household` and `regenerate_invite_code`. Direct inserts into `households` and `household_members` are not allowed.
- Photos go in the private `photos` bucket at the path `{household_id}/{item_id}.jpg`. Storage policies check that the first path segment is a household you belong to.
- Realtime is enabled on `items`, so other phones see changes immediately.

### Expiry and notifications

- The expiry date of an item is the earliest of: the printed date, the opened date plus the days after opening, and the date added plus the days for fresh products. See `src/domain/expiry.ts`.
- Notifications are scheduled locally on each phone. They are re-planned when the app starts, when it comes to the foreground, when items change, and about every 12 hours by a background task (`expo-background-task`).

### Project structure

```
src/
  app/          screens and navigation (Expo Router): login, register, household, tabs, add, item
  components/   reusable UI parts
  data/         Supabase queries, React Query hooks, realtime, local preferences
  domain/       plain logic without UI: expiry rules, categories, formatting
  services/     Open Food Facts lookup, photos, notifications, scheduling, background sync
  auth/         login state
  lib/          Supabase client, query client, error helpers
  i18n/         Dutch texts
  types/        database types
  theme.ts      light and dark colours
supabase/
  migrations/   database setup SQL
```

## Development

```bash
npx tsc --noEmit      # type check
npx jest              # unit tests
npx expo lint         # lint
npx expo-doctor       # check dependencies and config
```

Add packages with `npx expo install <package>` instead of `npm install <package>`. It picks the version that matches the Expo SDK (this project uses Expo SDK 58).

## Licence

Open Fridge is free software, released under the GNU General Public License version 3 or later (GPL-3.0-or-later). See the `LICENSE` file.

Copyright (C) 2026 opivankristovi

Product data comes from [Open Food Facts](https://world.openfoodfacts.org), which is available under the Open Database License (ODbL).
