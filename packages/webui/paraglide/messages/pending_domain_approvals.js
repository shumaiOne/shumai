/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js'

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Pending_Domain_ApprovalsInputs */

const en_pending_domain_approvals =
  /** @type {(inputs: Pending_Domain_ApprovalsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`Pending Domain Approvals`)
  }

const zh_pending_domain_approvals =
  /** @type {(inputs: Pending_Domain_ApprovalsInputs) => LocalizedString} */ () => {
    return /** @type {LocalizedString} */ (`待审核域名`)
  }

/**
 * | output |
 * | --- |
 * | "Pending Domain Approvals" |
 *
 * @param {Pending_Domain_ApprovalsInputs} inputs
 * @param {{ locale?: "en" | "zh" }} options
 * @returns {LocalizedString}
 */
export const pending_domain_approvals =
  /** @type {((inputs?: Pending_Domain_ApprovalsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Pending_Domain_ApprovalsInputs, { locale?: "en" | "zh" }, {}>} */ (
    (inputs = {}, options = {}) => {
      const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
      if (locale === 'en') return en_pending_domain_approvals(inputs)
      return zh_pending_domain_approvals(inputs)
    }
  )
