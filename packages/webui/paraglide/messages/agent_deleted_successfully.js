/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Deleted_SuccessfullyInputs */

const en_agent_deleted_successfully = /** @type {(inputs: Agent_Deleted_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Agent deleted successfully`)
};

const zh_agent_deleted_successfully = /** @type {(inputs: Agent_Deleted_SuccessfullyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`智能体删除成功`)
};

/**
* | output |
* | --- |
* | "Agent deleted successfully" |
*
* @param {Agent_Deleted_SuccessfullyInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_deleted_successfully = /** @type {((inputs?: Agent_Deleted_SuccessfullyInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Deleted_SuccessfullyInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_deleted_successfully(inputs)
	return zh_agent_deleted_successfully(inputs)
});