/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Invite_Link_CopiedInputs */

const en_invite_link_copied = /** @type {(inputs: Invite_Link_CopiedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Invite link copied to clipboard`)
};

const zh_invite_link_copied = /** @type {(inputs: Invite_Link_CopiedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`邀请链接已复制到剪贴板`)
};

/**
* | output |
* | --- |
* | "Invite link copied to clipboard" |
*
* @param {Invite_Link_CopiedInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const invite_link_copied = /** @type {((inputs?: Invite_Link_CopiedInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Invite_Link_CopiedInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_invite_link_copied(inputs)
	return zh_invite_link_copied(inputs)
});