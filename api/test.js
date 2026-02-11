const express = require('express');
const path = require('path');
const { google } = require('googleapis');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

// Статичні файли (для локального запуску)
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// Google Auth
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// Helper: Get raw data
async function getSheetData(range) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });
    return response.data.values || [];
  } catch (error) {
    console.error('Google Sheets API Error:', error);
    return null;
  }
}

// Helper: Get cell value safely
function getVal(row, index) {
  return (row && row[index] !== undefined) ? row[index] : '';
}

// === НОВИЙ ОПТИМІЗОВАНИЙ ЕНДПОІНТ ===
app.get('/api/view/:etap', async (req, res) => {
  const { etap } = req.params;
  
  // 1. Завантажуємо ВЕСЬ лист одним запитом (A1:AC30)
  // Беремо 30 рядків із запасом, щоб покрити всі таблиці
  const rawData = await getSheetData(`${etap}!A1:AC30`);
  
  if (!rawData) return res.status(500).json({ error: "No data" });

  // 2. Отримуємо прапор (Cell AA1 -> index 26)
  const flag = getVal(rawData[0], 26);

  // 3. Налаштування колонок для різних категорій
  // Це замінює switch(U) з минулого коду
  let configs = {};
  
  if (etap === "BeforeFinal") {
    configs = {
      "14":  { offset: 0 },
      "17A": { offset: 6 },
      "17B": { offset: 12 },
      "66":  { offset: 18 }
    };
  } else if (etap === "SecScreen") {
    configs = {
      "14":  { offset: 0 },
      "17A": { offset: 5 },
      "17B": { offset: 10 },
      "66":  { offset: 15 }
    };
  } else if (etap === "AfterFinal") {
    // Тут логіка з вашого старого коду, де зсув переважно 0
    configs = {
      "14": { offset: 0 },
      "17": { offset: 0 },
      "66": { offset: 0 }
    };
  }

  const responseData = {
    flag: flag,
    tables: {}
  };

  // 4. Проходимо по рядках і збираємо дані для всіх таблиць одразу
  // Починаємо з index 2 (рядок 3), бо 0 і 1 це заголовки
  const maxRows = rawData.length;
  
  Object.keys(configs).forEach(key => {
    const conf = configs[key];
    const offset = conf.offset;
    const rows = [];

    for (let i = 2; i < maxRows; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue; // Skip empty rows logic if needed

      // Перевіряємо, чи є час (перша колонка блоку), щоб не додавати пусті рядки
      if (!getVal(row, offset)) continue;

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
        // BeforeFinal (Standard)
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

// Start logic
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server ready on ${PORT}`));
}

module.exports = app;