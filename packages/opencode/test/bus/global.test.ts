import { describe, expect, test } from "bun:test"
import { GlobalBus, type GlobalEvent } from "../../src/bus/global"

describe("GlobalBus", () => {
  test("supports global event fanout above Node's default listener threshold", () => {
    const initial = GlobalBus.listenerCount("event")
    let received = 0
    const handlers = Array.from({ length: 25 }, () => (_event: GlobalEvent) => {
      received++
    })

    try {
      for (const handler of handlers) GlobalBus.on("event", handler)

      expect(GlobalBus.getMaxListeners()).toBe(0)

      GlobalBus.emit("event", { payload: { id: "evt-test" } })

      expect(received).toBe(handlers.length)
    } finally {
      for (const handler of handlers) GlobalBus.off("event", handler)
    }

    expect(GlobalBus.listenerCount("event")).toBe(initial)
  })
})
