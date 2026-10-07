# @hskksk/opencode-inject-session-id

OpenCode plugin that injects the session ID into the `OPENCODE_SESSION_ID` environment variable.

## Usage

Add this plugin to your OpenCode configuration to make the current session ID available as an environment variable in shell commands.

## Installation

```bash
npm install @hskksk/opencode-inject-session-id
```

## Compatibility

The same package works with both OpenCode generations. The default export has the
dual shape `{ id, setup, server }`:

- **V1** calls `server()` and uses the `event` and `shell.env` hooks.
- **V2** reads `id` and `setup()`, subscribes to the server event stream to track the
  session ID, and sets the variable from the shell `create.before` hook.

V1 object entrypoints require OpenCode `1.18.29` or newer.

## Development

```bash
bun install
bun run build
bun test
```

## CI and release

CI comes from the [hskksk/gh-actions](https://github.com/hskksk/gh-actions) reusable workflows:

| Workflow | Purpose |
| --- | --- |
| `.github/workflows/lint-pr.yml` | Conventional Commits on the PR title and on every commit |
| `.github/workflows/opencode.yml` | `/oc` commands on issues, PRs and comments |
| `.github/workflows/npm-release-staged.yml` | semantic-release → npm staged publish on `main` |

Releases read `.releaserc.json`, publish with `npm stage publish` (a human approves the staged
release in 2FA), and commit the version bump back to `main`. Toolchain versions are pinned in
`.mise.toml` (`node`, `bun`, `npm`).

## License

MIT
