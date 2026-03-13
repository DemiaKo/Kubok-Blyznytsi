function populateSecTable(tableId, rowsData) {
  const table = document.getElementById(tableId);
  if (!table || !rowsData) return;
  
  const tbody = table.getElementsByTagName('tbody')[0];
  
  // Автоматично додаємо рядки, якщо команд більше (щоб не з'їдало 6-ту команду)
  while (tbody.rows.length < rowsData.length) {
    const newRow = tbody.insertRow();
    for (let i = 0; i < 7; i++) newRow.insertCell();
  }

  const tableRows = tbody.rows;
  
  rowsData.forEach((data, index) => {
    const cells = tableRows[index].cells;
    cells[0].textContent = index + 1;  // Автоматичний номер місця
    cells[1].textContent = data.time;  // Назва команди
    cells[2].textContent = data.team1; // Ігри
    cells[3].textContent = data.score; // Перемоги
    cells[4].textContent = data.score2; // Нічиї
    cells[5].textContent = data.team2; // Поразки
    cells[6].textContent = data.field; // Очки
  });
}

document.addEventListener('DOMContentLoaded', function() {
  const loc = localStorage.getItem("1scr");

  fetch('/api/view/SecScreen')
    .then(res => res.json())
    .then(data => {
      populateSecTable('U-14-A', data.tables['14A']);
      populateSecTable('U-14-B', data.tables['14B']);
      populateSecTable('U-17', data.tables['17']);
      populateSecTable('U-66', data.tables['66']);
    })
    .catch(err => console.error(err));
  
  if (loc == "B") {
    setTimeout(() => { window.location = 'index.html'; }, 20000);
  } else if (loc == "F") {
    setTimeout(() => { window.location = '1scrF.html'; }, 20000);
  }
});