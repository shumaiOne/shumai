/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} ChangeInputs */

const en_change = /** @type {(inputs: ChangeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Change`)
};

const zh_change = /** @type {(inputs: ChangeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`更改`)
};

/**
* | output |
* | --- |
* | "Change" |
*
* @param {ChangeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const change = /** @type {((inputs?: ChangeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<ChangeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_change(inputs)
	return zh_change(inputs)
});