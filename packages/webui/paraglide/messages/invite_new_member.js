/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Invite_New_MemberInputs */

const en_invite_new_member = /** @type {(inputs: Invite_New_MemberInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Invite New Member`)
};

const zh_invite_new_member = /** @type {(inputs: Invite_New_MemberInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`邀请新成员`)
};

/**
* | output |
* | --- |
* | "Invite New Member" |
*
* @param {Invite_New_MemberInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const invite_new_member = /** @type {((inputs?: Invite_New_MemberInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Invite_New_MemberInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_invite_new_member(inputs)
	return zh_invite_new_member(inputs)
});