import { describe, expect, it } from "bun:test"
import plugin, { InjectSessionIdPlugin } from "../src/index.js"

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

/** Minimal async event stream backing `ctx.event.subscribe`. */
function createEventStream() {
  const buffer: unknown[] = []
  let closed = false
  let wake: (() => void) | undefined

  return {
    push(event: unknown) {
      buffer.push(event)
      wake?.()
    },
    close() {
      closed = true
      wake?.()
    },
    async *[Symbol.asyncIterator]() {
      while (!closed || buffer.length > 0) {
        if (buffer.length === 0) {
          await new Promise<void>((resolve) => {
            wake = resolve
          })
          continue
        }
        yield buffer.shift()
      }
    },
  }
}

describe("default export", () => {
  it("serves V1 server and V2 setup from one object", () => {
    expect(plugin.id).toBe("inject-session-id")
    expect(plugin.server).toBe(InjectSessionIdPlugin)
    expect(typeof plugin.setup).toBe("function")
  })
})

describe("V1 server", () => {
  it("injects the session ID into shell.env", async () => {
    const hooks = await InjectSessionIdPlugin({} as never)
    await hooks.event?.({ event: { type: "session.idle", properties: { sessionID: "ses_v1" } } } as never)

    const output = { env: {} as Record<string, string | undefined> }
    await hooks["shell.env"]?.({} as never, output)
    expect(output.env.OPENCODE_SESSION_ID).toBe("ses_v1")
  })
})

describe("V2 setup", () => {
  it("tracks the session ID and injects it into shell env", async () => {
    const stream = createEventStream()
    const hooks: Record<string, (event: { env: Record<string, string | undefined> }) => void> = {}
    let aborted = false

    const ctx = {
      event: {
        subscribe(options?: { signal?: AbortSignal }) {
          options?.signal?.addEventListener("abort", () => {
            aborted = true
            stream.close()
          })
          return stream
        },
      },
      shell: {
        hook: async (name: string, callback: (event: { env: Record<string, string | undefined> }) => void) => {
          hooks[name] = callback
          return { dispose: async () => {} }
        },
      },
    } as unknown as Parameters<typeof plugin.setup>[0]

    const cleanup = await plugin.setup(ctx)

    stream.push({ type: "session.created", data: { sessionID: "ses_v2" } })
    await tick()

    const output = { env: {} as Record<string, string | undefined> }
    hooks["create.before"]?.(output)
    expect(output.env.OPENCODE_SESSION_ID).toBe("ses_v2")

    cleanup?.()
    expect(aborted).toBe(true)
  })

  it("clears the env value when no session ID is known", async () => {
    const hooks: Record<string, (event: { env: Record<string, string | undefined> }) => void> = {}
    const ctx = {
      event: { subscribe: () => createEventStream() },
      shell: {
        hook: async (name: string, callback: (event: { env: Record<string, string | undefined> }) => void) => {
          hooks[name] = callback
          return { dispose: async () => {} }
        },
      },
    } as unknown as Parameters<typeof plugin.setup>[0]

    await plugin.setup(ctx)

    const output = { env: { OPENCODE_SESSION_ID: "stale" } }
    hooks["create.before"]?.(output)
    expect(output.env.OPENCODE_SESSION_ID).toBeUndefined()
  })
})
