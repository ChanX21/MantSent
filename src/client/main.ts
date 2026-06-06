import { loadRemoteState } from "./api.js";
import { setView } from "./render.js";
import type { ViewName } from "./types.js";

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const view = target.closest<HTMLElement>("[data-view]")?.dataset.view as ViewName | undefined;
  if (view) setView(view);
});

loadRemoteState();
setInterval(loadRemoteState, 6000);
