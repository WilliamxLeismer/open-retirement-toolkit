import "./style.css";
import { App } from "./app";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("App root not found.");
new App(root).start();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}
