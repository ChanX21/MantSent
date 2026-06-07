import { loadRemoteState } from "./api.js";

loadRemoteState();
setInterval(loadRemoteState, 6000);
