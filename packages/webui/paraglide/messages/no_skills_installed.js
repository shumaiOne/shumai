/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Skills_InstalledInputs */

const en_no_skills_installed = /** @type {(inputs: No_Skills_InstalledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No skills installed`)
};

const zh_no_skills_installed = /** @type {(inputs: No_Skills_InstalledInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`暂无已安装的技能`)
};

/**
* | output |
* | --- |
* | "No skills installed" |
*
* @param {No_Skills_InstalledInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_skills_installed = /** @type {((inputs?: No_Skills_InstalledInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Skills_InstalledInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_skills_installed(inputs)
	return zh_no_skills_installed(inputs)
});