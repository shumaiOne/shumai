/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Skills_DescriptionInputs */

const en_skills_description = /** @type {(inputs: Skills_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Add, update and configure AI skills for the team.`)
};

const zh_skills_description = /** @type {(inputs: Skills_DescriptionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`为团队添加、更新和配置 AI 技能。`)
};

/**
* | output |
* | --- |
* | "Add, update and configure AI skills for the team." |
*
* @param {Skills_DescriptionInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const skills_description = /** @type {((inputs?: Skills_DescriptionInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Skills_DescriptionInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_skills_description(inputs)
	return zh_skills_description(inputs)
});