
"use strict";

const $ = (id) => document.getElementById(id);

const budgetInput = $("budget");
const saveBudgetButton = $("save-budget");
const budgetMessage = $("budget-message");
const expenseForm = $("expense-form");
const titleInput = $("title");
const amountInput = $("amount");
const categoryInput = $("category");
const dateInput = $("date");
const formMessage = $("form-message");
const expenseList = $("expense-list");
const emptyState = $("empty-state");
const categoryFilter = $("filter-category");
const monthFilter = $("filter-month");

const chartColors = [
    "#6655e8", "#159b79", "#f0a13c", "#e66784",
    "#5595df", "#9a75d1", "#36a9b2", "#8993a5"
];

const validCategories = [
    "Food", "Travel", "Education", "Shopping",
    "Entertainment", "Bills", "Health", "Other"
];

const todayString = getTodayString();

let expenses = loadExpenses();
let budget = loadBudget();
let chart = null;
let storageAvailable = true;

function getTodayString() {
    const d = new Date();

    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0")
    ].join("-");
}

function formatMoney(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    return date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day &&
        value <= todayString;
}

function loadExpenses() {
    try {
        const data = JSON.parse(
            localStorage.getItem("spendwise-expenses") || "[]"
        );

        if (!Array.isArray(data)) return [];

        return data.filter(item =>
            item &&
            typeof item.id === "string" &&
            typeof item.title === "string" &&
            item.title.trim().length > 0 &&
            typeof item.category === "string" &&
            validCategories.includes(item.category) &&
            typeof item.date === "string" &&
            isValidDate(item.date) &&
            typeof item.amount === "number" &&
            Number.isFinite(item.amount) &&
            item.amount > 0 &&
            item.amount <= 1000000000
        );
    } catch {
        return [];
    }
}

function loadBudget() {
    try {
        const stored = localStorage.getItem("spendwise-budget");

        if (stored === null || stored.trim() === "") return null;

        const value = Number(stored);

        return Number.isFinite(value) && value >= 0 ? value : null;
    } catch {
        return null;
    }
}

function saveData() {
    try {
        localStorage.setItem(
            "spendwise-expenses",
            JSON.stringify(expenses)
        );

        if (budget === null) {
            localStorage.removeItem("spendwise-budget");
        } else {
            localStorage.setItem("spendwise-budget", String(budget));
        }

        storageAvailable = true;
        return true;
    } catch {
        storageAvailable = false;
        alert(
            "Your changes could not be saved in this browser. " +
            "Check browser storage settings and available space."
        );
        return false;
    }
}

function getMonthKey(date) {
    return date.slice(0, 7);
}

function getCurrentMonthExpenses() {
    const currentMonth = todayString.slice(0, 7);

    return expenses.filter(
        expense => getMonthKey(expense.date) === currentMonth
    );
}

function setMessage(element, message, error = false) {
    element.textContent = message;
    element.classList.toggle("message-error", error);
}

function renderDashboard() {
    const monthlyExpenses = getCurrentMonthExpenses();

    const total = monthlyExpenses.reduce(
        (sum, expense) => sum + expense.amount,
        0
    );

    $("total").textContent = formatMoney(total);
    $("count").textContent = String(monthlyExpenses.length);

    const remainingElement = $("remaining");
    const remainingNote = $("remaining-note");
    const progress = $("budget-progress");

    if (budget === null) {
        remainingElement.textContent = "Not set";
        remainingElement.style.color = "";
        remainingNote.textContent = "Set your budget to begin";
        $("budget-percent").textContent = "Set budget";
        $("limit-label").textContent = "Budget: Not set";
        progress.style.width = "0%";
        progress.classList.remove("over-budget");
    } else {
        const remaining = budget - total;
        const percent = budget > 0
            ? (total / budget) * 100
            : (total > 0 ? 100 : 0);

        remainingElement.textContent = formatMoney(remaining);
        remainingElement.style.color = remaining < 0 ? "#cf4555" : "#14966a";

        remainingNote.textContent = remaining < 0
            ? "You are over budget"
            : "Available for this month";

        $("budget-percent").textContent =
            `${percent.toFixed(1)}% used`;

        $("limit-label").textContent = `Budget: ${formatMoney(budget)}`;

        progress.style.width = `${Math.min(percent, 100)}%`;
        progress.classList.toggle("over-budget", total > budget);
    }

    $("spent-label").textContent = `Spent: ${formatMoney(total)}`;

    renderTransactions();
    renderChart(monthlyExpenses);
}

function renderTransactions() {
    const selectedCategory = categoryFilter.value;
    const selectedMonth = monthFilter.value;

    const filtered = [...expenses]
        .filter(expense =>
            selectedCategory === "all" ||
            expense.category === selectedCategory
        )
        .filter(expense =>
            selectedMonth === "all" ||
            getMonthKey(expense.date) === selectedMonth
        )
        .sort((a, b) =>
            b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
        );

    expenseList.replaceChildren();

    for (const expense of filtered) {
        const row = document.createElement("tr");

        const titleCell = document.createElement("td");
        titleCell.textContent = expense.title;

        const categoryCell = document.createElement("td");
        const tag = document.createElement("span");
        tag.className = "category-tag";
        tag.textContent = expense.category;
        categoryCell.appendChild(tag);

        const dateCell = document.createElement("td");
        dateCell.textContent = expense.date;

        const amountCell = document.createElement("td");
        amountCell.textContent = formatMoney(expense.amount);

        const actionCell = document.createElement("td");
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-btn";
        deleteButton.textContent = "Delete";
        deleteButton.setAttribute(
            "aria-label",
            `Delete ${expense.title}`
        );

        deleteButton.addEventListener("click", () => {
            if (!confirm(`Delete "${expense.title}"?`)) return;

            const previous = expenses;
            expenses = expenses.filter(item => item.id !== expense.id);

            if (saveData()) {
                renderDashboard();
                setMessage(formMessage, "Expense deleted.");
            } else {
                expenses = previous;
            }
        });

        actionCell.appendChild(deleteButton);
        row.append(titleCell, categoryCell, dateCell, amountCell, actionCell);
        expenseList.appendChild(row);
    }

    emptyState.hidden = filtered.length > 0;

    $("visible-count").textContent =
        `${filtered.length} transaction${filtered.length === 1 ? "" : "s"}`;

    const filteredTotal = filtered.reduce(
        (sum, expense) => sum + expense.amount,
        0
    );

    $("visible-total").textContent = formatMoney(filteredTotal);

    renderMonthOptions();
}

function renderMonthOptions() {
    const selected = monthFilter.value;
    const months = [...new Set(expenses.map(e => getMonthKey(e.date)))]
        .sort((a, b) => b.localeCompare(a));

    monthFilter.replaceChildren();

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All months";
    monthFilter.appendChild(allOption);

    for (const month of months) {
        const option = document.createElement("option");
        option.value = month;

        const [year, number] = month.split("-").map(Number);
        option.textContent = new Date(year, number - 1, 1)
            .toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric"
            });

        monthFilter.appendChild(option);
    }

    monthFilter.value = months.includes(selected) ? selected : "all";
}

function renderChart(monthlyExpenses) {
    const totals = {};

    for (const expense of monthlyExpenses) {
        totals[expense.category] =
            (totals[expense.category] || 0) + expense.amount;
    }

    const labels = Object.keys(totals);
    const chartCanvas = $("expense-chart");
    const emptyChart = $("chart-empty");
    const categorySummary = $("category-summary");

    emptyChart.hidden = labels.length > 0;
    categorySummary.replaceChildren();

    if (chart) {
        chart.destroy();
        chart = null;
    }

    if (typeof Chart === "undefined") {
        emptyChart.textContent =
            "Chart library unavailable. Connect to the internet to load the chart.";
        emptyChart.hidden = false;
        return;
    }

    chart = new Chart(chartCanvas, {
        type: "doughnut",
        data: {
            labels,
            datasets: [{
                data: labels.map(label => totals[label]),
                backgroundColor: labels.map(
                    (_, index) => chartColors[index % chartColors.length]
                ),
                borderWidth: 0,
                hoverOffset: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "66%",
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label(context) {
                            return `${context.label}: ${formatMoney(context.raw)}`;
                        }
                    }
                }
            }
        }
    });

    const grandTotal = labels.reduce(
        (sum, label) => sum + totals[label],
        0
    );

    labels
        .sort((a, b) => totals[b] - totals[a])
        .forEach(label => {
            const row = document.createElement("div");
            row.className = "category-row";

            const name = document.createElement("span");
            name.className = "category-name";

            const dot = document.createElement("span");
            dot.className = "category-color";
            dot.style.backgroundColor =
                chartColors[labels.indexOf(label) % chartColors.length];

            const labelText = document.createElement("span");
            labelText.textContent = label;
            name.append(dot, labelText);

            const amount = document.createElement("strong");
            const share = grandTotal > 0
                ? (totals[label] / grandTotal) * 100
                : 0;

            amount.textContent =
                `${formatMoney(totals[label])} · ${share.toFixed(0)}%`;

            row.append(name, amount);
            categorySummary.appendChild(row);
        });
}

saveBudgetButton.addEventListener("click", () => {
    const raw = budgetInput.value.trim();

    if (raw === "") {
        setMessage(budgetMessage, "Please enter a budget.", true);
        budgetInput.focus();
        return;
    }

    const value = Number(raw);

    if (!Number.isFinite(value) || value < 0 || value > 1000000000) {
        setMessage(
            budgetMessage,
            "Enter a valid budget between ₹0 and ₹1,000,000,000.",
            true
        );
        budgetInput.focus();
        return;
    }

    const previous = budget;
    budget = value;

    if (saveData()) {
        renderDashboard();
        setMessage(budgetMessage, "Budget saved successfully.");
    } else {
        budget = previous;
    }
});

expenseForm.addEventListener("submit", event => {
    event.preventDefault();

    const title = titleInput.value.trim();
    const amount = Number(amountInput.value);
    const category = categoryInput.value;
    const date = dateInput.value;

    if (!title) {
        setMessage(formMessage, "Enter an expense name.", true);
        titleInput.focus();
        return;
    }

    if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > 1000000000
    ) {
        setMessage(formMessage, "Enter a valid positive amount.", true);
        amountInput.focus();
        return;
    }

    if (!validCategories.includes(category)) {
        setMessage(formMessage, "Choose a valid category.", true);
        return;
    }

    if (!isValidDate(date)) {
        setMessage(formMessage, "Choose a valid date that is not in the future.", true);
        dateInput.focus();
        return;
    }

    const expense = {
        id: crypto.randomUUID(),
        title,
        amount,
        category,
        date
    };

    expenses.push(expense);

    if (saveData()) {
        expenseForm.reset();
        dateInput.value = todayString;
        setMessage(formMessage, "Expense added successfully.");
        renderDashboard();
    } else {
        expenses = expenses.filter(item => item.id !== expense.id);
    }
});

categoryFilter.addEventListener("change", renderTransactions);
monthFilter.addEventListener("change", renderTransactions);

budgetInput.addEventListener("input", () => {
    setMessage(budgetMessage, "");
});

dateInput.value = todayString;

if (budget !== null) {
    budgetInput.value = String(budget);
}

renderDashboard();

if (!storageAvailable) {
    setMessage(
        formMessage,
        "Browser storage is unavailable. Changes may not persist.",
        true
    );
}
