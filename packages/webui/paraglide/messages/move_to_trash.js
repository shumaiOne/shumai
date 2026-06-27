/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Move_To_TrashInputs */

const en_move_to_trash = /** @type {(inputs: Move_To_TrashInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Move to Trash`)
};

const zh_move_to_trash = /** @type {(inputs: Move_To_TrashInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`移至回收站`)
};

/**
* | output |
* | --- |
* | "Move to Trash" |
*
* @param {Move_To_TrashInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const move_to_trash = /** @type {((inputs?: Move_To_TrashInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Move_To_TrashInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_move_to_trash(inputs)
	return zh_move_to_trash(inputs)
});