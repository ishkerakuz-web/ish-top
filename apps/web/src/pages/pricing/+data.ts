import { fetchPlans } from "../../lib/apiExtra.js";

/** Tariflar ochiq ma'lumot — server tomonda yuklanadi (SEO + tez ochilish). */
export async function data() {
  const plans = await fetchPlans();
  return { plans };
}
