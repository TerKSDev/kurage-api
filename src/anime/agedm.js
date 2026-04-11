const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

const AGEDM_BASE_URL = 'https://www.agedm.io';

const AgedmScraper = {
   name: 'AGE動漫',

   // 1. 搜尋功能
   async search(keyword) {
      const searchUrl = `${AGEDM_BASE_URL}/search?query=${encodeURIComponent(keyword)}`;
      const axiosRes = await axios.get(searchUrl, {
         headers: {
            'User-Agent':
               'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
         },
         httpsAgent: new (require('https').Agent)({
            rejectUnauthorized: false,
         }),
      });

      const $ = cheerio.load(axiosRes.data);
      const results = [];

      $('a').each((index, element) => {
         const href = $(element).attr('href') || '';
         const idMatched = href.match(/\/detail\/(\d{8})/);

         if (idMatched) {
            const animeId = idMatched[1];
            const title =
               $(element).attr('title') ||
               $(element).text().trim() ||
               $(element).find('img').attr('alt');

            if (title && !results.find((item) => item.id === animeId)) {
               results.push({
                  id: animeId,
                  title: title.replace(/\s+/g, '').trim(),
               });
            }
         }
      });
      return results;
   },

   // 2. 拔影片功能
   async getStream(targetUrl) {
      let browser;
      try {
         browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
               '--ignore-certificate-errors',
               '--no-sandbox',
               '--disable-setuid-sandbox',
               '--disable-dev-shm-usage',
            ],
         });

         const page = await browser.newPage();
         let videoUrl = null;

         // 🚨 修正後的資源攔截器 (放行 media)
         await page.setRequestInterception(true);
         page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
               req.abort();
            } else {
               req.continue();
            }
         });

         page.on('response', async (res) => {
            const url = res.url();
            if (
               url.includes('toutiao50') ||
               url.endsWith('.mp4') ||
               url.endsWith('.m3u8')
            ) {
               console.log(`🐙 [${AgedmScraper.name}] 捕獲影片網址:`, url);
               videoUrl = url;
            }
         });

         await page.goto(targetUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000,
         });

         // AGE 特定邏輯：點擊播放按鈕
         await page.waitForSelector('#iframeForVideo', { timeout: 10000 });
         await page.click('#iframeForVideo');

         let attempts = 0;
         while (!videoUrl && attempts < 10) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            attempts++;
         }

         await browser.close();
         return videoUrl;
      } catch (error) {
         if (browser) await browser.close();
         throw error;
      }
   },
};

module.exports = AgedmScraper;
