/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Position_XInputs */

const en_position_x = /** @type {(inputs: Position_XInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Position X (%)`)
};

const zh_position_x = /** @type {(inputs: Position_XInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`水平位置 (%)`)
};

/**
* | output |
* | --- |
* | "Position X (%)" |
*
* @param {Position_XInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const position_x = /** @type {((inputs?: Position_XInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Position_XInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_position_x(inputs)
	return zh_position_x(inputs)
});