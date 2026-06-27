/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Created_SuccessfullyInputs */

const en_agent_created_successfully = /** @type {(inputs: Agent_Created_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Agent created successfully`)
};

const zh_agent_created_successfully = /** @type {(inputs: Agent_Created_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`智能体创建成功`)
};

/**
* | output |
* | --- |
* | "Agent created successfully" |
*
* @param {Agent_Created_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_created_successfully = /** @type {((inputs?: Agent_Created_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Created_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_created_successfully(inputs)
	return zh_agent_created_successfully(inputs)
});