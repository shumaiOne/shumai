/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agents_Md_PlaceholderInputs */

const en_agents_md_placeholder = /** @type {(inputs: Agents_Md_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Write guidelines and instructions for AI agents here...`)
};

const zh_agents_md_placeholder = /** @type {(inputs: Agents_Md_PlaceholderInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`在此处为 AI Agent 编写项目或文件夹指引...`)
};

/**
* | output |
* | --- |
* | "Write guidelines and instructions for AI agents here..." |
*
* @param {Agents_Md_PlaceholderInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agents_md_placeholder = /** @type {((inputs?: Agents_Md_PlaceholderInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agents_Md_PlaceholderInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agents_md_placeholder(inputs)
	return zh_agents_md_placeholder(inputs)
});