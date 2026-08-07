/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Dark_GridInputs */

const en_dark_grid = /** @type {(inputs: Dark_GridInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Dark Grid`)
};

const zh_dark_grid = /** @type {(inputs: Dark_GridInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`深色网格`)
};

/**
* | output |
* | --- |
* | "Dark Grid" |
*
* @param {Dark_GridInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const dark_grid = /** @type {((inputs?: Dark_GridInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Dark_GridInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_dark_grid(inputs)
	return zh_dark_grid(inputs)
});