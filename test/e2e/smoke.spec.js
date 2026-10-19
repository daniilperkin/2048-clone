import { test, expect } from "@playwright/test";

/**
 * One smoke test that walks the real served build: load, theme switch
 * timing (the regression jsdom missed), a real key press, dark mode across
 * a reload — with zero console errors along the way.
 */
test("served build: theme switch stays fast, moves tick, dark mode persists", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");
  await expect(page.locator(".tile-container .tile")).toHaveCount(2);
  await expect(page.locator(".moves-container")).toHaveText("0");

  // Theme switch: the view-transition deadlock once made this take 4 s per
  // switch (Chromium's DOM-update watchdog). Anything under 1.5 s means the
  // update callback stayed synchronous and the cross-fade completed.
  const switchMs = await page.evaluate(async () => {
    const button = document.querySelector(".theme-select");
    const started = performance.now();
    button.click();
    const options = [...document.querySelectorAll(".theme-option")];
    options[1].click();
    await new Promise((resolve) => setTimeout(resolve, 30));
    let sawTransition = false;
    while (performance.now() - started < 6000) {
      const running = document
        .getAnimations()
        .some((animation) =>
          ((animation.effect && animation.effect.pseudoElement) || "").includes("view-transition")
        );
      if (running) sawTransition = true;
      if (sawTransition && !running) break;
      if (!sawTransition && performance.now() - started > 300) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return performance.now() - started;
  });
  expect(switchMs).toBeLessThan(1500);

  // A real key press must tick the moves counter (try directions until the
  // random start board actually moves).
  for (const key of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]) {
    await page.keyboard.press(key);
    if ((await page.locator(".moves-container").textContent()) !== "0") break;
  }
  await expect(page.locator(".moves-container")).not.toHaveText("0");

  // Dark mode through the Settings panel, then a reload: the stored
  // preference must re-apply before anything renders.
  await page.locator(".settings-button").click();
  await page.locator('[data-dark-mode="on"]').click();
  await page.reload();
  await expect(page.locator("body")).toHaveClass(/dark/);

  expect(errors).toEqual([]);
});
