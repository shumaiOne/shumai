/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Team_Member_To_Project_HintInputs */

const en_add_team_member_to_project_hint = /** @type {(inputs: Add_Team_Member_To_Project_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Team members already have access to all projects with their default team role. Set a custom role for this specific project here.`)
};

const zh_add_team_member_to_project_hint = /** @type {(inputs: Add_Team_Member_To_Project_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`团队成员默认使用其团队角色访问所有项目。您可以在此为其设置独立的项目角色。`)
};

/**
* | output |
* | --- |
* | "Team members already have access to all projects with their default team role. Set a custom role for this specific project here." |
*
* @param {Add_Team_Member_To_Project_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_team_member_to_project_hint = /** @type {((inputs?: Add_Team_Member_To_Project_HintInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Team_Member_To_Project_HintInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_add_team_member_to_project_hint(inputs)
	return zh_add_team_member_to_project_hint(inputs)
});