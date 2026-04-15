// server.js
const express = require('express');
const cors = require('cors');

// 引入你的刺客小隊
const agedmScraper = require('./src/anime/agedm');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json()); // 確保能接收前端 POST 過來的 JSON 資料

// ==========================================
// 🏆 核心組件：相似度計分引擎 (Scoring Engine)
// ==========================================
/**
 * @param {Object} targetData - 前端傳來的目標特徵 (包含 title, type, synonyms)
 * @param {Array} scrapedResults - 爬蟲抓回來的候選名單陣列
 */
function findBestMatch(targetData, scrapedResults) {
   let bestMatch = null;
   let highestScore = -1;

   // 擴充版：劇場版相關關鍵字
   const movieKeywords = [
      'movie',
      'film',
      'cinema',
      '劇場版',
      '電影',
      '劇場',
      '大銀幕',
      '大螢幕',
      '大屏幕',
      '大画面',
      '大スクリーン',
      '电影',
      '大电影',
      '大映画',
      '剧场',
      '剧场版',
      '映画',
   ];

   for (const result of scrapedResults) {
      let score = 0;
      // 爬蟲抓到的標題
      const scrapedTitle = (result.title || '').toLowerCase();
      // 前端指定的目標主標題
      const targetTitle = (targetData.title || '').toLowerCase();

      // 1. 基礎標題比對
      if (scrapedTitle.includes(targetTitle)) {
         score += 10;
      }

      // 2. 備用標題/別名比對 (解決第二季、特定篇章的問題)
      if (targetData.synonyms && Array.isArray(targetData.synonyms)) {
         const hasSynonym = targetData.synonyms.some((syn) =>
            scrapedTitle.includes(syn.toLowerCase()),
         );
         if (hasSynonym) score += 20;
      }

      // 3. 格式過濾 (TV vs Movie)
      const isMovieResult = movieKeywords.some((kw) =>
         scrapedTitle.includes(kw),
      );

      if (targetData.type === 'TV') {
         if (isMovieResult) {
            score -= 100; // 找 TV 卻出現劇場版，直接擊殺！
         } else {
            score += 10;
         }
      } else if (targetData.type === 'Movie') {
         if (isMovieResult) {
            score += 50; // 找劇場版且真的是劇場版，大加分！
         } else {
            score -= 50;
         }
      }

      // 記錄最高分的候選人
      if (score > highestScore) {
         highestScore = score;
         bestMatch = result;
      }
   }

   // 如果最高分太低（低於0分），代表根本沒找到吻合的
   return highestScore >= 0 ? bestMatch : null;
}

// ==========================================
// 🚀 API 路由區塊
// ==========================================

app.get('/', (req, res) => {
   res.json({
      status: '🐙 Kurage-API is Running',
      message: '🐙 Kurage-API is swimming in the net!',
   });
});

// 📍 1. 傳統搜索路由 (僅回傳所有搜尋結果)
app.get('/api/scrape/search', async (req, res) => {
   const keyword = req.query.keyword;
   if (!keyword) return res.status(400).json({ error: 'Missing keyword.' });

   console.log(`\n🐙 [API Request] Ready to search: ${keyword}`);

   try {
      const results = await agedmScraper.search(keyword);
      res.json({
         success: true,
         data: results,
         message: `Found ${results.length} results for "${keyword}".`,
      });
   } catch (error) {
      console.error('Search Error:', error);
      res.status(500).json({ success: false, error: error.message });
   }
});

// 📍 2. 智能精準鎖定路由 (Smart Match)
// 接收目標特徵，自動過濾並回傳唯一正確的結果
app.post('/api/scrape/smart-match', async (req, res) => {
   // 預期前端 body 格式: { title: "鬼滅之刃", type: "TV", synonyms: ["Kimetsu no Yaiba", "鬼滅之刃 第二季"] }
   const targetData = req.body;

   if (!targetData || !targetData.title) {
      return res
         .status(400)
         .json({ error: 'Missing target fingerprint (title required).' });
   }

   console.log(
      `\n🐙 [Smart Match] Startup with target: ${targetData.title} (Type: ${targetData.type || 'No Type Found.'})`,
   );

   try {
      // 第一波搜索：使用主標題
      let scrapedResults = await agedmScraper.search(targetData.title);

      // 如果主標題搜不到，嘗試使用第一個別名進行搜索
      if (
         scrapedResults.length === 0 &&
         targetData.synonyms &&
         targetData.synonyms.length > 0
      ) {
         console.log(
            `⚠️ Main title no result found, trying with synonym: ${targetData.synonyms[0]}`,
         );
         scrapedResults = await agedmScraper.search(targetData.synonyms[0]);
      }

      if (scrapedResults.length === 0) {
         return res
            .status(404)
            .json({ success: false, error: 'Cannot found any results.' });
      }

      // 將抓取到的名單送入計分引擎進行淘汰
      const bestMatch = findBestMatch(targetData, scrapedResults);

      if (!bestMatch) {
         return res.status(404).json({
            success: false,
            error: 'Found related results, but the version or format does not match.',
         });
      }

      console.log(
         `🎯 [Mark Calculate] Best match found: ${bestMatch.title} (ID: ${bestMatch.id})`,
      );

      res.json({
         success: true,
         data: bestMatch,
         message: 'Smart Match successful! Returning the best match result.',
      });
   } catch (error) {
      console.error('Smart Match Error:', error);
      res.status(500).json({ success: false, error: error.message });
   }
});

// 📍 3. 影片抓取路由
app.get('/api/scrape/episode', async (req, res) => {
   const targetUrl = req.query.url;
   if (!targetUrl) return res.status(400).json({ error: 'Missing URL.' });

   console.log(`\n🐙 [API Request] Ready to scrape: ${targetUrl}`);

   try {
      const streamUrl = await agedmScraper.getStream(targetUrl);

      if (streamUrl) {
         res.json({
            success: true,
            data: { streamUrl },
            message: 'Stream URL successfully retrieved.',
         });
      } else {
         res.status(404).json({
            success: false,
            error: 'Cannot find stream URL.',
         });
      }
   } catch (error) {
      console.error('Scrape Error:', error);
      res.status(500).json({ success: false, error: error.message });
   }
});

app.listen(PORT, () => {
   console.log(`🐙 Kurage-API Command Center is online on port ${PORT}`);
});
