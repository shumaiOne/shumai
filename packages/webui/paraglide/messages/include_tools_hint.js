/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Include_Tools_HintInputs */

const en_include_tools_hint = /** @type {(inputs: Include_Tools_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Comma-separated tool names to include (empty = all)`)
};

const zh_include_tools_hint = /** @type {(inputs: Include_Tools_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`要包含的工具名称（逗号分隔，留空表示全部）`)
};

/**
* | output |
* | --- |
* | "Comma-separated tool names to include (empty = all)" |
*
* @param {Include_Tools_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const include_tools_hint = /** @type {((inputs?: Include_Tools_HintInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Include_Tools_HintInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_include_tools_hint(inputs)
	return zh_include_tools_hint(inputs)
});