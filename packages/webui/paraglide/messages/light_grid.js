/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Light_GridInputs */

const en_light_grid = /** @type {(inputs: Light_GridInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Light Grid`)
};

const zh_light_grid = /** @type {(inputs: Light_GridInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`浅色网格`)
};

/**
* | output |
* | --- |
* | "Light Grid" |
*
* @param {Light_GridInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const light_grid = /** @type {((inputs?: Light_GridInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Light_GridInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_light_grid(inputs)
	return zh_light_grid(inputs)
});