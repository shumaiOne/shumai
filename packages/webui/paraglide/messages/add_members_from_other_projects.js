/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Add_Members_From_Other_ProjectsInputs */

const en_add_members_from_other_projects = /** @type {(inputs: Add_Members_From_Other_ProjectsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Add Members from Other Projects`)
};

const zh_add_members_from_other_projects = /** @type {(inputs: Add_Members_From_Other_ProjectsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`从其他项目添加成员`)
};

/**
* | output |
* | --- |
* | "Add Members from Other Projects" |
*
* @param {Add_Members_From_Other_ProjectsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const add_members_from_other_projects = /** @type {((inputs?: Add_Members_From_Other_ProjectsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Add_Members_From_Other_ProjectsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_add_members_from_other_projects(inputs)
	return zh_add_members_from_other_projects(inputs)
});