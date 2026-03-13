const express = require('express');
const path = require('path');
const { google } = require('googleapis');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

// Статичні файли
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// Auth
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// Helper function
async function getSheetData(range) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });
    return response.data.values || [];
  } catch (error) {
    console.error('API Error:', error);
    return null;
  }
}

function getVal(row, index) {
  return (row && row[index] !== undefined) ? row[index] : '';
}

app.get('/api/view/:etap', async (req, res) => {
  const { etap } = req.params;
  
  try {
    // ОПТИМІЗАЦІЯ: Робимо мінімум запитів. 
    // Прапор AA1 вже входить у діапазон BeforeFinal!A1:AC50, тому окремо його не тягнемо.
    const promises = [ getSheetData('BeforeFinal!A1:AC50') ];
    
    // Якщо потрібна турнірка або фінали - дотягуємо AfterFinal
    if (etap === 'SecScreen' || etap === 'AfterFinal') {
      promises.push(getSheetData('AfterFinal!A1:AC50'));
    }

    const results = await Promise.all(promises);
    const beforeFinalData = results[0] || [];
    const afterFinalData = results[1] || []; 
    
    if (!beforeFinalData.length) return res.status(500).json({ error: "No data" });

    // Витягуємо прапор (це 1-й рядок, 27-ма колонка, індекси 0 і 26). 
    // trim() рятує, якщо хтось випадково поставив пробіл: "Y "
    const rawFlag = getVal(beforeFinalData[0], 26);
    const flag = (typeof rawFlag === 'string') ? rawFlag.trim() : '';
    
    const responseData = { flag: flag, tables: {} };

    // === АВТОМАТИЧНА ГЕНЕРАЦІЯ ТУРНІРНОЇ ТАБЛИЦІ (SecScreen) ===
    if (etap === 'SecScreen') {
      const allStats = {};
      const groupTeams = { "14A": new Set(), "14B": new Set(), "17": new Set(), "66": new Set() };
      
      const registerTeam = (t) => {
        if (t && !allStats[t]) allStats[t] = { g: 0, w: 0, d: 0, l: 0, gs: 0, gc: 0 };
      };

      const addMatchStats = (t1, t2, s1, s2) => {
        if (!t1 || !t2 || isNaN(s1) || isNaN(s2)) return;
        registerTeam(t1); registerTeam(t2);
        allStats[t1].g++; allStats[t2].g++;
        allStats[t1].gs += s1; allStats[t1].gc += s2;
        allStats[t2].gs += s2; allStats[t2].gc += s1;
        if (s1 > s2) { allStats[t1].w++; allStats[t2].l++; }
        else if (s1 < s2) { allStats[t2].w++; allStats[t1].l++; }
        else { allStats[t1].d++; allStats[t2].d++; }
      };

      // 1. Читаємо матчі з BeforeFinal (та формуємо список команд для кожної групи)
      const bfOffsets = { "14": 0, "17A": 6, "17B": 12, "66": 18 };
      for (let i = 2; i < beforeFinalData.length; i++) {
        const row = beforeFinalData[i];
        if (!row) continue;
        Object.keys(bfOffsets).forEach(grp => {
          const off = bfOffsets[grp];
          let t1 = getVal(row, off + 1).trim();
          let s1Str = getVal(row, off + 2).trim();
          let s2Str = getVal(row, off + 3).trim();
          let t2 = getVal(row, off + 4).trim();
          
          if (t1) { registerTeam(t1); groupTeams[grp].add(t1); }
          if (t2) { registerTeam(t2); groupTeams[grp].add(t2); }
          
          if (t1 && t2 && s1Str !== '' && s2Str !== '') {
            let s1 = parseInt(s1Str.replace(/[^\d]/g, ''));
            let s2 = parseInt(s2Str.replace(/[^\d]/g, ''));
            addMatchStats(t1, t2, s1, s2);
          }
        });
      }

      // 2. Читаємо матчі з AfterFinal (Тут лише 3 групи: U-14, U-17, U-66)
      const afOffsets = [0, 6, 12];
      for (let i = 2; i < afterFinalData.length; i++) {
        const row = afterFinalData[i];
        if (!row) continue;
        afOffsets.forEach(off => {
          let t1 = getVal(row, off + 1).trim();
          let scoreStr = getVal(row, off + 2).trim(); // Рахунок в одній клітинці "2 : 1"
          let t2 = getVal(row, off + 3).trim();
          
          if (t1 && t2 && scoreStr.includes(':')) {
            const parts = scoreStr.split(':');
            let s1 = parseInt(parts[0].replace(/[^\d]/g, ''));
            let s2 = parseInt(parts[1].replace(/[^\d]/g, ''));
            addMatchStats(t1, t2, s1, s2);
          }
        });
      }

      // 3. Віддаємо готові таблиці
      Object.keys(bfOffsets).forEach(grp => {
        const standings = Array.from(groupTeams[grp]).map(teamName => {
          const st = allStats[teamName];
          return {
            time: teamName, team1: st.g, score: st.w, score2: st.d, team2: st.l,
            field: (st.w * 3) + st.d, goalDiff: st.gs - st.gc
          };
        });
        standings.sort((a, b) => {
          if (b.field !== a.field) return b.field - a.field;
          return b.goalDiff - a.goalDiff;
        });
        responseData.tables[grp] = standings;
      });

    } else {
      // === ЛОГІКА ДЛЯ СТАНДАРТНИХ ЕКРАНІВ ===
      let configs = {};
      if (etap === "BeforeFinal") {
        configs = { "14A": { offset: 0 }, "14B": { offset: 6 }, "17": { offset: 12 }, "66": { offset: 18 } };
      } else if (etap === "AfterFinal") {
        // Оновлено: Нова структура для фіналів
        configs = { "14": { offset: 0 }, "17": { offset: 6 }, "66": { offset: 12 } };
      }

      const rawData = (etap === 'AfterFinal') ? afterFinalData : beforeFinalData;
      const maxRows = rawData.length;

      Object.keys(configs).forEach(key => {
        const conf = configs[key];
        const offset = conf.offset;
        const rows = [];

        for (let i = 2; i < maxRows; i++) {
          const row = rawData[i];
          if (!row || !getVal(row, offset)) continue;

          let rowObj = {};
          if (etap === "AfterFinal") {
            // Оновлено: Читаємо рівно 5 стовпців для AfterFinal
            rowObj = {
              time: getVal(row, offset),
              team1: getVal(row, offset + 1),
              score: getVal(row, offset + 2), 
              team2: getVal(row, offset + 3),
              field: getVal(row, offset + 4)
            };
          } else {
            rowObj = {
              time: getVal(row, offset),
              team1: getVal(row, offset + 1),
              score: `${getVal(row, offset + 2)} : ${getVal(row, offset + 3)}`,
              team2: getVal(row, offset + 4),
              field: getVal(row, offset + 5)
            };
          }
          rows.push(rowObj);
        }
        responseData.tables[key] = rows;
      });
    }

    // КЕШУВАННЯ VERCEL (Фікс проблеми 2). Сервер запам'ятовує дані на 5 секунд.
    // Наступний запит завантажиться моментально без звернення до Google!
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate');
    
    res.json(responseData);
  } catch (error) {
    console.error("Server API Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server ready on ${PORT}`));
}

module.exports = app;