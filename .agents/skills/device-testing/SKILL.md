---
name: device-testing
description: Run, look at and drive the Sansoni app on the iOS Simulator, the Android emulator, web and a real iPhone, and run the Maestro smoke test. Use when you need to see a change working in the app, take a screenshot, tap through a screen, check a layout on a device, or run `npm run e2e`.
---

# Device testing

Use this to check your work in the running app as you build. Unit tests stay in Jest. The Maestro flows in `apps/mobile/.maestro` are a small smoke test, not a full suite. Add a flow only for a path that matters end to end.

All commands run from the repository root unless noted. Simulator, emulator, device and Metro commands need to run outside the Bash sandbox, because the sandbox blocks the services they talk to.

## Environment

Set these in any shell that builds Android or runs Maestro. `npm run e2e` sets `JAVA_HOME` itself.

```sh
export JAVA_HOME="$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8   # CocoaPods fails without a UTF-8 locale
```

## Start Metro

```sh
cd apps/mobile && npx expo start --dev-client --port 8081
```

Run it in the background and keep it running. Do not set `CI=1`. That turns off file watching, so Metro keeps serving the old code and your edits never show up. Metro serves iOS, Android and web from the same port.

## Build the dev client

You only need to rebuild after a native change: a new native package, `app.json`, or a config plugin. JavaScript changes reach the app through Metro.

| Target           | Command (in `apps/mobile`)                         |
| ---------------- | -------------------------------------------------- |
| iOS Simulator    | `npx expo run:ios --no-bundler -d "iPhone 17 Pro"` |
| iPhone           | see Real iPhone below                              |
| Android emulator | `npx expo run:android --no-bundler`                |

Builds take several minutes, so run them in the background. If an iOS build fails with "sandbox is not in sync with the Podfile.lock", run `pod install` in `apps/mobile/ios` with the UTF-8 locale set.

Boot the emulator with `$ANDROID_HOME/emulator/emulator -avd Pixel_9 -gpu host -no-snapshot-save -no-audio -no-boot-anim`. Keep `-gpu host`. Without it, API 36 falls back to software rendering, and System UI keeps showing "isn't responding" dialogs that block tests. Once it has booted, run `adb reverse tcp:8081 tcp:8081` so the app can reach Metro on `localhost`.

## Run the smoke test

```sh
npm run e2e                     # the booted simulator or emulator
npm run e2e -- --device <id>    # when more than one is running
npm run e2e -- web              # web, in headless Chromium
```

Find device ids with `xcrun simctl list devices booted` and `adb devices`.

## Look at the app

- Screenshot on iOS: `xcrun simctl io booted screenshot "$TMPDIR/shot.png"`, then read the image.
- Screenshot on Android: `adb exec-out screencap -p > "$TMPDIR/shot.png"`.
- What is on screen: `maestro --device <id> hierarchy --compact`. This lists every label and id Maestro can match on, and is the quickest way to pick selectors.
- To tap through something by hand, write a short flow in `$TMPDIR` and run it with `maestro --device <id> test <file>`.
- Errors from the app show up in the Metro output.

## Writing flows

- Native flows run `clearState`, then start the app with `openLink` on the dev client link with `disableOnboarding=1`, then close the dev menu if it opens. Copy the start of `smoke.yaml`. Do not call `launchApp` before `openLink`: on Android the link arrives while the launcher is starting and gets dropped. Keep the Metro URL inside the link percent-encoded, because Android will not parse it otherwise.
- Put steps that every platform shares in `.maestro/shared` and call them with `runFlow`. Web flows live in `.maestro/web` because they start from a URL, not an app id.
- Choose selectors that work on every platform:
  - `testID` values show up as ids on iOS, Android and web.
  - Visible text matches on all of them, but web reports the text before CSS changes its case. Match headings with a case-insensitive pattern such as `'(?i)today'`.
  - `accessibilityLabel` is matched as text on iOS and Android, but as an id on web.
- Match what a user sees. Do not depend on layout or timing.

## Real iPhone

Maestro does not support real iPhones. Use the iPhone to check things by hand and for features that need real hardware, such as notifications, video, secure storage and performance.

The phone needs Developer Mode on. Check that it is connected with `xcrun devicectl list devices`.

Signing needs an Apple team (`ios.appleTeamId`) and a bundle identifier that team can register. Set these locally for your own team. Do not commit them.

`npx expo run:ios --device` fails because it does not let Xcode create a provisioning profile. Build and install by hand instead:

```sh
cd apps/mobile/ios
xcodebuild -workspace mlaisansoni.xcworkspace -scheme mlaisansoni -configuration Debug \
  -destination id=<udid> -derivedDataPath build -allowProvisioningUpdates build
xcrun devicectl device install app --device <udid> build/Build/Products/Debug-iphoneos/mlaisansoni.app
xcrun devicectl device process launch --device <udid> \
  --payload-url "exp+mlai-sansoni://expo-development-client/?url=http%3A%2F%2F<mac-lan-ip>%3A8081" <bundle-id>
```

If `xcodebuild` says "No Accounts" even though you are signed in to Xcode, open the workspace in the Xcode app once. Xcode then creates the profile and the command line build works. You need to do this again for each new bundle identifier.

The app can only be launched while the phone is unlocked. Set Auto-Lock to Never on a test phone.
