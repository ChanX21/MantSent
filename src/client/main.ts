import { loadRemoteState, runAction } from "./api.js";
import { setView } from "./render.js";
import type { ActionName, ViewName } from "./types.js";

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const action = target.closest<HTMLElement>("[data-action]")?.dataset.action as ActionName | undefined;
  const view = target.closest<HTMLElement>("[data-view]")?.dataset.view as ViewName | undefined;
  if (action) runAction(action);
  if (view) setView(view);
});

loadRemoteState();
setInterval(loadRemoteState, 6000);
