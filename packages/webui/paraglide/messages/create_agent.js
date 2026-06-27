/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Create_AgentInputs */

const en_create_agent = /** @type {(inputs: Create_AgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Create Agent`)
};

const zh_create_agent = /** @type {(inputs: Create_AgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`创建智能体`)
};

/**
* | output |
* | --- |
* | "Create Agent" |
*
* @param {Create_AgentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const create_agent = /** @type {((inputs?: Create_AgentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Create_AgentInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_create_agent(inputs)
	return zh_create_agent(inputs)
});