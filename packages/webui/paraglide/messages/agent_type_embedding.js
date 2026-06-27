/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Agent_Type_EmbeddingInputs */

const en_agent_type_embedding = /** @type {(inputs: Agent_Type_EmbeddingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Embedding`)
};

const zh_agent_type_embedding = /** @type {(inputs: Agent_Type_EmbeddingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`嵌入`)
};

/**
* | output |
* | --- |
* | "Embedding" |
*
* @param {Agent_Type_EmbeddingInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const agent_type_embedding = /** @type {((inputs?: Agent_Type_EmbeddingInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Agent_Type_EmbeddingInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_agent_type_embedding(inputs)
	return zh_agent_type_embedding(inputs)
});