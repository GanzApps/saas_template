// Hono type augmentation - fixes moduleResolution issues with bundler
import type { Env, Schema } from 'hono/dist/types/types'
import type { Hono as HonoClass } from 'hono/dist/types/hono'

declare module 'hono' {
  export { HonoClass as Hono }
  export * from 'hono/dist/types/types'
  export * from 'hono/dist/types/context'
  export * from 'hono/dist/types/request'
  export * from 'hono/dist/types/client'
}
