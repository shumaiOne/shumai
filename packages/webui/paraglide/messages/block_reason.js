/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Block_ReasonInputs */

const en_block_reason = /** @type {(inputs: Block_ReasonInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Block Reason`)
};

const zh_block_reason = /** @type {(inputs: Block_ReasonInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`受阻原因`)
};

/**
* | output |
* | --- |
* | "Block Reason" |
*
* @param {Block_ReasonInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const block_reason = /** @type {((inputs?: Block_ReasonInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Block_ReasonInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_block_reason(inputs)
	return zh_block_reason(inputs)
});