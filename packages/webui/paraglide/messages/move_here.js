/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Move_HereInputs */

const en_move_here = /** @type {(inputs: Move_HereInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Move Here`)
};

const zh_move_here = /** @type {(inputs: Move_HereInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`移动到此处`)
};

/**
* | output |
* | --- |
* | "Move Here" |
*
* @param {Move_HereInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const move_here = /** @type {((inputs?: Move_HereInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Move_HereInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_move_here(inputs)
	return zh_move_here(inputs)
});