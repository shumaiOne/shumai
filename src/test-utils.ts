import { AsyncLocalStorage } from 'node:async_hooks'
import { Prisma } from '@shumai/db'

type PromiseResolveFunction = (value: void | PromiseLike<void>) => void
const internalRollbackErrorSymbol = Symbol(
  'Internal transactional-prisma-testing rollback error symbol',
)

const MAX_ACTIVE_SAVEPOINTS = 56

export class PrismaTestingHelper<
  T extends {
    $transaction(arg: unknown[], options?: unknown): Promise<unknown>
    $transaction<TR>(fn: (client: unknown) => Promise<TR>, options?: unknown): Promise<TR>
  },
> {
  private readonly proxyClient: T
  private currentPrismaTransactionClient?: Prisma.TransactionClient
  private endCurrentTransactionPromise?: (value?: unknown) => void
  private savepointId = 0
  private transactionLock: Promise<void> | null = null
  private readonly asyncLocalStorage = new AsyncLocalStorage<{
    transactionSavepoint: string
  }>()

  constructor(private readonly prismaClient: T) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const prismaTestingHelper = this
    this.proxyClient = new Proxy(prismaClient, {
      get(target, prop, receiver) {
        if (prismaTestingHelper.currentPrismaTransactionClient == null) {
          return Reflect.get(target, prop, receiver)
        }

        const descriptor = Object.getOwnPropertyDescriptor(target, prop)
        if (descriptor && !descriptor.configurable && !descriptor.writable) {
          return Reflect.get(target, prop, receiver)
        }

        if (prop === '$transaction') {
          return prismaTestingHelper.transactionProxyFunction.bind(prismaTestingHelper)
        }

        // accessing arbitrary properties on transaction client requires any cast
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((prismaTestingHelper.currentPrismaTransactionClient as any)[prop] != null) {
          const ret = Reflect.get(
            prismaTestingHelper.currentPrismaTransactionClient,
            prop,
            receiver,
          )
          if (
            typeof ret === 'object' &&
            ret !== null &&
            'findFirst' in ret &&
            typeof ret.findFirst === 'function'
          ) {
            return prismaTestingHelper.getPrismaDelegateProxy(ret)
          }
          return ret
        }
        return Reflect.get(target, prop, receiver)
      },
    })
  }

  private getPrismaDelegateProxy<TU extends object>(original: TU): TU {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const prismaTestingHelper = this
    const prismaDelegateProxy = new Proxy(original, {
      get(_, prop, receiver) {
        const originalReturnValue = Reflect.get(original, prop, receiver)
        if (typeof originalReturnValue !== 'function') {
          return originalReturnValue
        }

        const originalFunction = originalReturnValue as (...args: unknown[]) => Promise<unknown>
        return (...args: unknown[]) => {
          const catchCallbacks: Array<(reason: unknown) => unknown> = []
          const finallyCallbacks: Array<() => unknown> = []
          const returnedPromise = {
            // reject must be any per Promise signature
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            then: async (resolve: PromiseResolveFunction, reject: any) => {
              try {
                const isInTransaction =
                  prismaTestingHelper.asyncLocalStorage.getStore()?.transactionSavepoint != null
                if (!isInTransaction) {
                  const value = await prismaTestingHelper.wrapInSavepoint(() =>
                    originalFunction.apply(prismaDelegateProxy, args),
                  )
                  // resolve requires any cast to match expected type
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  return resolve(value as any)
                }

                const value = await originalFunction.apply(prismaDelegateProxy, args)
                // resolve requires any cast to match expected type
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return resolve(value as any)
              } catch (e) {
                try {
                  let error = e
                  for (const catchCallback of catchCallbacks) {
                    error = await catchCallback(error)
                  }
                  if (reject) {
                    reject(error)
                  } else {
                    return Promise.reject(error)
                  }
                } catch (innerError) {
                  if (reject) {
                    reject(innerError)
                  } else {
                    return Promise.reject(innerError)
                  }
                }
              } finally {
                finallyCallbacks.forEach((c) => c())
              }
            },
            catch: (callback: (reason: unknown) => unknown) => {
              catchCallbacks.push(callback)
              return returnedPromise
            },
            finally: (callback: () => unknown) => {
              finallyCallbacks.push(callback)
              return returnedPromise
            },
          }

          return returnedPromise
        }
      },
    })

    return prismaDelegateProxy
  }

  private async transactionProxyFunction(args: unknown): Promise<unknown> {
    return this.wrapInSavepoint(async () => {
      if (Array.isArray(args)) {
        const ret = []
        for (const query of args) {
          ret.push(await query)
        }
        return ret
      } else if (typeof args === 'function') {
        return args(this.currentPrismaTransactionClient)
      } else {
        throw new Error(
          '[transactional-prisma-testing] Invalid $transaction call. Argument must be an array or a callback function.',
        )
      }
    })
  }

  private async wrapInSavepoint<T>(func: () => Promise<T>): Promise<T> {
    const transactionClient = this.currentPrismaTransactionClient
    const isInTransaction = this.asyncLocalStorage.getStore()?.transactionSavepoint != null
    let lockResolve = undefined
    if (!isInTransaction) {
      lockResolve = await this.acquireTransactionLock()
    }

    try {
      if (transactionClient == null) {
        throw new Error(
          '[transactional-prisma-testing] Invalid call to $transaction while no transaction is active.',
        )
      }

      if (transactionClient !== this.currentPrismaTransactionClient) {
        throw new Error(
          '[transactional-prisma-testing] Transaction client changed (and old transaction rollbacked) before query could be executed.',
        )
      }

      const savepointIdToRelease = this.savepointId - MAX_ACTIVE_SAVEPOINTS
      if (savepointIdToRelease >= 0 && savepointIdToRelease % MAX_ACTIVE_SAVEPOINTS === 0) {
        try {
          await transactionClient.$executeRawUnsafe(
            `RELEASE SAVEPOINT trnsctl_tst_${savepointIdToRelease}`,
          )
        } catch {
          // ignore release errors
        }
      }

      const savepointName = `trnsctl_tst_${this.savepointId++}`
      try {
        await transactionClient.$executeRawUnsafe(`SAVEPOINT ${savepointName}`)
        return await this.asyncLocalStorage.run({ transactionSavepoint: savepointName }, func)
      } catch (err) {
        await transactionClient?.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepointName}`)
        throw err
      }
    } finally {
      this.transactionLock = null
      lockResolve?.()
    }
  }

  private async acquireTransactionLock(): Promise<PromiseResolveFunction> {
    while (this.transactionLock != null) {
      await this.transactionLock
    }
    let lockResolve!: PromiseResolveFunction
    this.transactionLock = new Promise((resolve) => {
      lockResolve = resolve
    })
    return lockResolve
  }

  public getProxyClient(): T {
    return this.proxyClient
  }

  public async startNewTransaction(opts?: { timeout?: number; maxWait?: number }): Promise<void> {
    if (this.endCurrentTransactionPromise != null) {
      throw new Error(
        '[transactional-prisma-testing] rollbackCurrentTransaction must be called before starting a new transaction',
      )
    }
    this.savepointId = 0
    return new Promise((resolve) => {
      this.prismaClient
        .$transaction(
          async (prisma) => {
            this.currentPrismaTransactionClient = prisma as Prisma.TransactionClient | undefined
            await new Promise((innerResolve) => {
              this.endCurrentTransactionPromise = innerResolve
              resolve()
            })
            throw internalRollbackErrorSymbol
          },
          { ...opts, timeout: 30000 },
        )
        .catch((error) => {
          if (error !== internalRollbackErrorSymbol) {
            throw error
          }
        })
    })
  }

  public rollbackCurrentTransaction(): void {
    if (this.endCurrentTransactionPromise == null) {
      throw new Error('[transactional-prisma-testing] No transaction currently active')
    }
    this.endCurrentTransactionPromise()
    this.endCurrentTransactionPromise = undefined
  }
}
