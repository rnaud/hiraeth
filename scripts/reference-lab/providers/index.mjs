// Every reference-lab provider, in the order the page shows them (docs/systems/reference-lab.md).
import openai from './openai.mjs';
import gemini from './gemini.mjs';
import bfl from './bfl.mjs';
import { FAL_PROVIDERS } from './fal.mjs';

export const PROVIDERS = [openai, gemini, ...FAL_PROVIDERS, bfl];
export const providerById = (id) => PROVIDERS.find((p) => p.id === id) ?? null;
