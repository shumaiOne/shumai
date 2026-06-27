/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Project_MembersInputs */

const en_project_members = /** @type {(inputs: Project_MembersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Project Members`)
};

const zh_project_members = /** @type {(inputs: Project_MembersInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`项目成员`)
};

/**
* | output |
* | --- |
* | "Project Members" |
*
* @param {Project_MembersInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const project_members = /** @type {((inputs?: Project_MembersInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Project_MembersInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_project_members(inputs)
	return zh_project_members(inputs)
});