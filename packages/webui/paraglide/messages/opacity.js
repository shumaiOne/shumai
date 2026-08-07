/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} OpacityInputs */

const en_opacity = /** @type {(inputs: OpacityInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Opacity`)
};

const zh_opacity = /** @type {(inputs: OpacityInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`透明度`)
};

/**
* | output |
* | --- |
* | "Opacity" |
*
* @param {OpacityInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const opacity = /** @type {((inputs?: OpacityInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<OpacityInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_opacity(inputs)
	return zh_opacity(inputs)
});