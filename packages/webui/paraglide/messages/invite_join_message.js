/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ inviterName: NonNullable<unknown>, targetName: NonNullable<unknown>, role: NonNullable<unknown> }} Invite_Join_MessageInputs */

const en_invite_join_message = /** @type {(inputs: Invite_Join_MessageInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.inviterName} invited you to join ${i?.targetName} as ${i?.role}.`)
};

const zh_invite_join_message = /** @type {(inputs: Invite_Join_MessageInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.inviterName} 邀请您加入 ${i?.targetName}，角色为 ${i?.role}。`)
};

/**
* | output |
* | --- |
* | "{inviterName} invited you to join {targetName} as {role}." |
*
* @param {Invite_Join_MessageInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const invite_join_message = /** @type {((inputs: Invite_Join_MessageInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Invite_Join_MessageInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_invite_join_message(inputs)
	return zh_invite_join_message(inputs)
});