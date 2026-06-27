/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} All_Share_LinksInputs */

const en_all_share_links = /** @type {(inputs: All_Share_LinksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`All Share Links`)
};

const zh_all_share_links = /** @type {(inputs: All_Share_LinksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`所有分享链接`)
};

/**
* | output |
* | --- |
* | "All Share Links" |
*
* @param {All_Share_LinksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const all_share_links = /** @type {((inputs?: All_Share_LinksInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<All_Share_LinksInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_all_share_links(inputs)
	return zh_all_share_links(inputs)
});