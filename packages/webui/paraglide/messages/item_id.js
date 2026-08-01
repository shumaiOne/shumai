/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Item_IdInputs */

const en_item_id = /** @type {(inputs: Item_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Item ID`)
};

const zh_item_id = /** @type {(inputs: Item_IdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`条目 ID`)
};

/**
* | output |
* | --- |
* | "Item ID" |
*
* @param {Item_IdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const item_id = /** @type {((inputs?: Item_IdInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Item_IdInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_item_id(inputs)
	return zh_item_id(inputs)
});