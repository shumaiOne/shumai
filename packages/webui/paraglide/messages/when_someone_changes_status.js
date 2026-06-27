/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} When_Someone_Changes_StatusInputs */

const en_when_someone_changes_status = /** @type {(inputs: When_Someone_Changes_StatusInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`When someone changes an asset's status`)
};

const zh_when_someone_changes_status = /** @type {(inputs: When_Someone_Changes_StatusInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`当有人更改素材的状态时`)
};

/**
* | output |
* | --- |
* | "When someone changes an asset's status" |
*
* @param {When_Someone_Changes_StatusInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const when_someone_changes_status = /** @type {((inputs?: When_Someone_Changes_StatusInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<When_Someone_Changes_StatusInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_when_someone_changes_status(inputs)
	return zh_when_someone_changes_status(inputs)
});