/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agents_MdInputs */

const en_agents_md = /** @type {(inputs: Agents_MdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AGENTS.md`)
};

const zh_agents_md = /** @type {(inputs: Agents_MdInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`AGENTS.md`)
};

/**
* | output |
* | --- |
* | "AGENTS.md" |
*
* @param {Agents_MdInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agents_md = /** @type {((inputs?: Agents_MdInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agents_MdInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agents_md(inputs)
	return zh_agents_md(inputs)
});