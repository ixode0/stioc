import {test, expect, _electron as electron} from "@playwright/test";
import {join} from "path";
import {userFriendlyPath} from "../src/utils/Common";

test.setTimeout(60000);

test("can execute a command", async () => {
    const app = await electron.launch({args: ["."]});
    const win = await app.firstWindow();
    await win.locator(".monaco-editor").waitFor({timeout: 30000});
    await win.keyboard.type("echo expected-text\n");
    // job appears
    await win.locator(".job").first().waitFor({timeout: 10000});
    await expect(win.locator(".job").first()).toContainText("expected-text");
    await app.close();
});

test("status bar changes working directory on cd", async () => {
    const app = await electron.launch({args: ["."]});
    const win = await app.firstWindow();
    await win.locator(".monaco-editor").waitFor({timeout: 30000});
    const oldDirectory = userFriendlyPath(__dirname + "/");
    const newDirectory = userFriendlyPath(join(oldDirectory, "utils") + "/");
    await win.keyboard.type(`cd ${oldDirectory}\n`);
    await expect(win.locator(".present-directory").first()).toContainText(oldDirectory.trim() || oldDirectory.slice(0, 10), {timeout: 10000});
    await win.keyboard.type(`cd ${newDirectory}\n`);
    await expect(win.locator(".present-directory").first()).toContainText("utils", {timeout: 10000});
    await app.close();
});
