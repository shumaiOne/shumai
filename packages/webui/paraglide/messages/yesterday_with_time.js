/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ time: NonNullable<unknown> }} Yesterday_With_TimeInputs */

const en_yesterday_with_time = /** @type {(inputs: Yesterday_With_TimeInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Yesterday ${i?.time}`)
};

const zh_yesterday_with_time = /** @type {(inputs: Yesterday_With_TimeInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`昨天 ${i?.time}`)
};

/**
* | output |
* | --- |
* | "Yesterday {time}" |
*
* @param {Yesterday_With_TimeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const yesterday_with_time = /** @type {((inputs: Yesterday_With_TimeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Yesterday_With_TimeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_yesterday_with_time(inputs)
	return zh_yesterday_with_time(inputs)
});