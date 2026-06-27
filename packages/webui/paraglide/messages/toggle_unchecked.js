/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Toggle_UncheckedInputs */

const en_toggle_unchecked = /** @type {(inputs: Toggle_UncheckedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Unchecked`)
};

const zh_toggle_unchecked = /** @type {(inputs: Toggle_UncheckedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未选中`)
};

/**
* | output |
* | --- |
* | "Unchecked" |
*
* @param {Toggle_UncheckedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const toggle_unchecked = /** @type {((inputs?: Toggle_UncheckedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Toggle_UncheckedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_toggle_unchecked(inputs)
	return zh_toggle_unchecked(inputs)
});