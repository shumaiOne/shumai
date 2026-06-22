export class ShareLinkNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShareLinkNotFoundError'
    Object.setPrototypeOf(this, ShareLinkNotFoundError.prototype)
  }
}

export class ShareLinkDisabledError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShareLinkDisabledError'
    Object.setPrototypeOf(this, ShareLinkDisabledError.prototype)
  }
}

export class ShareLinkExpiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShareLinkExpiredError'
    Object.setPrototypeOf(this, ShareLinkExpiredError.prototype)
  }
}

export class ShareLinkPasswordInvalidError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ShareLinkPasswordInvalidError'
    Object.setPrototypeOf(this, ShareLinkPasswordInvalidError.prototype)
  }
}
