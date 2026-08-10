/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Exclude_Tools_HintInputs */

const en_exclude_tools_hint = /** @type {(inputs: Exclude_Tools_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Comma-separated tool names to exclude`)
};

const zh_exclude_tools_hint = /** @type {(inputs: Exclude_Tools_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`要排除的工具名称（逗号分隔）`)
};

/**
* | output |
* | --- |
* | "Comma-separated tool names to exclude" |
*
* @param {Exclude_Tools_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const exclude_tools_hint = /** @type {((inputs?: Exclude_Tools_HintInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Exclude_Tools_HintInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_exclude_tools_hint(inputs)
	return zh_exclude_tools_hint(inputs)
});