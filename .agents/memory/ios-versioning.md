---
name: iOS release versioning
description: How native iOS marketing versions are set during the generated Capacitor build.
---

Set the iOS marketing version with `agvtool new-marketing-version` in the Codemagic pipeline after Capacitor creates and syncs the Xcode project. Keep the visible app version and this marketing version aligned; continue to use the CI build number as the distinct build number.

**Why:** Capacitor's generated iOS project otherwise retains its default marketing version. App Store Connect rejects uploads when `CFBundleShortVersionString` is not higher than the version already approved, even if the in-app text has been updated.

**How to apply:** For each App Store release, increment the pipeline's marketing version before running the archive step, and use a new CI build number for subsequent uploads of the same release version.