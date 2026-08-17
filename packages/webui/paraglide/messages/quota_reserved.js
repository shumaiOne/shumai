/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_ReservedInputs */

const en_quota_reserved = /** @type {(inputs: Quota_ReservedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Reserved`)
};

const zh_quota_reserved = /** @type {(inputs: Quota_ReservedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已预留`)
};

/**
* | output |
* | --- |
* | "Reserved" |
*
* @param {Quota_ReservedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_reserved = /** @type {((inputs?: Quota_ReservedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_ReservedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_reserved(inputs)
	return zh_quota_reserved(inputs)
});