/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Successfully_Copied_ItemsInputs */

const en_successfully_copied_items = /** @type {(inputs: Successfully_Copied_ItemsInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Successfully copied ${i?.count} item(s)`)
};

const zh_successfully_copied_items = /** @type {(inputs: Successfully_Copied_ItemsInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`成功复制了 ${i?.count} 个项目`)
};

/**
* | output |
* | --- |
* | "Successfully copied {count} item(s)" |
*
* @param {Successfully_Copied_ItemsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const successfully_copied_items = /** @type {((inputs: Successfully_Copied_ItemsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Successfully_Copied_ItemsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_successfully_copied_items(inputs)
	return zh_successfully_copied_items(inputs)
});