/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Select_Block_To_EditInputs */

const en_select_block_to_edit = /** @type {(inputs: Select_Block_To_EditInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Select a block to edit its properties`)
};

const zh_select_block_to_edit = /** @type {(inputs: Select_Block_To_EditInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`选择一个水印块以编辑其属性`)
};

/**
* | output |
* | --- |
* | "Select a block to edit its properties" |
*
* @param {Select_Block_To_EditInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const select_block_to_edit = /** @type {((inputs?: Select_Block_To_EditInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Select_Block_To_EditInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_select_block_to_edit(inputs)
	return zh_select_block_to_edit(inputs)
});