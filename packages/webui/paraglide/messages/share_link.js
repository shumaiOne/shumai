/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Share_LinkInputs */

const en_share_link = /** @type {(inputs: Share_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`share link`)
};

const zh_share_link = /** @type {(inputs: Share_LinkInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`分享链接`)
};

/**
* | output |
* | --- |
* | "share link" |
*
* @param {Share_LinkInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const share_link = /** @type {((inputs?: Share_LinkInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Share_LinkInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_share_link(inputs)
	return zh_share_link(inputs)
});