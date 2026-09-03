/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Sync_Providers_Context_WindowInputs */

const en_sync_providers_context_window = /** @type {(inputs: Sync_Providers_Context_WindowInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count}k ctx`)
};

const zh_sync_providers_context_window = /** @type {(inputs: Sync_Providers_Context_WindowInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`${i?.count}k 上下文`)
};

/**
* | output |
* | --- |
* | "{count}k ctx" |
*
* @param {Sync_Providers_Context_WindowInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const sync_providers_context_window = /** @type {((inputs: Sync_Providers_Context_WindowInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Sync_Providers_Context_WindowInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_sync_providers_context_window(inputs)
	return zh_sync_providers_context_window(inputs)
});