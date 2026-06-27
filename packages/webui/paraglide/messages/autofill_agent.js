/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Autofill_AgentInputs */

const en_autofill_agent = /** @type {(inputs: Autofill_AgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Autofill Agent`)
};

const zh_autofill_agent = /** @type {(inputs: Autofill_AgentInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`自动填充智能体`)
};

/**
* | output |
* | --- |
* | "Autofill Agent" |
*
* @param {Autofill_AgentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const autofill_agent = /** @type {((inputs?: Autofill_AgentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Autofill_AgentInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_autofill_agent(inputs)
	return zh_autofill_agent(inputs)
});