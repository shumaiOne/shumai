/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ActivityInputs */

const en_activity = /** @type {(inputs: ActivityInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Activity`)
};

const zh_activity = /** @type {(inputs: ActivityInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`活动`)
};

/**
* | output |
* | --- |
* | "Activity" |
*
* @param {ActivityInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const activity = /** @type {((inputs?: ActivityInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ActivityInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_activity(inputs)
	return zh_activity(inputs)
});