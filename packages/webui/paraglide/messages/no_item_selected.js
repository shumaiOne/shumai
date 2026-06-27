/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Item_SelectedInputs */

const en_no_item_selected = /** @type {(inputs: No_Item_SelectedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No item selected`)
};

const zh_no_item_selected = /** @type {(inputs: No_Item_SelectedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未选择项目`)
};

/**
* | output |
* | --- |
* | "No item selected" |
*
* @param {No_Item_SelectedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_item_selected = /** @type {((inputs?: No_Item_SelectedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Item_SelectedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_item_selected(inputs)
	return zh_no_item_selected(inputs)
});