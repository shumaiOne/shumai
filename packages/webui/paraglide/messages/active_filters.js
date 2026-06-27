/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Active_FiltersInputs */

const en_active_filters = /** @type {(inputs: Active_FiltersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`active`)
};

const zh_active_filters = /** @type {(inputs: Active_FiltersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`个激活`)
};

/**
* | output |
* | --- |
* | "active" |
*
* @param {Active_FiltersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const active_filters = /** @type {((inputs?: Active_FiltersInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Active_FiltersInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_active_filters(inputs)
	return zh_active_filters(inputs)
});