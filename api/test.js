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
  
  // 1. Завантажуємо дані паралельно (збільшив діапазон до AC50, щоб можна було додавати нові команди)
  const promises = [
    getSheetData('BeforeFinal!A1:AC50'), 
    getSheetData('BeforeFinal!AA1')
  ];
  
  // Якщо це турнірна таблиця (SecScreen) або AfterFinal - тягнемо ще й дані з AfterFinal
  if (etap === 'SecScreen' || etap === 'AfterFinal') {
    promises.push(getSheetData('AfterFinal!A1:AC50'));
  }

  const results = await Promise.all(promises);
  const beforeFinalData = results[0] || [];
  const flagData = results[1] || [];
  const afterFinalData = results[2] || [];
  
  const rawData = (etap === 'AfterFinal') ? afterFinalData : beforeFinalData;
  
  if (!beforeFinalData.length) return res.status(500).json({ error: "No data" });

  const flag = (flagData && flagData[0] && flagData[0][0]) ? flagData[0][0] : '';
  const responseData = { flag: flag, tables: {} };

  // === АВТОМАТИЧНА ГЕНЕРАЦІЯ ТУРНІРНОЇ ТАБЛИЦІ (SecScreen) ===
  if (etap === 'SecScreen') {
    const matchConfigs = {
      "14": { offset: 0 },
      "17A": { offset: 6 },
      "17B": { offset: 12 },
      "66": { offset: 18 }
    };

    // Універсальна функція для обробки матчів (адаптується під нові команди та різні аркуші)
    const processRowStats = (row, offset, stats, isAfterFinal) => {
      if (!row) return;
      
      let team1 = getVal(row, offset + 1).trim();
      let team2, score1, score2;

      if (isAfterFinal) {
        // Структура AfterFinal може трохи відрізнятися, тому робимо перехресну перевірку
        score1 = getVal(row, offset + 2).trim();
        let col3 = getVal(row, offset + 3).trim();
        let col4 = getVal(row, offset + 4).trim();
        
        // Шукаємо, де саме схований другий рахунок (бо у вас там було об'єднання "команда : рахунок")
        if (!isNaN(parseInt(col3)) && isNaN(parseInt(col4))) {
            score2 = col3; team2 = col4;
        } else {
            team2 = col3; score2 = col4;
        }
      } else {
        score1 = getVal(row, offset + 2).trim();
        score2 = getVal(row, offset + 3).trim();
        team2 = getVal(row, offset + 4).trim();
      }

      if (!team1 && !team2) return;

      // ДИНАМІКА: Якщо команди ще немає в базі, створюємо її автоматично
      if (team1 && !stats[team1]) stats[team1] = { g: 0, w: 0, d: 0, l: 0, gs: 0, gc: 0 };
      if (team2 && !stats[team2]) stats[team2] = { g: 0, w: 0, d: 0, l: 0, gs: 0, gc: 0 };

      // Рахуємо статистику тільки якщо матч зіграно (є обидва рахунки)
      if (team1 && team2 && score1 !== '' && score2 !== '') {
        // Витягуємо тільки числа (ігноруємо випадкові пробіли чи літери)
        const s1 = parseInt(score1.replace(/[^\d]/g, ''));
        const s2 = parseInt(score2.replace(/[^\d]/g, ''));

        if (!isNaN(s1) && !isNaN(s2)) {
          stats[team1].g++; stats[team2].g++;
          stats[team1].gs += s1; stats[team1].gc += s2;
          stats[team2].gs += s2; stats[team2].gc += s1;

          if (s1 > s2) { stats[team1].w++; stats[team2].l++; }
          else if (s1 < s2) { stats[team2].w++; stats[team1].l++; }
          else { stats[team1].d++; stats[team2].d++; }
        }
      }
    };

    Object.keys(matchConfigs).forEach(key => {
      const offset = matchConfigs[key].offset;
      const stats = {}; 

      // 1. Беремо всі матчі та команди з BeforeFinal
      for (let i = 2; i < beforeFinalData.length; i++) {
        processRowStats(beforeFinalData[i], offset, stats, false);
      }

      // 2. Додаємо всі матчі та команди з AfterFinal
      for (let i = 2; i < afterFinalData.length; i++) {
        processRowStats(afterFinalData[i], offset, stats, true);
      }

      // 3. Формуємо таблицю
      const standings = Object.keys(stats).map(teamName => {
        const st = stats[teamName];
        return {
          time: teamName,
          team1: st.g,
          score: st.w,
          score2: st.d,
          team2: st.l,
          field: (st.w * 3) + st.d, // Очки
          goalDiff: st.gs - st.gc   // Різниця голів для сортування
        };
      });

      // Сортування (Очки -> Різниця голів)
      standings.sort((a, b) => {
        if (b.field !== a.field) return b.field - a.field;
        return b.goalDiff - a.goalDiff;
      });

      responseData.tables[key] = standings;
    });

  } else {
    // === ЛОГІКА ДЛЯ СТАНДАРТНИХ ЕКРАНІВ (BeforeFinal / AfterFinal) ===
    // ... ТУТ ЗАЛИШАЄТЬСЯ ВАШ СТАРИЙ КОД (let configs = {}; ...)
    let configs = {};
    if (etap === "BeforeFinal") {
      configs = { "14": { offset: 0 }, "17A": { offset: 6 }, "17B": { offset: 12 }, "66": { offset: 18 } };
    } else if (etap === "AfterFinal") {
      configs = { "14": { offset: 0 }, "17": { offset: 0 }, "66": { offset: 0 } };
    }

    Object.keys(configs).forEach(key => {
      const conf = configs[key];
      const offset = conf.offset;
      const rows = [];

      for (let i = 2; i < maxRows; i++) {
        const row = rawData[i];
        if (!row || !getVal(row, offset)) continue;

        let rowObj = {};
        if (etap === "AfterFinal") {
           rowObj = {
            time: getVal(row, offset),
            team1: getVal(row, offset + 1),
            score: getVal(row, offset + 2),
            team2: `${getVal(row, offset + 3)} : ${getVal(row, offset + 4)}`,
            field: getVal(row, offset + 5),
            last: getVal(row, offset + 6)
          };
        } else {
          // BeforeFinal
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

  res.json(responseData);
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server ready on ${PORT}`));
}

module.exports = app;