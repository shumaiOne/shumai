/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ current: NonNullable<unknown>, total: NonNullable<unknown> }} Page_InfoInputs */

const en_page_info = /** @type {(inputs: Page_InfoInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Page ${i?.current} of ${i?.total}`)
};

const zh_page_info = /** @type {(inputs: Page_InfoInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`第 ${i?.current} 页，共 ${i?.total} 页`)
};

/**
* | output |
* | --- |
* | "Page {current} of {total}" |
*
* @param {Page_InfoInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const page_info = /** @type {((inputs: Page_InfoInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Page_InfoInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_page_info(inputs)
	return zh_page_info(inputs)
});