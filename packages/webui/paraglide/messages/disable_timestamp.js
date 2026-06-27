/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Disable_TimestampInputs */

const en_disable_timestamp = /** @type {(inputs: Disable_TimestampInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Disable Timestamp`)
};

const zh_disable_timestamp = /** @type {(inputs: Disable_TimestampInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`禁用时间戳`)
};

/**
* | output |
* | --- |
* | "Disable Timestamp" |
*
* @param {Disable_TimestampInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const disable_timestamp = /** @type {((inputs?: Disable_TimestampInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Disable_TimestampInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_disable_timestamp(inputs)
	return zh_disable_timestamp(inputs)
});