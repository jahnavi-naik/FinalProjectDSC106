function showAlert() {
    alert('Hello! This is a simple alert message.');
}

let currentPage = 1;

document.getElementById('nextPage').addEventListener('click', function() {
    currentPage++;
    if (currentPage > 2) {
        currentPage = 1; // Loop back to the first page
    }
    loadPage(currentPage);
});

function loadPage(page) {
    const mainContent = document.querySelector('main');
    if (page === 1) {
        mainContent.innerHTML = `
            <h2>Page 1</h2>
            <p>This is the first page of the interactive treadmill website.</p>
        `;
    } else if (page === 2) {
        mainContent.innerHTML = `
            <h2>Page 2</h2>
            <p>This is the second page of the interactive treadmill website.</p>
        `;
    }
}
