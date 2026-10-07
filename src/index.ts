import type { Hooks, Plugin } from "@opencode-ai/plugin"
import { Plugin as PluginV2 } from "@opencode/plugin"

const PLUGIN_ID = "inject-session-id"
const SESSION_ID_KEY = "sessionId"
const ENV_KEY = "OPENCODE_SESSION_ID"

/**
 * OpenCode V1 plugin factory: track the current session ID from events and
 * expose it to shell commands through `OPENCODE_SESSION_ID`.
 */
export const InjectSessionIdPlugin: Plugin = async () => {
  const sessionIds = new Map<string, string | undefined>()

  return {
    event: async ({ event }) => {
      if ((event.type === "session.created") || (event.type === "session.idle") || (event.type === "server.connected")) {
        sessionIds.set(SESSION_ID_KEY, (event.properties as { sessionID?: string }).sessionID)
      }
    },

    "shell.env": async (_input, output) => {
      const stored = sessionIds.get(SESSION_ID_KEY)
      if (stored === undefined) {
        delete output.env[ENV_KEY]
        return
      }
      output.env[ENV_KEY] = stored
    },
  } satisfies Hooks
}

/** Read the session ID out of a V2 event payload, if that event carries one. */
function sessionIdFromEvent(event: { data?: unknown }): string | undefined {
  const data = event.data
  if (typeof data !== "object" || data === null) return undefined
  const value = (data as { sessionID?: unknown }).sessionID
  return typeof value === "string" ? value : undefined
}

/**
 * OpenCode V2 plugin: `event` and `shell.env` do not exist, so subscribe to the
 * server event stream to track the current session ID and inject it from the
 * shell `create.before` hook.
 */
const v2Plugin = PluginV2.define({
  id: PLUGIN_ID,
  async setup(ctx) {
    let sessionId: string | undefined
    const controller = new AbortController()

    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
          const eventSessionId = sessionIdFromEvent(event)
          if (eventSessionId !== undefined) sessionId = eventSessionId
        }
      } catch {
        // The subscription ends when the plugin unloads or the server disconnects.
      }
    })()

    await ctx.shell.hook("create.before", (event) => {
      if (sessionId === undefined) {
        delete event.env[ENV_KEY]
        return
      }
      event.env[ENV_KEY] = sessionId
    })

    return () => controller.abort()
  },
})

// OpenCode V2 reads `id` and `setup`; V1 calls `server()` on the same object.
export default {
  ...v2Plugin,
  server: InjectSessionIdPlugin,
}
