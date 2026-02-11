const express = require('express');
const path = require('path');
const XLSX = require('xlsx');
const app = express();
const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X'];

// Serve static files from the current directory
app.use(express.static(path.join(__dirname, 'public')));

// Function to get Excel data for a specific row
function getExcelData(rowNum, sh, t, col) {
  try {
    const filePath = path.join(__dirname, 'kb.xlsx');
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[sh];
    
    if (col == "Y") {
      const cell = worksheet['AA1'] ? worksheet['AA1'].v : '';
      return cell;
    } else if (t == "c1") {
      const cell = worksheet[letters[col] + rowNum] ? worksheet[letters[col] + rowNum].v : '';
      return cell;
    } else if (t == "c2") {
      const cell = worksheet[letters[col+1] + rowNum] ? worksheet[letters[col+1] + rowNum].v : '';
      return cell;
    } else if (t == "c5") {
      const cell = worksheet[letters[col+4] + rowNum] ? worksheet[letters[col+4] + rowNum].v : '';
      return cell;
    } else if (t == "c6") {
      const cell = worksheet[letters[col+5] + rowNum] ? worksheet[letters[col+5] + rowNum].v : '';
      return cell;
    } else if (t == "c7") {
      const cell = worksheet[letters[col+6] + rowNum] ? worksheet[letters[col+6] + rowNum].v : '';
      return cell;
    } else if (t == "c3") {
      const cell = worksheet[letters[col+2] + rowNum] ? worksheet[letters[col+2] + rowNum].v : '';
      return cell;
    } else if (t == "c4") {
      const cell = worksheet[letters[col+3] + rowNum] ? worksheet[letters[col+3] + rowNum].v : '';
      return cell;
    } else if (t == "c4:c5") {
      const cellA = worksheet[letters[col+3] + rowNum] ? worksheet[letters[col+3] + rowNum].v : '';
      const cellB = worksheet[letters[col+4] + rowNum] ? worksheet[letters[col+4] + rowNum].v : '';
      
      const combinedValue = cellA + " : " + cellB;
      return combinedValue; 
    } else if (t == "c3:c4") {
      const cellA = worksheet[letters[col+2] + rowNum] ? worksheet[letters[col+2] + rowNum].v : '';
      const cellB = worksheet[letters[col+3] + rowNum] ? worksheet[letters[col+3] + rowNum].v : '';
      
      const combinedValue = cellA + " : " + cellB;
      return combinedValue;
    }
  } catch (error) {
    console.error('Error reading Excel file:', error);
    return 'Error reading Excel file';
  }
}


// NEW ENDPOINT: Get all data for a table in a single request
app.get('/api/table-data/:etap/:u/:rowCount', (req, res) => {
  const Etap = req.params.etap;
  const U = req.params.u;
  const rowCount = parseInt(req.params.rowCount)+2;
  
  // Determine column based on age group
  let columns = 0;
  
  if (U == "Y") {
    columns = "Y";
  } else if (Etap == "SecScreen") {
    switch (U) {
      case "14": columns = 0; break;
      case "17A": columns = 5; break;
      case "17B": columns = 10; break;
      case "66": columns = 15; break;
    }
  } else if (Etap == "AfterFinal") {
    switch (U) {
      case '17': columns = 0; break;
    }
  } else {
    switch (U) {
      case "14": columns = 0; break;
      case "17A": columns = 6; break;
      case "17B": columns = 12; break;
      case "66": columns = 18; break;
    }
  }
  
  // If requesting the flag only
  if (U == "Y") {
    const flagValue = getExcelData(1, Etap, "", "Y");
    return res.json({ flag: flagValue });
  }
  
  // Prepare data for all requested rows
  const tableData = [];
  
  for (let i = 1; i < rowCount; i++) {
    const rowNum = i + 2; // Excel is 1-indexed
    
    // Get all required data for this row
    let rowData = {};
    
    if (Etap == "SecScreen") {
      // Get the score and score2 values first
      const scoreValue = getExcelData(rowNum, Etap, "c3", columns);
      const score2Value = getExcelData(rowNum, Etap, "c4", columns);
      
      // Second screen has score and score2
      rowData = {
        time: getExcelData(rowNum, Etap, "c1", columns),
        team1: getExcelData(rowNum, Etap, "c2", columns),
        team2: getExcelData(rowNum, Etap, "c5", columns),
        score: scoreValue,
        score2: score2Value,
        field: (parseInt(scoreValue)*3)+parseInt(score2Value)
      };
    } else if (Etap == "AfterFinal") {
      // AfterFinal screen handling
      rowData = {
        time: getExcelData(rowNum, Etap, "c1", columns),
        team1: getExcelData(rowNum, Etap, "c2", columns),
        team2: getExcelData(rowNum, Etap, "c4:c5", columns),
        score: getExcelData(rowNum, Etap, "c3", columns),
        field: getExcelData(rowNum, Etap, "c6", columns),
        last: getExcelData(rowNum, Etap, "c7", columns)
      };
    } else {
      // Regular screens
      rowData = {
        time: getExcelData(rowNum, Etap, "c1", columns),
        team1: getExcelData(rowNum, Etap, "c2", columns),
        team2: getExcelData(rowNum, Etap, "c5", columns),
        score: getExcelData(rowNum, Etap, "c3:c4", columns),
        field: getExcelData(rowNum, Etap, "c6", columns)
      };
    }
    
    tableData.push(rowData);
  }
  
  res.json({ rows: tableData });
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});