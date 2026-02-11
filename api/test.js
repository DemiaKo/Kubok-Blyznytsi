// api/index.js
const express = require('express');
const path = require('path');
const { google } = require('googleapis');
require('dotenv').config();

const app = express();

// Дозволяємо CORS, щоб фронтенд міг звертатися до API
const cors = require('cors');
app.use(cors());

const publicPath = path.join(__dirname, '../');
app.use(express.static(publicPath));
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Налаштування доступу до Google Sheets
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Фікс для переносів рядків у Vercel
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// Функція для отримання даних з кешу (або API)
// Google API повільніше локального файлу, тому краще брати діапазон
async function getSheetData(range) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range, // Наприклад: "Sheet1!A1:Z100"
    });
    return response.data.values || [];
  } catch (error) {
    console.error('Google Sheets API Error:', error);
    return null;
  }
}

// Допоміжна функція для безпечного отримання значення з масиву
// rowIdx - індекс рядка (0-based), colIdx - індекс колонки (0-based, A=0, B=1)
function getCellValue(data, rowIdx, colIdx) {
  if (data && data[rowIdx] && data[rowIdx][colIdx] !== undefined) {
    return data[rowIdx][colIdx];
  }
  return '';
}

// Основний API ендпоінт
app.get('/api/table-data/:etap/:u/:rowCount', async (req, res) => {
  const Etap = req.params.etap; // Назва листа (Sheet Name)
  const U = req.params.u;
  // Додаємо +2, як у вашому оригінальному коді (заголовки тощо)
  const requestedRows = parseInt(req.params.rowCount) + 2;

  // Визначаємо зміщення колонки (offset)
  let colOffset = 0;

  if (U === "Y") {
    // Спеціальний випадок для прапора
    colOffset = "Y"; 
  } else if (Etap === "SecScreen") {
    switch (U) {
      case "14": colOffset = 0; break;
      case "17A": colOffset = 5; break;
      case "17B": colOffset = 10; break;
      case "66": colOffset = 15; break;
      default: colOffset = 0;
    }
  } else if (Etap === "AfterFinal") {
    switch (U) {
      case '17': colOffset = 0; break;
      default: colOffset = 0;
    }
  } else {
    // Стандартні екрани
    switch (U) {
      case "14": colOffset = 0; break;
      case "17A": colOffset = 6; break;
      case "17B": colOffset = 12; break;
      case "66": colOffset = 18; break;
      default: colOffset = 0;
    }
  }

  // 1. Отримуємо дані з Google Sheets
  // Завантажуємо весь лист (або великий шматок), щоб не робити 100 запитів
  // Припустимо, що дані не ширші за колонку Z і не довші за 100 рядків (можна збільшити)
  const range = `${Etap}!A1:AB${requestedRows + 10}`; 
  const sheetData = await getSheetData(range);

  if (!sheetData) {
    return res.status(500).json({ error: "Failed to fetch data from Google Sheets" });
  }

  // 2. Логіка для "Y" (Flag)
  if (U === "Y") {
    // У вашому коді це було worksheet['AA1']. AA - це 26-й індекс (0-based)
    const flagValue = getCellValue(sheetData, 0, 26); // Row 1 (index 0), Col AA (index 26)
    return res.json({ flag: flagValue });
  }

  // 3. Формуємо масив рядків
  const tableData = [];

  // Цикл як у вашому коді, починаючи з i=1
  for (let i = 1; i < requestedRows; i++) {
    const rowNum = i + 2; 
    const arrayRowIdx = rowNum - 1; // Google API повертає масив, де Row 1 = index 0.

    // Перевірка, чи існує рядок в даних
    if (arrayRowIdx >= sheetData.length) break;

    let rowData = {};
    const baseCol = colOffset; // Числовий індекс початкової колонки

    /* Мапінг колонок з вашого коду (letters array):
       c1 (col) -> baseCol
       c2 (col+1) -> baseCol + 1
       c3 (col+2) -> baseCol + 2
       c4 (col+3) -> baseCol + 3
       c5 (col+4) -> baseCol + 4
       c6 (col+5) -> baseCol + 5
       c7 (col+6) -> baseCol + 6
    */

    if (Etap === "SecScreen") {
      const scoreVal = getCellValue(sheetData, arrayRowIdx, baseCol + 2); // c3
      const score2Val = getCellValue(sheetData, arrayRowIdx, baseCol + 3); // c4
      
      const scoreInt = parseInt(scoreVal) || 0;
      const score2Int = parseInt(score2Val) || 0;

      rowData = {
        time: getCellValue(sheetData, arrayRowIdx, baseCol),     // c1
        team1: getCellValue(sheetData, arrayRowIdx, baseCol + 1), // c2
        team2: getCellValue(sheetData, arrayRowIdx, baseCol + 4), // c5
        score: scoreVal,
        score2: score2Val,
        field: (scoreInt * 3) + score2Int
      };
    } else if (Etap === "AfterFinal") {
      const cellA = getCellValue(sheetData, arrayRowIdx, baseCol + 3); // c4
      const cellB = getCellValue(sheetData, arrayRowIdx, baseCol + 4); // c5

      rowData = {
        time: getCellValue(sheetData, arrayRowIdx, baseCol),      // c1
        team1: getCellValue(sheetData, arrayRowIdx, baseCol + 1),  // c2
        team2: `${cellA} : ${cellB}`, // c4:c5 combined
        score: getCellValue(sheetData, arrayRowIdx, baseCol + 2),  // c3
        field: getCellValue(sheetData, arrayRowIdx, baseCol + 5),  // c6
        last: getCellValue(sheetData, arrayRowIdx, baseCol + 6)    // c7
      };
    } else {
      // Regular screens
      const cellScoreA = getCellValue(sheetData, arrayRowIdx, baseCol + 2); // c3
      const cellScoreB = getCellValue(sheetData, arrayRowIdx, baseCol + 3); // c4

      rowData = {
        time: getCellValue(sheetData, arrayRowIdx, baseCol),      // c1
        team1: getCellValue(sheetData, arrayRowIdx, baseCol + 1),  // c2
        team2: getCellValue(sheetData, arrayRowIdx, baseCol + 4),  // c5
        score: `${cellScoreA} : ${cellScoreB}`, // c3:c4 combined
        field: getCellValue(sheetData, arrayRowIdx, baseCol + 5)   // c6
      };
    }
    
    tableData.push(rowData);
  }

  res.json({ rows: tableData });
});

// Для локального запуску
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;