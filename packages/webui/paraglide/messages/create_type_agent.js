/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ type: NonNullable<unknown> }} Create_Type_AgentInputs */

const en_create_type_agent = /** @type {(inputs: Create_Type_AgentInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Create ${i?.type} Agent`)
};

const zh_create_type_agent = /** @type {(inputs: Create_Type_AgentInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`创建${i?.type}智能体`)
};

/**
* | output |
* | --- |
* | "Create {type} Agent" |
*
* @param {Create_Type_AgentInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const create_type_agent = /** @type {((inputs: Create_Type_AgentInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Create_Type_AgentInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_create_type_agent(inputs)
	return zh_create_type_agent(inputs)
});