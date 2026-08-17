/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Quota_Team_Shared_PoolInputs */

const en_quota_team_shared_pool = /** @type {(inputs: Quota_Team_Shared_PoolInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Team Shared Pool`)
};

const zh_quota_team_shared_pool = /** @type {(inputs: Quota_Team_Shared_PoolInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`团队共享配额池`)
};

/**
* | output |
* | --- |
* | "Team Shared Pool" |
*
* @param {Quota_Team_Shared_PoolInputs} inputs
* @param {{ locale?: "en" | "zh" }} options
* @returns {LocalizedString}
*/
export const quota_team_shared_pool = /** @type {((inputs?: Quota_Team_Shared_PoolInputs, options?: { locale?: "en" | "zh" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Quota_Team_Shared_PoolInputs, { locale?: "en" | "zh" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_quota_team_shared_pool(inputs)
	return zh_quota_team_shared_pool(inputs)
});