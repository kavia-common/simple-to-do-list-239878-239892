const { test, expect } = require("@playwright/test");

const STORAGE_KEY = "retro_todos_v1";

/**
 * Helpers to keep selectors resilient and readable.
 */
function getNewTodoInput(page) {
  return page.locator("#newTodo");
}

function getTasksList(page) {
  return page.getByRole("list", { name: "Tasks" });
}

function taskItemByTitle(page, title) {
  // Each task is an <li> containing a .todoText span with the title.
  return getTasksList(page).locator("li", { has: page.locator(".todoText", { hasText: title }) });
}

async function setFilter(page, name) {
  await page.getByRole("tab", { name }).click();
}

test.describe("Retro To‑Do core flows", () => {
  test.beforeEach(async ({ page }) => {
    // Start each test with a clean localStorage state.
    await page.goto("/");
    await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
    await page.reload();
  });

  test("add todo persists to localStorage and survives reload", async ({ page }) => {
    await page.goto("/");

    await getNewTodoInput(page).fill("Buy milk");
    await page.getByRole("button", { name: "Add" }).click();

    await expect(taskItemByTitle(page, "Buy milk")).toBeVisible();

    // Check persistence via localStorage.
    const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
    expect(stored).toBeTruthy();
    expect(JSON.parse(stored)).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: "Buy milk", completed: false })])
    );

    // Reload should keep the item visible.
    await page.reload();
    await expect(taskItemByTitle(page, "Buy milk")).toBeVisible();
  });

  test("edit todo updates title and persists across reload", async ({ page }) => {
    await page.goto("/");

    await getNewTodoInput(page).fill("Write draft");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(taskItemByTitle(page, "Write draft")).toBeVisible();

    const item = taskItemByTitle(page, "Write draft");
    await item.getByRole("button", { name: "Edit" }).click();

    // Edit input is rendered with id `edit-${todo.id}`; we can just target the textbox in this item.
    const editBox = item.getByRole("textbox", { name: "Edit task" });
    await expect(editBox).toBeVisible();
    await editBox.fill("Write final");
    await item.getByRole("button", { name: "Save" }).click();

    await expect(taskItemByTitle(page, "Write final")).toBeVisible();
    await expect(taskItemByTitle(page, "Write draft")).toHaveCount(0);

    const stored = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || "[]"), STORAGE_KEY);
    expect(stored).toEqual(
      expect.arrayContaining([expect.objectContaining({ title: "Write final" })])
    );

    await page.reload();
    await expect(taskItemByTitle(page, "Write final")).toBeVisible();
  });

  test("complete + filter (all/active/completed) behaves correctly", async ({ page }) => {
    await page.goto("/");

    await getNewTodoInput(page).fill("Task A");
    await page.getByRole("button", { name: "Add" }).click();

    await getNewTodoInput(page).fill("Task B");
    await page.getByRole("button", { name: "Add" }).click();

    await expect(taskItemByTitle(page, "Task A")).toBeVisible();
    await expect(taskItemByTitle(page, "Task B")).toBeVisible();

    // Mark Task A completed by clicking its completion toggle.
    const taskA = taskItemByTitle(page, "Task A");
    await taskA.getByRole("button", { name: /mark as completed/i }).click();

    // Active filter should show only Task B.
    await setFilter(page, "Active");
    await expect(taskItemByTitle(page, "Task B")).toBeVisible();
    await expect(taskItemByTitle(page, "Task A")).toHaveCount(0);

    // Completed filter should show only Task A.
    await setFilter(page, "Completed");
    await expect(taskItemByTitle(page, "Task A")).toBeVisible();
    await expect(taskItemByTitle(page, "Task B")).toHaveCount(0);

    // All shows both.
    await setFilter(page, "All");
    await expect(taskItemByTitle(page, "Task A")).toBeVisible();
    await expect(taskItemByTitle(page, "Task B")).toBeVisible();

    // Verify persistence of completed state.
    const stored = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || "[]"), STORAGE_KEY);
    const storedA = stored.find((t) => t.title === "Task A");
    const storedB = stored.find((t) => t.title === "Task B");
    expect(storedA?.completed).toBe(true);
    expect(storedB?.completed).toBe(false);

    await page.reload();
    await setFilter(page, "Completed");
    await expect(taskItemByTitle(page, "Task A")).toBeVisible();
  });

  test("delete removes todo and persists removal after reload", async ({ page }) => {
    await page.goto("/");

    await getNewTodoInput(page).fill("Disposable");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(taskItemByTitle(page, "Disposable")).toBeVisible();

    const item = taskItemByTitle(page, "Disposable");
    await item.getByRole("button", { name: "Delete task" }).click();

    await expect(taskItemByTitle(page, "Disposable")).toHaveCount(0);

    const stored = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || "[]"), STORAGE_KEY);
    expect(stored.find((t) => t.title === "Disposable")).toBeUndefined();

    await page.reload();
    await expect(taskItemByTitle(page, "Disposable")).toHaveCount(0);
  });
});
