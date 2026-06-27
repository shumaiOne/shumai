/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Successfully_Moved_ItemsInputs */

const en_successfully_moved_items = /** @type {(inputs: Successfully_Moved_ItemsInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Successfully moved ${i?.count} item(s)`)
};

const zh_successfully_moved_items = /** @type {(inputs: Successfully_Moved_ItemsInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`成功移动了 ${i?.count} 个项目`)
};

/**
* | output |
* | --- |
* | "Successfully moved {count} item(s)" |
*
* @param {Successfully_Moved_ItemsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const successfully_moved_items = /** @type {((inputs: Successfully_Moved_ItemsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Successfully_Moved_ItemsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_successfully_moved_items(inputs)
	return zh_successfully_moved_items(inputs)
});