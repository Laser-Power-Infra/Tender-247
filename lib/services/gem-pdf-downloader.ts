import puppeteer from "puppeteer-core";
import path from "path";
import fs from "fs";

const BASE_DOWNLOAD_DIR = "C:\\downloads gem";

export interface TenderItem {
  id: number;
  gemId: string;
}

export interface DownloadResult {
  id: number;
  gemId: string;
  success: boolean;
  pdfPath?: string;
  error?: string;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForFile(
  dir: string,
  extension: string,
  timeout = 30000,
): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    let files: string[];
    try {
      files = fs.readdirSync(dir).filter((f) =>
        f.toLowerCase().endsWith(extension),
      );
    } catch {
      return null;
    }
    if (files.length > 0) {
      return path.join(dir, files[0]);
    }
    await delay(500);
  }
  return null;
}

async function detectChromePath(): Promise<string> {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Chromium\\Application\\chrome.exe",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    "Chrome not found. Please install Chrome or set CHROME_PATH env variable.",
  );
}

function sleepForAnimation(ms: number) {
  return delay(ms);
}

export async function downloadGemPdfs(
  tenders: TenderItem[],
  onProgress?: (current: number, total: number) => void,
): Promise<DownloadResult[]> {
  if (!fs.existsSync(BASE_DOWNLOAD_DIR)) {
    fs.mkdirSync(BASE_DOWNLOAD_DIR, { recursive: true });
  }

  const chromePath = process.env.CHROME_PATH || (await detectChromePath());

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
    defaultViewport: null,
    args: ["--start-maximized"],
  });

  const results: DownloadResult[] = [];

  try {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    for (let i = 0; i < tenders.length; i++) {
      const tender = tenders[i];
      onProgress?.(i + 1, tenders.length);

      const folderName = tender.gemId.replace(/[\/\\]/g, "-");
      const downloadPath = path.join(BASE_DOWNLOAD_DIR, folderName);

      if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
      }

      // Set download path via CDP session
      const cdpSession = await page.target().createCDPSession();
      await cdpSession.send("Browser.setDownloadBehavior", {
        behavior: "allow",
        downloadPath,
      });

      try {
        console.log(`[${i + 1}/${tenders.length}] Processing ${tender.gemId}`);

        await page.goto("https://bidplus.gem.gov.in/all-bids", {
          waitUntil: "networkidle2",
        });

        // Fill search input using locator API
        await page.locator("#searchBid").setTimeout(5000).fill(tender.gemId);

        await sleepForAnimation(1000);

        // Click "Contains" dropdown to open it
        await page.evaluate(() => {
          const elements = Array.from(
            document.querySelectorAll("button, a, span, label, div"),
          );
          const contains = elements.find(
            (e) => e.textContent?.trim() === "Contains",
          );
          (contains as HTMLElement | undefined)?.dispatchEvent(
            new MouseEvent("click", { bubbles: true }),
          );
        });
        await sleepForAnimation(300);

        // Select "Exact Search" option
        await page.evaluate(() => {
          const elements = Array.from(
            document.querySelectorAll("li, div, a, span, label"),
          );
          const exact = elements.find(
            (e) => e.textContent?.trim().toUpperCase() === "EXACT SEARCH",
          );
          (exact as HTMLElement | undefined)?.dispatchEvent(
            new MouseEvent("click", { bubbles: true }),
          );
        });

        await sleepForAnimation(1000);

        // Check "Bid/RA Status" checkbox
        await page.evaluate(() => {
          const labels = Array.from(document.querySelectorAll("label, span"));
          const label = labels.find((l) =>
            l.textContent?.toUpperCase().includes("BID/RA STATUS"),
          );
          if (!label) return;
          const input =
            document.getElementById(label.getAttribute("for") || "") ||
            label.querySelector("input");
          if (input instanceof HTMLInputElement && !input.checked) {
            input.click();
          }
        });

        await sleepForAnimation(1000);

        // Submit search
        await page.keyboard.press("Enter");
        await sleepForAnimation(8000);

        // Find and click bid link
        const found = await page.evaluate((targetGemId) => {
          const links = Array.from(document.querySelectorAll("a"));
          const link = links.find((l) =>
            l.textContent?.includes(targetGemId),
          );
          if (link instanceof HTMLElement) {
            link.click();
            return true;
          }
          return false;
        }, tender.gemId);

        if (!found) {
          results.push({
            id: tender.id,
            gemId: tender.gemId,
            success: false,
            error: "Bid link not found in search results",
          });
          continue;
        }

        // Wait for bid detail page to load
        await sleepForAnimation(5000);

        // Try to click PDF download link on the bid detail page
        const clickedDownload = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll("a"));
          const downloadLink = links.find((l) => {
            const text = l.textContent?.toLowerCase() || "";
            const href = (l.getAttribute("href") || "").toLowerCase();
            return (
              text.includes("download") ||
              text.includes("pdf") ||
              href.endsWith(".pdf") ||
              href.includes("download")
            );
          });
          if (downloadLink) {
            downloadLink.click();
            return true;
          }
          return false;
        });

        if (clickedDownload) {
          await sleepForAnimation(3000);
        }

        // Wait for PDF file to appear
        const pdfPath = await waitForFile(downloadPath, ".pdf", 20000);

        if (pdfPath) {
          console.log(`  Downloaded: ${pdfPath}`);
          results.push({
            id: tender.id,
            gemId: tender.gemId,
            success: true,
            pdfPath,
          });
        } else {
          results.push({
            id: tender.id,
            gemId: tender.gemId,
            success: false,
            error: "PDF download not detected",
          });
        }
      } catch (err) {
        console.error(`  Error: ${err}`);
        results.push({
          id: tender.id,
          gemId: tender.gemId,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        await cdpSession.detach().catch(() => {});
      }
    }

    return results;
  } finally {
    await browser.close().catch(() => {});
  }
}
