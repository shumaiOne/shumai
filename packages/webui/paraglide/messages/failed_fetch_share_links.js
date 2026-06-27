/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Fetch_Share_LinksInputs */

const en_failed_fetch_share_links = /** @type {(inputs: Failed_Fetch_Share_LinksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to fetch share links`)
};

const zh_failed_fetch_share_links = /** @type {(inputs: Failed_Fetch_Share_LinksInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`获取分享链接失败`)
};

/**
* | output |
* | --- |
* | "Failed to fetch share links" |
*
* @param {Failed_Fetch_Share_LinksInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_fetch_share_links = /** @type {((inputs?: Failed_Fetch_Share_LinksInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Fetch_Share_LinksInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_fetch_share_links(inputs)
	return zh_failed_fetch_share_links(inputs)
});