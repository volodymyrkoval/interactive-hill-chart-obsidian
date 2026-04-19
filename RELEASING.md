# Releasing

## Steps

1. **Bump versions** in three files:
   - `manifest.json` → `"version": "X.Y.Z"`
   - `package.json` → `"version": "X.Y.Z"`
   - `versions.json` → add `"X.Y.Z": "1.4.0"` (minAppVersion stays `1.4.0` unless you raise the floor)

2. **Commit and push** on `main`:
   ```
   git commit -m "chore: bump version to X.Y.Z"
   git push origin main
   ```

3. **Tag and push** — this triggers CI:
   ```
   git tag X.Y.Z
   git push origin X.Y.Z
   ```
   Tag name must match `manifest.json.version` exactly (no `v` prefix — Obsidian registry requirement).

4. **CI does the rest:** installs deps, verifies the tag matches `manifest.json.version`, runs `npm run build`, and uploads `main.js`, `manifest.json`, and `styles.css` as release assets on a new GitHub release named `X.Y.Z`.

5. **Manual fallback** (if CI fails): run `npm run build` locally, then create the release and upload the three files via the GitHub UI.
