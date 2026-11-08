# Security Policy

## Supported Versions

Only the `master` branch and the APK from the latest release are maintained. Security fixes ship
in a new release; older versions aren't patched.

## Reporting a Vulnerability

**Don't open a public issue.** Anyone can read issues, and describing the flaw there would hand
out the recipe to exploit it before a fix is released and people have updated.

Report it privately instead:

1. Go to the repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Explain what you found, how to reproduce it and what impact it has.

You'll get a reply within a week. If the issue is confirmed, it gets fixed, a release is published
and you're credited in its notes (unless you'd rather not be).

## In Scope

- The Nextcloud password ending up where it shouldn't: in exported backups, in logs, or sent to a
  service other than its own.
- A tampered JSON backup that corrupts or deletes data when imported, or executes anything.
- Flaws in how the app talks to Nextcloud (credentials, paths, certificates).
- Problems in `scripts/build-apk.sh` or in the signing setup.

## Out of Scope

- Flaws in third-party software: Nextcloud, Android or Expo. Report them to their maintainers.
- Attacks that require prior access to the unlocked phone, root, or a copy of the keystore.
- Using `http://` for Nextcloud: it's allowed on purpose for home servers.

## Hardening Your Installation

- **Use a Nextcloud app password**, not your account password (Personal settings → Security). If
  you lose your phone, revoke it there and nothing else is affected.
- **Use `https://`** for any Nextcloud reachable from outside your network.
- **Treat JSON backups as personal data**: they contain your friends' names, what they spent and
  who owes whom.
- **Only install APKs from the official release** or built by yourself. An APK signed with another
  key won't install on top, and uninstalling to install it deletes your data.
- **If you build it yourself**, keep `release.jks` and `keystore.properties` out of the repo
  (they're already in `.gitignore`) and with restricted permissions
  (`chmod 600 keystore.properties`).
- Keep Android up to date.
