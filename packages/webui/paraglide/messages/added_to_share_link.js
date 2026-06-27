/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Added_To_Share_LinkInputs */

const en_added_to_share_link = /** @type {(inputs: Added_To_Share_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Added to share link`)
};

const zh_added_to_share_link = /** @type {(inputs: Added_To_Share_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`已添加到分享链接`)
};

/**
* | output |
* | --- |
* | "Added to share link" |
*
* @param {Added_To_Share_LinkInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const added_to_share_link = /** @type {((inputs?: Added_To_Share_LinkInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Added_To_Share_LinkInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_added_to_share_link(inputs)
	return zh_added_to_share_link(inputs)
});