# mlai-sansoni

This repository holds the Sansoni member app and is hosted at [Sansoni-Management-Dev-Team/asgimaster-app](https://github.com/Sansoni-Management-Dev-Team/asgimaster-app).

| Folder        | What it is                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------- |
| `apps/mobile` | The iOS and Android app, built with Expo and React Native.                                  |
| `apps/api`    | The backend, a TypeScript Hono server that runs in a container.                             |
| `docs`        | Product behaviour and design. Start with [feature specifications](docs/features/README.md). |

The apps are npm workspaces, so there is one `package-lock.json` at the root.

The [feature specifications](docs/features/README.md) describe required behaviour and acceptance criteria. The [high-level designs](docs/hldd/README.md) describe the design choices and constraints that support them.

For Linear access, use the native `linear` CLI with a repository `.linear.toml` selecting the workspace and the key stored in the system keyring. See the [Linear CLI setup](docs/linear.md).

## Getting started

There are two interfaces: a **staff website** for invitations, and the **member app** for iOS and Android. Start with the staff website below; you can use it without building the mobile app.

### What you need

- **Node.js 24** and npm. Check with `node --version`.
- **Docker Desktop**, installed and running. It provides the local database and email inbox.
- For the iPhone simulator: **a Mac with Xcode**. Open Xcode once to finish its setup and install an iOS simulator.
- For Android instead: **Android Studio** with a running emulator.

Local setup uses test accounts and captures email on your computer. You do not need AWS credentials, SES or a production database.

### First-time setup

Open a terminal in this repository's root folder. Run all commands below from there.

Install the packages and start the database and captured-email inbox:

```sh
npm install
npm run auth:up
```

Create your local API settings. Do this once; keep your existing file on later runs.

```sh
cp apps/api/.env.example apps/api/.env.local
```

The example contains local-only settings. `.env.local` files are ignored by Git. Keep real credentials out of source control.

Create the database tables and the two example accounts:

```sh
npm run api:migrate
npm run api:bootstrap -- staff --email reviewer@example.test --name 'Local staff' --role admin
npm run api:bootstrap -- member-fixture --email journey@example.test --name 'Journey' --actor-email reviewer@example.test
```

The staff account can manage invitations. The member account is for trying the member app. Provision these accounts once; you can keep using them on subsequent runs.

### Open the staff website

Start the API and leave this terminal running:

```sh
npm run api:dev
```

Open [the staff website](http://localhost:8789/admin). Enter `reviewer@example.test` and request a code. Open [the captured-email inbox](http://localhost:58029), find the newest code for that address, and enter it on the staff website.

These example addresses do not have real inboxes. All their messages appear in the captured-email inbox. The website provides the invitation tools; the member Home and Profile are in the native app.

### Open the member app

In a second terminal at the repository root, configure the app to use your local API:

```sh
printf 'EXPO_PUBLIC_API_URL=http://localhost:8789\n' > apps/mobile/.env.local
npm run ios
```

The first iOS build can take several minutes. It creates and installs a development build in the simulator. The app needs this native build for its storage modules.

Sign in as `journey@example.test`. Request an email code, then get it from [the captured-email inbox](http://localhost:58029). You can view Home/Profile, save onboarding answers and reopen the app to see them restored. Membership access displays as being set up; real entitlements are outside this local slice.

For Android, boot an emulator, run these commands, then use the same member account:

```sh
adb reverse tcp:8789 tcp:8789
adb reverse tcp:8081 tcp:8081
npm run android
```

After changing `EXPO_PUBLIC_API_URL`, restart the mobile development server. Leaving that setting absent opens the separate prototype experience instead of the connected member app.

### Starting again and stopping

On later days, start Docker Desktop, run `npm run auth:up`, then keep `npm run api:dev` running in one terminal. Run `npm start` in another and press **i** to open the installed iOS app. Rebuild with `npm run ios` or `npm run android` after native dependency/configuration changes.

To stop, press **Ctrl+C** in each development-server terminal, then run:

```sh
npm run auth:down
```

This stops the local database and inbox containers while retaining the database volume for the next session.

### If something does not work

- **Docker command fails:** open Docker Desktop, wait until it is running, then retry `npm run auth:up`.
- **A port is already in use:** another local server or Docker project may be running. Stop the copy you no longer need. The database/inbox ports can be changed with `AUTH_DB_PORT`, `AUTH_SMTP_PORT` and `AUTH_MAIL_PORT` when starting the containers; update the matching API settings and inbox URL too. Use the same `AUTH_COMPOSE_PROJECT` if you selected a custom project when stopping them.
- **No email code:** check the captured-email inbox and the address you entered. Use a provisioned account and the newest code. Keep the API running so it can deliver queued messages locally.
- **Staff form is rejected:** open the exact address configured in `BETTER_AUTH_URL`, then reload the form. Restart the API after changing that setting.
- **The app shows the prototype or cannot connect:** check `apps/mobile/.env.local`, keep the API running and restart Metro after changing the API URL. On a physical phone, `localhost` refers to the phone; use the computer's reachable address.
- **Native module is missing:** rebuild with `npm run ios` or `npm run android`. Restarting Metro alone cannot install a new native dependency.

See the [API README](apps/api/README.md) for backend details and the [device-testing skill](.agents/skills/device-testing/SKILL.md) for simulator/emulator commands.

## Checks

These scripts run in every workspace that defines them.

```sh
npm run lint
npm run typecheck
npm test
npm run format     # Prettier for the whole repository
```

## CI

GitHub Actions runs `.github/workflows/ci.yml` on every pull request and on pushes to every branch. It runs these checks:

- Lint, typecheck and tests for both apps.
- A build of the API container.

## API deployment

AWS resources are defined in [infra/](infra/README.md) with Terragrunt. The current environment is `develop` in account `806968064090`, region `ap-southeast-2`.

The [deploy workflow](.github/workflows/main.yml) uses Sansoni's shared actions and maps `main` to staging and `production` to production. Relevant pushes trigger it; pull requests run CI without deploying. Release readiness includes restore evidence and configured database/auth/email settings. A database snapshot and a successful one-off migration precede the service update; failure retains recovery references and prevents that update. See the workflow and [migration entrypoint](apps/api/scripts/migrate-ecs.mjs) for authoritative inputs and automation.

The API's probes are independent of database availability. A healthy probe alone is not evidence that authentication, email or database access works. Local setup and capture-mail verification are described in the [API README](apps/api/README.md). Live deployment and infrastructure apply require the user's instruction.

Each folder has its own README with more detail:

- [apps/mobile/README.md](apps/mobile/README.md)
- [apps/api/README.md](apps/api/README.md)
