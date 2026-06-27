/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Fetch_Share_LinkInputs */

const en_failed_fetch_share_link = /** @type {(inputs: Failed_Fetch_Share_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to fetch share link`)
};

const zh_failed_fetch_share_link = /** @type {(inputs: Failed_Fetch_Share_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`获取分享链接失败`)
};

/**
* | output |
* | --- |
* | "Failed to fetch share link" |
*
* @param {Failed_Fetch_Share_LinkInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_fetch_share_link = /** @type {((inputs?: Failed_Fetch_Share_LinkInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Fetch_Share_LinkInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_fetch_share_link(inputs)
	return zh_failed_fetch_share_link(inputs)
});