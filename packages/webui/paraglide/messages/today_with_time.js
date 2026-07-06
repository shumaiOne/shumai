/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ time: NonNullable<unknown> }} Today_With_TimeInputs */

const en_today_with_time = /** @type {(inputs: Today_With_TimeInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Today ${i?.time}`)
};

const zh_today_with_time = /** @type {(inputs: Today_With_TimeInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`今天 ${i?.time}`)
};

/**
* | output |
* | --- |
* | "Today {time}" |
*
* @param {Today_With_TimeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const today_with_time = /** @type {((inputs: Today_With_TimeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Today_With_TimeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_today_with_time(inputs)
	return zh_today_with_time(inputs)
});