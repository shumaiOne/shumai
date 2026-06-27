/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Move_To_TrashInputs */

const en_failed_move_to_trash = /** @type {(inputs: Failed_Move_To_TrashInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to move to trash`)
};

const zh_failed_move_to_trash = /** @type {(inputs: Failed_Move_To_TrashInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`移至回收站失败`)
};

/**
* | output |
* | --- |
* | "Failed to move to trash" |
*
* @param {Failed_Move_To_TrashInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_move_to_trash = /** @type {((inputs?: Failed_Move_To_TrashInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Move_To_TrashInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_move_to_trash(inputs)
	return zh_failed_move_to_trash(inputs)
});