/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Sync_Providers_ReasoningInputs */

const en_sync_providers_reasoning = /** @type {(inputs: Sync_Providers_ReasoningInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`reasoning`)
};

const zh_sync_providers_reasoning = /** @type {(inputs: Sync_Providers_ReasoningInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`深度思考`)
};

/**
* | output |
* | --- |
* | "reasoning" |
*
* @param {Sync_Providers_ReasoningInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_reasoning = /** @type {((inputs?: Sync_Providers_ReasoningInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sync_Providers_ReasoningInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sync_providers_reasoning(inputs)
	return zh_sync_providers_reasoning(inputs)
});