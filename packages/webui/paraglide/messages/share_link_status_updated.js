/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Share_Link_Status_UpdatedInputs */

const en_share_link_status_updated = /** @type {(inputs: Share_Link_Status_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Share link status updated`)
};

const zh_share_link_status_updated = /** @type {(inputs: Share_Link_Status_UpdatedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`分享链接状态已更新`)
};

/**
* | output |
* | --- |
* | "Share link status updated" |
*
* @param {Share_Link_Status_UpdatedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const share_link_status_updated = /** @type {((inputs?: Share_Link_Status_UpdatedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Share_Link_Status_UpdatedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_share_link_status_updated(inputs)
	return zh_share_link_status_updated(inputs)
});