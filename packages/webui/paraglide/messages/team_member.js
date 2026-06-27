/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Team_MemberInputs */

const en_team_member = /** @type {(inputs: Team_MemberInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Team Member`)
};

const zh_team_member = /** @type {(inputs: Team_MemberInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`团队成员`)
};

/**
* | output |
* | --- |
* | "Team Member" |
*
* @param {Team_MemberInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const team_member = /** @type {((inputs?: Team_MemberInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Team_MemberInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_team_member(inputs)
	return zh_team_member(inputs)
});