/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} HomeInputs */

const en_home = /** @type {(inputs: HomeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Home`)
};

const zh_home = /** @type {(inputs: HomeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`主页`)
};

/**
* | output |
* | --- |
* | "Home" |
*
* @param {HomeInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const home = /** @type {((inputs?: HomeInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<HomeInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_home(inputs)
	return zh_home(inputs)
});