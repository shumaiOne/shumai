/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ number: NonNullable<unknown> }} Run_AttemptInputs */

const en_run_attempt = /** @type {(inputs: Run_AttemptInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Attempt #${i?.number}`)
};

const zh_run_attempt = /** @type {(inputs: Run_AttemptInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`第 ${i?.number} 次尝试`)
};

/**
* | output |
* | --- |
* | "Attempt #{number}" |
*
* @param {Run_AttemptInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const run_attempt = /** @type {((inputs: Run_AttemptInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Run_AttemptInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_run_attempt(inputs)
	return zh_run_attempt(inputs)
});