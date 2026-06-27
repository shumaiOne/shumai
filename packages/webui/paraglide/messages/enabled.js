/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} EnabledInputs */

const en_enabled = /** @type {(inputs: EnabledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Enabled`)
};

const zh_enabled = /** @type {(inputs: EnabledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已启用`)
};

/**
* | output |
* | --- |
* | "Enabled" |
*
* @param {EnabledInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const enabled = /** @type {((inputs?: EnabledInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<EnabledInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_enabled(inputs)
	return zh_enabled(inputs)
});