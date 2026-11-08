# Contributing to Ludok Count

Thanks for wanting to help. This guide explains how to set up the environment, how the code is
organized and what's expected from a pull request.

## How to Contribute

- **Code changes: straight to a pull request.** No need to open an issue first, not even for big
  changes. Explain in the PR what changes and why.
- **Public issues: only for bugs and ideas.** For a bug, say what you did, what you expected and
  what happened, with the app and Android versions.
- **Vulnerabilities: never in an issue.** Follow [SECURITY.md](SECURITY.md) to report them
  privately.

Before pasting logs, screenshots or a JSON backup, **remove personal data**: your Nextcloud address
and user, and your friends' names and amounts if they'd rather not appear.

## Environment

You need Node 22, JDK 17, the Android SDK with API 36 and `adb`.

```bash
git clone https://github.com/iamLudok/Ludok-count.git
cd Ludok-count
npm install
npm run android      # installs and opens it on a phone connected over adb
```

The app uses Expo SDK 57, which changes a lot between versions: check the docs for
[that exact version](https://docs.expo.dev/versions/v57.0.0/), not the latest.

## Before Sending the PR

```bash
npm run typecheck
npm run verify
```

Both have to pass. `verify` runs the same data code that runs on the phone against a desktop
SQLite; if your change adds a rule, also add a case to the matching file in `verify/`.

## Conventions

- **The app's interface and code comments are in Spanish**; the docs (README, CONTRIBUTING,
  SECURITY) are in English.
- **Comments explain why, not what.** If something is done in an odd way, explain what happened
  when doing it the normal way.
- TypeScript `strict`, **no semicolons** and single quotes.
- **No em dashes** (the U+2014 character) in texts or comments: use `: `, parentheses or two
  sentences.
- Colors, sizes and spacing come from [`src/ui/theme.ts`](src/ui/theme.ts), never eyeballed in a
  component.
- **Money is always whole cents.** Use the helpers in [`src/lib/money.ts`](src/lib/money.ts) to
  parse, format and split amounts; never floats.
- **No dependencies that aren't needed** and no background tasks: periodic work happens when the
  app is opened, closed or brought back.

## Where Things Go

- `expo-sqlite` is imported **only** in [`src/lib/db.ts`](src/lib/db.ts). The rest of the logic
  gets the database from [`src/lib/dbRef.ts`](src/lib/dbRef.ts); that's what makes it testable in
  Node.
- Business rules go in `src/lib/` (`money.ts`, `expenses.ts`, `sushi.ts`, `drinks.ts`, `mus.ts`,
  `people.ts`), and screens only call them.
- Counters that get tapped quickly are updated with a single SQL statement, not read-then-write:
  see `mus.ts` for why.
- The Nextcloud password lives in the phone's `settings` table. **Never** in the code, in
  `app.json` or in exported backups.

## Adding a Field or a Table

1. `src/types.ts`: the field, **optional** if it goes into backups.
2. `src/lib/schema.ts`: the Drizzle column or table.
3. `src/lib/schemaSql.ts`: the change in `CREATE_SQL` (which always describes the full schema, for
   new installs) **and** a new entry at the end of `MIGRATIONS` (for existing ones). Never touch
   `CREATE_SQL` without adding the step, and never edit a migration that has been released.
4. `src/lib/rows.ts`: the mapping in both directions.
5. `src/lib/backupCore.ts`, so it's exported and restored. `verify:data` fails if a table is left
   out of the backup.
6. A case in `verify/migration.ts` and, if it goes into backups, in `verify/data.ts`.

The backup format **only grows**: optional fields can be added, but existing ones can't be removed
or changed, because that would leave saved backups behind.

## PR Checklist

- [ ] `npm run typecheck` and `npm run verify` pass.
- [ ] If the data changes: a new migration, old backups still import, and there's a case in
      `verify/`.
- [ ] Interface texts and comments in Spanish, no em dashes.
- [ ] Tested on a real phone or emulator if it touches the interface.
- [ ] The README still tells the truth.

## License

By contributing you agree that your code is published under the project's
[MIT License](LICENSE).
