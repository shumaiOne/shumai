/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} AppearanceInputs */

const en_appearance = /** @type {(inputs: AppearanceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Appearance`)
};

const zh_appearance = /** @type {(inputs: AppearanceInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`外观`)
};

/**
* | output |
* | --- |
* | "Appearance" |
*
* @param {AppearanceInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const appearance = /** @type {((inputs?: AppearanceInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<AppearanceInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_appearance(inputs)
	return zh_appearance(inputs)
});