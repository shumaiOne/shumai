/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Projects_YetInputs */

const en_no_projects_yet = /** @type {(inputs: No_Projects_YetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No projects yet.`)
};

const zh_no_projects_yet = /** @type {(inputs: No_Projects_YetInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`暂无项目。`)
};

/**
* | output |
* | --- |
* | "No projects yet." |
*
* @param {No_Projects_YetInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_projects_yet = /** @type {((inputs?: No_Projects_YetInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Projects_YetInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_projects_yet(inputs)
	return zh_no_projects_yet(inputs)
});