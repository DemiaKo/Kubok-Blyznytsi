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
  
  // Ми робимо два запити паралельно:
  // 1. Основні дані для поточної сторінки
  // 2. Перевірка прапора "Y" ЗАВЖДИ з головного листа (BeforeFinal), 
  //    щоб уникнути циклічних переадресацій.
  
  const dataPromise = getSheetData(`${etap}!A1:AC30`);
  const flagPromise = getSheetData('BeforeFinal!AA1'); // Завжди беремо флаг звідси

  const [rawData, flagData] = await Promise.all([dataPromise, flagPromise]);
  
  if (!rawData) return res.status(500).json({ error: "No data" });

  // Отримуємо прапор з результату другого запиту
  // flagData[0][0] - це клітинка AA1 з листа BeforeFinal
  const flag = (flagData && flagData[0] && flagData[0][0]) ? flagData[0][0] : '';

  let configs = {};
  
  if (etap === "BeforeFinal") {
    configs = { "14": { offset: 0 }, "17A": { offset: 6 }, "17B": { offset: 12 }, "66": { offset: 18 } };
  } else if (etap === "SecScreen") {
    configs = { "14": { offset: 0 }, "17A": { offset: 5 }, "17B": { offset: 10 }, "66": { offset: 15 } };
  } else if (etap === "AfterFinal") {
    configs = { "14": { offset: 0 }, "17": { offset: 0 }, "66": { offset: 0 } };
  }

  const responseData = {
    flag: flag, // Тепер це завжди правильний прапор
    tables: {}
  };

  const maxRows = rawData.length;
  
  Object.keys(configs).forEach(key => {
    const conf = configs[key];
    const offset = conf.offset;
    const rows = [];

    // start from row 3 (index 2)
    for (let i = 2; i < maxRows; i++) {
      const row = rawData[i];
      if (!row || !getVal(row, offset)) continue;

      let rowObj = {};
      if (etap === "SecScreen") {
        const score1 = getVal(row, offset + 2);
        const score2 = getVal(row, offset + 3);
        const s1Int = parseInt(score1) || 0;
        const s2Int = parseInt(score2) || 0;
        rowObj = {
          time: getVal(row, offset),
          team1: getVal(row, offset + 1),
          score: score1,
          score2: score2,
          team2: getVal(row, offset + 4),
          field: (s1Int * 3) + s2Int
        };
      } else if (etap === "AfterFinal") {
         rowObj = {
          time: getVal(row, offset),
          team1: getVal(row, offset + 1),
          score: getVal(row, offset + 2),
          team2: `${getVal(row, offset + 3)} : ${getVal(row, offset + 4)}`,
          field: getVal(row, offset + 5),
          last: getVal(row, offset + 6)
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

  res.json(responseData);
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server ready on ${PORT}`));
}

module.exports = app;