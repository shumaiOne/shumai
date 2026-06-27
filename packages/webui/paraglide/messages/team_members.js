/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Team_MembersInputs */

const en_team_members = /** @type {(inputs: Team_MembersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Team Members`)
};

const zh_team_members = /** @type {(inputs: Team_MembersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`团队成员`)
};

/**
* | output |
* | --- |
* | "Team Members" |
*
* @param {Team_MembersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const team_members = /** @type {((inputs?: Team_MembersInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Team_MembersInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_team_members(inputs)
	return zh_team_members(inputs)
});