/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Override_Existing_SkillInputs */

const en_override_existing_skill = /** @type {(inputs: Override_Existing_SkillInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Do you want to override the existing skill?`)
};

const zh_override_existing_skill = /** @type {(inputs: Override_Existing_SkillInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`你想覆盖现有技能吗？`)
};

/**
* | output |
* | --- |
* | "Do you want to override the existing skill?" |
*
* @param {Override_Existing_SkillInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const override_existing_skill = /** @type {((inputs?: Override_Existing_SkillInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Override_Existing_SkillInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_override_existing_skill(inputs)
	return zh_override_existing_skill(inputs)
});