/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Project_Member_Role_TooltipInputs */

const en_project_member_role_tooltip = /** @type {(inputs: Project_Member_Role_TooltipInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Project-scoped member roles are managed within individual project settings`)
};

const zh_project_member_role_tooltip = /** @type {(inputs: Project_Member_Role_TooltipInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`项目成员的角色需在具体的项目设置中管理`)
};

/**
* | output |
* | --- |
* | "Project-scoped member roles are managed within individual project settings" |
*
* @param {Project_Member_Role_TooltipInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const project_member_role_tooltip = /** @type {((inputs?: Project_Member_Role_TooltipInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Project_Member_Role_TooltipInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_project_member_role_tooltip(inputs)
	return zh_project_member_role_tooltip(inputs)
});