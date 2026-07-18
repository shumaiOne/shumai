/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ current: NonNullable<unknown>, total: NonNullable<unknown> }} Page_Of_PagesInputs */

const en_page_of_pages = /** @type {(inputs: Page_Of_PagesInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Page ${i?.current} of ${i?.total}`)
};

const zh_page_of_pages = /** @type {(inputs: Page_Of_PagesInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`第 ${i?.current} / ${i?.total} 页`)
};

/**
* | output |
* | --- |
* | "Page {current} of {total}" |
*
* @param {Page_Of_PagesInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const page_of_pages = /** @type {((inputs: Page_Of_PagesInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Page_Of_PagesInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_page_of_pages(inputs)
	return zh_page_of_pages(inputs)
});