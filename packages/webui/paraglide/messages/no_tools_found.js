/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} No_Tools_FoundInputs */

const en_no_tools_found = /** @type {(inputs: No_Tools_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`No tools found matching your search.`)
};

const zh_no_tools_found = /** @type {(inputs: No_Tools_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`未找到符合搜索条件的工具。`)
};

/**
* | output |
* | --- |
* | "No tools found matching your search." |
*
* @param {No_Tools_FoundInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const no_tools_found = /** @type {((inputs?: No_Tools_FoundInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<No_Tools_FoundInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_no_tools_found(inputs)
	return zh_no_tools_found(inputs)
});