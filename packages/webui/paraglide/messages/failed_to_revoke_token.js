/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Failed_To_Revoke_TokenInputs */

const en_failed_to_revoke_token = /** @type {(inputs: Failed_To_Revoke_TokenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Failed to revoke token`)
};

const zh_failed_to_revoke_token = /** @type {(inputs: Failed_To_Revoke_TokenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`撤销令牌失败`)
};

/**
* | output |
* | --- |
* | "Failed to revoke token" |
*
* @param {Failed_To_Revoke_TokenInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const failed_to_revoke_token = /** @type {((inputs?: Failed_To_Revoke_TokenInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Failed_To_Revoke_TokenInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_failed_to_revoke_token(inputs)
	return zh_failed_to_revoke_token(inputs)
});