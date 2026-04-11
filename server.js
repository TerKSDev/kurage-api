// server.js
const express = require('express');
const cors = require('cors');

// 引入你的刺客小隊
const agedmScraper = require('./src/anime/agedm');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
   res.json({
      status: '🐙 Kurage-API is Running',
      message: '🐙 Kurage-API is swimming in the net!',
   });
});

//* 搜索路由
app.get('/api/scrape/search', async (req, res) => {
   const keyword = req.query.keyword;
   if (!keyword) return res.status(400).json({ error: 'Missing keyword.' });

   console.log(`\n🐙 [API Request] 準備搜索: ${keyword}`);

   try {
      // 指派 AGE 刺客進行搜尋
      const results = await agedmScraper.search(keyword);

      res.json({
         success: true,
         data: results,
         message: `找到 ${results.length} 筆結果。`,
      });
   } catch (error) {
      console.error('Search Error:', error);
      res.status(500).json({ success: false, error: error.message });
   }
});

//* 影片抓取路由
app.get('/api/scrape/episode', async (req, res) => {
   const targetUrl = req.query.url;
   if (!targetUrl) return res.status(400).json({ error: 'Missing URL.' });

   console.log(`\n🐙 [API Request] 準備抓取影片: ${targetUrl}`);

   try {
      // 指派 AGE 刺客去拔影片
      const streamUrl = await agedmScraper.getStream(targetUrl);

      if (streamUrl) {
         res.json({
            success: true,
            data: { streamUrl },
            message: '成功抓取影片網址！',
         });
      } else {
         res.status(404).json({ success: false, error: '無法找到影片來源' });
      }
   } catch (error) {
      console.error('Scrape Error:', error);
      res.status(500).json({ success: false, error: error.message });
   }
});

app.listen(PORT, () => {
   console.log(`🐙 Kurage-API Command Center is online on port ${PORT}`);
});
