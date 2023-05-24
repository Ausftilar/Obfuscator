const { expect } = require("chai");
const puppeteer = require("puppeteer");
const path = require("path");

describe("Fingerprinting on Chrome Headless", function () {
  let browser, page;
  let fingerprint;

  before(async function () {
    // Код выполняемый до начала работы тестов

    // мы создаем экземпляр puppeteer
    // он позволяет управлять Chrome headless
    browser = await puppeteer.launch();
    page = await browser.newPage();

    // мы загружаем HTML страницу, которая находится в этой же директории
    await page.goto("file://" + path.resolve(__dirname, "test.html"), {
      waitUntil: "load",
    });

    // Выполняем код в контексте нашей HTML страницы, чтобы получить результат работы fingerprint скрипта
    fingerprint = await page.evaluate(async () => {
      try {
        const fingerprint = await fingerprintCollector.collect();
        return fingerprint;
      } catch (e) {
        return e.message;
      }
    });
  });

  after(async function () {
    // Когда все тесты выполнены, мы закрываем страницу и браузер
    await page.close();
    await browser.close();
  });

  // Создадим 3 unit теста
  it("resOverflow should be an object", () => {
    expect(typeof fingerprint.resOverflow).to.equal("object");
  });

  it("screen should have 16 properties", () => {
    const isScreenValid =
      fingerprint.screenResolution !== undefined &&
      Object.keys(fingerprint.screenResolution).length === 16;
    expect(isScreenValid).to.be.true;
  });

  it("adblock should be false", () => {
    expect(fingerprint.adblock).to.be.false;
  });
});