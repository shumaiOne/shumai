/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Model_Id_Already_ExistsInputs */

const en_model_id_already_exists = /** @type {(inputs: Model_Id_Already_ExistsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Model ID already exists for this provider`)
};

const zh_model_id_already_exists = /** @type {(inputs: Model_Id_Already_ExistsInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`此提供商已存在该模型 ID`)
};

/**
* | output |
* | --- |
* | "Model ID already exists for this provider" |
*
* @param {Model_Id_Already_ExistsInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const model_id_already_exists = /** @type {((inputs?: Model_Id_Already_ExistsInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Model_Id_Already_ExistsInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_model_id_already_exists(inputs)
	return zh_model_id_already_exists(inputs)
});