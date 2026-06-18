import type { Env } from '@saas/config'

declare global {
  namespace NodeJS {
    interface ProcessEnv extends Env {}
  }
}

export {}