# Mobile EAS upload configuration

2 November 2026: Agent production build failed during upload because the archive
was 5 GB, exceeding the 2 GB limit. The repository contains unrelated website,
backend, output and large local QA/emulator files. EAS uses the Git repository
root when archiving from either mobile app directory.

The root `.easignore` now includes only `agent-app` and `delivery-app`, excluding
dependencies, generated Expo/native/build directories and local credentials.
Both applications are self-contained; source, assets, lockfiles, `.npmrc`, build
configuration and Agent `patch-package` patches remain included. Production API
configuration comes from each app's `eas.json`. No runtime or VPS changes.

Verified with EAS CLI 27.2.0 `build:inspect --stage archive` from `agent-app`:
250 files, 12.28 MiB uncompressed and approximately 10.93 MiB gzip. Compared
tracked app/source/assets/patch/scripts and required build files with the local
originals by hash. Confirmed no backend, website, output, local `.env`,
dependencies or generated native folders in the archive. Windows directory
rules intentionally omit trailing slashes so directory entries themselves are
excluded or re-included correctly. No cloud build was launched by inspection.

From either mobile app directory:

```sh
npx eas-cli@latest build --platform android --profile production
```

For archive inspection only, choose an output path outside the included app
trees that does not already exist:

```sh
npx eas-cli@latest build:inspect --platform android --profile production --stage archive --output ../FrontEnd/.admin-audit.local/eas-archive-check
```

Do not add secrets to the archive. If future mobile code depends on another
workspace/package, explicitly include it and recheck archive contents before
building. See [Expo archive rules](https://docs.expo.dev/build-reference/easignore/).
