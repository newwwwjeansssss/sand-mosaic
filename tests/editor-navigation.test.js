import assert from "node:assert/strict";
import test from "node:test";

globalThis.window = {
  addEventListener() {},
  pywebview: null,
};
globalThis.document = {};
globalThis.setTimeout = () => 0;

const editor = await import("../static/js/navigation.js");

function classList(active = false) {
  return {
    contains(name) { return name === "active" && active; },
    toggle(name, force) { if (name === "active") active = force; },
  };
}

test("activating the level inspector tab updates both tab and panel state", () => {
  const tabs = ["global", "level", "element"].map(name => ({ dataset: { tab: name }, classList: classList(name === "global") }));
  const panels = ["global", "level", "element"].map(name => ({ dataset: { panel: name }, classList: classList(name === "global") }));
  const root = { querySelectorAll: selector => selector === ".tab" ? tabs : panels };

  assert.equal(typeof editor.activateInspectorTab, "function");
  editor.activateInspectorTab("level", root);

  assert.deepEqual(tabs.map(tab => tab.classList.contains("active")), [false, true, false]);
  assert.deepEqual(panels.map(panel => panel.classList.contains("active")), [false, true, false]);
});
