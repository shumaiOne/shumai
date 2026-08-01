/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} TimestampInputs */

const en_timestamp = /** @type {(inputs: TimestampInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Timestamp`)
};

const zh_timestamp = /** @type {(inputs: TimestampInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`时间戳`)
};

/**
* | output |
* | --- |
* | "Timestamp" |
*
* @param {TimestampInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const timestamp = /** @type {((inputs?: TimestampInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<TimestampInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_timestamp(inputs)
	return zh_timestamp(inputs)
});