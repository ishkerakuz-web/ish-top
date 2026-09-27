import type { PageContext } from "vike/types";
import { messagesFor } from "../../lib/i18n/messagesFor.js";

export default (pageContext: PageContext) => messagesFor(pageContext).metaExtra.notifications.title;
