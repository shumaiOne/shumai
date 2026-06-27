/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Move_ToInputs */

const en_move_to = /** @type {(inputs: Move_ToInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Move to`)
};

const zh_move_to = /** @type {(inputs: Move_ToInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`移动到`)
};

/**
* | output |
* | --- |
* | "Move to" |
*
* @param {Move_ToInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const move_to = /** @type {((inputs?: Move_ToInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Move_ToInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_move_to(inputs)
	return zh_move_to(inputs)
});