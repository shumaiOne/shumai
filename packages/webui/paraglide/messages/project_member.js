/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Project_MemberInputs */

const en_project_member = /** @type {(inputs: Project_MemberInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Project Member`)
};

const zh_project_member = /** @type {(inputs: Project_MemberInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`项目成员`)
};

/**
* | output |
* | --- |
* | "Project Member" |
*
* @param {Project_MemberInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const project_member = /** @type {((inputs?: Project_MemberInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Project_MemberInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_project_member(inputs)
	return zh_project_member(inputs)
});