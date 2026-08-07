/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Position_YInputs */

const en_position_y = /** @type {(inputs: Position_YInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Position Y (%)`)
};

const zh_position_y = /** @type {(inputs: Position_YInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`垂直位置 (%)`)
};

/**
* | output |
* | --- |
* | "Position Y (%)" |
*
* @param {Position_YInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const position_y = /** @type {((inputs?: Position_YInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Position_YInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_position_y(inputs)
	return zh_position_y(inputs)
});