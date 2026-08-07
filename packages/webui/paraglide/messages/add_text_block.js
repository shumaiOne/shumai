/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Text_BlockInputs */

const en_add_text_block = /** @type {(inputs: Add_Text_BlockInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Add Text Block`)
};

const zh_add_text_block = /** @type {(inputs: Add_Text_BlockInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`添加文本块`)
};

/**
* | output |
* | --- |
* | "Add Text Block" |
*
* @param {Add_Text_BlockInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_text_block = /** @type {((inputs?: Add_Text_BlockInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Text_BlockInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_add_text_block(inputs)
	return zh_add_text_block(inputs)
});