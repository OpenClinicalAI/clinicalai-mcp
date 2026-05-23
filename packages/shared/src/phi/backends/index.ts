/**
 * Backend registration. Importing this module registers every redaction
 * backend ARCHITECTURE.md §3.5.4 specifies. The registry itself lives in
 * `registry.ts` so backends can depend on it without an import cycle.
 */

import { customBackend } from "./custom.js";
import { ensembleBackend } from "./ensemble.js";
import { foundationBackend } from "./foundation.js";
import { openmedBackend } from "./openmed.js";
import { presidioBackend } from "./presidio.js";
import { regexBackend } from "./regex.js";
import { registerRedactionBackend } from "./registry.js";

registerRedactionBackend(regexBackend);
registerRedactionBackend(foundationBackend);
registerRedactionBackend(presidioBackend);
registerRedactionBackend(openmedBackend);
registerRedactionBackend(ensembleBackend);
registerRedactionBackend(customBackend);

export {
  availableRedactionBackends,
  getRedactionBackend,
  type RedactionBackendImpl,
  registerRedactionBackend,
} from "./registry.js";
