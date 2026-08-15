/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agents_Md_Readonly_HintInputs */

const en_agents_md_readonly_hint = /** @type {(inputs: Agents_Md_Readonly_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Only project owners can edit AGENTS.md instructions.`)
};

const zh_agents_md_readonly_hint = /** @type {(inputs: Agents_Md_Readonly_HintInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`只有项目所有者可以编辑 AGENTS.md 指引。`)
};

/**
* | output |
* | --- |
* | "Only project owners can edit AGENTS.md instructions." |
*
* @param {Agents_Md_Readonly_HintInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agents_md_readonly_hint = /** @type {((inputs?: Agents_Md_Readonly_HintInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agents_Md_Readonly_HintInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agents_md_readonly_hint(inputs)
	return zh_agents_md_readonly_hint(inputs)
});