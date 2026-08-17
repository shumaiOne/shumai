/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_ConsumedInputs */

const en_quota_consumed = /** @type {(inputs: Quota_ConsumedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Consumed`)
};

const zh_quota_consumed = /** @type {(inputs: Quota_ConsumedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已消耗`)
};

/**
* | output |
* | --- |
* | "Consumed" |
*
* @param {Quota_ConsumedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_consumed = /** @type {((inputs?: Quota_ConsumedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_ConsumedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_consumed(inputs)
	return zh_quota_consumed(inputs)
});