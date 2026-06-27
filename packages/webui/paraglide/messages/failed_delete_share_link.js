/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_Delete_Share_LinkInputs */

const en_failed_delete_share_link = /** @type {(inputs: Failed_Delete_Share_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to delete share link`)
};

const zh_failed_delete_share_link = /** @type {(inputs: Failed_Delete_Share_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`删除分享链接失败`)
};

/**
* | output |
* | --- |
* | "Failed to delete share link" |
*
* @param {Failed_Delete_Share_LinkInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_delete_share_link = /** @type {((inputs?: Failed_Delete_Share_LinkInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_Delete_Share_LinkInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_delete_share_link(inputs)
	return zh_failed_delete_share_link(inputs)
});