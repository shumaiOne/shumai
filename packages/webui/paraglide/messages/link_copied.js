/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Link_CopiedInputs */

const en_link_copied = /** @type {(inputs: Link_CopiedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Link copied to clipboard`)
};

const zh_link_copied = /** @type {(inputs: Link_CopiedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`链接已复制到剪贴板`)
};

/**
* | output |
* | --- |
* | "Link copied to clipboard" |
*
* @param {Link_CopiedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const link_copied = /** @type {((inputs?: Link_CopiedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Link_CopiedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_link_copied(inputs)
	return zh_link_copied(inputs)
});