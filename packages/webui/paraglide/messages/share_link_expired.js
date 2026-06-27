/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Share_Link_ExpiredInputs */

const en_share_link_expired = /** @type {(inputs: Share_Link_ExpiredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This share link has expired`)
};

const zh_share_link_expired = /** @type {(inputs: Share_Link_ExpiredInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`此分享链接已过期`)
};

/**
* | output |
* | --- |
* | "This share link has expired" |
*
* @param {Share_Link_ExpiredInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const share_link_expired = /** @type {((inputs?: Share_Link_ExpiredInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Share_Link_ExpiredInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_share_link_expired(inputs)
	return zh_share_link_expired(inputs)
});